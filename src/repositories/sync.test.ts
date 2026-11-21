import { type Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminDb } from "@/config/firebase";

import { MAX_SYNC_ITEMS, rutinaRepository, serieHechaRepository } from "./sync";

vi.mock("@/config/firebase", () => ({ getAdminDb: vi.fn() }));

type Data = Record<string, unknown>;

interface QueryOptions {
  orderField?: string;
  conditions?: Array<{ field: string; value: unknown }>;
  startAfterValue?: unknown;
  max?: number;
}

class FakeFirestore {
  readonly docs = new Map<string, Data>();
  readonly paths: string[] = [];
  readonly writes: Array<{ path: string; data: Data }> = [];

  collection(path: string): FakeCollection {
    this.paths.push(path);
    return new FakeCollection(this, path);
  }

  runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    return callback(new FakeTransaction(this));
  }

  seed(path: string, id: string, data: Data): void {
    this.docs.set(`${path}/${id}`, data);
  }
}

class FakeCollection {
  constructor(
    private readonly db: FakeFirestore,
    private readonly path: string,
  ) {}

  doc(id: string): FakeDoc {
    return new FakeDoc(this.db, `${this.path}/${id}`);
  }

  collection(name: string): FakeCollection {
    const path = `${this.path}/${name}`;
    this.db.paths.push(path);
    return new FakeCollection(this.db, path);
  }

  orderBy(field: string): FakeQuery {
    return new FakeQuery(this.db, this.path, { orderField: field });
  }

  where(field: string, _operator: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path, { conditions: [{ field, value }] });
  }
}

class FakeDoc {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string,
  ) {}

  collection(name: string): FakeCollection {
    const path = `${this.path}/${name}`;
    this.db.paths.push(path);
    return new FakeCollection(this.db, path);
  }

  get() {
    const data = this.db.docs.get(this.path);
    return {
      exists: data !== undefined,
      id: this.path.split("/").pop() ?? "",
      data: () => data,
    };
  }
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly path: string,
    private readonly options: QueryOptions,
  ) {}

  orderBy(field: string): FakeQuery {
    return new FakeQuery(this.db, this.path, { ...this.options, orderField: field });
  }

  where(field: string, _operator: string, value: unknown): FakeQuery {
    const conditions = [...(this.options.conditions ?? []), { field, value }];
    return new FakeQuery(this.db, this.path, { ...this.options, conditions });
  }

  startAfter(value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path, { ...this.options, startAfterValue: value });
  }

  limit(max: number): FakeQuery {
    return new FakeQuery(this.db, this.path, { ...this.options, max });
  }

  async get() {
    const docs = [...this.db.docs.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`))
      .filter(([path]) => !path.slice(this.path.length + 1).includes("/"))
      .map(([path, data]) => ({ id: path.split("/").pop() ?? "", data: () => data }))
      .filter((doc) =>
        (this.options.conditions ?? []).every(({ field, value }) => doc.data()?.[field] === value),
      )
      .filter((doc) => {
        const field = this.options.orderField;
        const since = this.options.startAfterValue;
        if (!field || since === undefined) {
          return true;
        }
        const current = doc.data()?.[field];
        return typeof current === "string" && typeof since === "string" && current > since;
      });

    return { docs: docs.slice(0, this.options.max ?? docs.length) };
  }
}

class FakeTransaction {
  constructor(private readonly db: FakeFirestore) {}

  async get(ref: FakeDoc) {
    return ref.get();
  }

  set(ref: FakeDoc, data: Data): void {
    this.db.writes.push({ path: ref.path, data });
    this.db.docs.set(ref.path, data);
  }
}

let db: FakeFirestore;

const rutinaPath = "usuarios/uid-a/rutina";

describe("repositorio de sincronización", () => {
  beforeEach(() => {
    db = new FakeFirestore();
    vi.mocked(getAdminDb).mockReturnValue(db as unknown as Firestore);
  });

  it("lee solo documentos del usuario autenticado", async () => {
    db.seed(rutinaPath, "r1", { nombre: "A", updated_at: "2026-01-01T00:00:00Z" });
    db.seed("usuarios/uid-b/rutina", "r1", { nombre: "B", updated_at: "2026-01-01T00:00:00Z" });

    await expect(rutinaRepository.get("uid-a", "r1")).resolves.toMatchObject({ nombre: "A" });
    expect(db.paths).toContain(rutinaPath);
    expect(db.paths).not.toContain("usuarios/uid-b/rutina");
  });

  it("devuelve cambios desde since y limita a 500", async () => {
    db.seed(rutinaPath, "r1", { nombre: "A", updated_at: "2026-01-01T00:00:00Z" });
    db.seed(rutinaPath, "r2", { nombre: "B", updated_at: "2026-01-02T00:00:00Z" });
    db.seed("usuarios/uid-b/rutina", "r9", {
      nombre: "C",
      updated_at: "2026-01-03T00:00:00Z",
    });

    const items = await rutinaRepository.listSince("uid-a", "2026-01-01T00:00:00Z");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "r2", nombre: "B" });

    for (let index = 0; index < MAX_SYNC_ITEMS + 5; index += 1) {
      db.seed(rutinaPath, `r${index}`, {
        nombre: `R${index}`,
        updated_at: "2026-03-01T00:00:00Z",
      });
    }
    await expect(rutinaRepository.listSince("uid-a")).resolves.toHaveLength(MAX_SYNC_ITEMS);
  });

  it("aplica último gana al guardar", async () => {
    db.seed(rutinaPath, "r1", {
      nombre: "Actual",
      updated_at: "2026-01-02T00:00:00Z",
    });

    await expect(
      rutinaRepository.upsertIfNewer("uid-a", "r1", {
        nombre: "Antigua",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).resolves.toMatchObject({ nombre: "Actual" });
    expect(db.writes).toHaveLength(0);

    await expect(
      rutinaRepository.upsertIfNewer("uid-a", "r1", {
        nombre: "Nueva",
        updated_at: "2026-01-03T00:00:00Z",
      }),
    ).resolves.toMatchObject({ nombre: "Nueva", deleted_at: null });
    expect(db.writes).toHaveLength(1);
  });

  it("hace borrado lógico sin afectar a otros usuarios", async () => {
    db.seed(rutinaPath, "r1", { nombre: "A", updated_at: "2026-01-01T00:00:00Z" });
    db.seed("usuarios/uid-b/rutina", "r1", {
      nombre: "B",
      updated_at: "2026-01-01T00:00:00Z",
    });

    await expect(
      rutinaRepository.markDeleted("uid-a", "r1", "2026-02-01T00:00:00Z"),
    ).resolves.toMatchObject({
      id: "r1",
      deleted_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
    });
    expect(db.docs.get("usuarios/uid-b/rutina/r1")).toMatchObject({ nombre: "B" });
  });

  it("omite borrados más antiguos y documentos inexistentes", async () => {
    db.seed(rutinaPath, "r1", { nombre: "A", updated_at: "2026-03-01T00:00:00Z" });

    await expect(
      rutinaRepository.markDeleted("uid-a", "r1", "2026-02-01T00:00:00Z"),
    ).resolves.toMatchObject({ nombre: "A" });
    await expect(
      rutinaRepository.markDeleted("uid-a", "missing", "2026-02-01T00:00:00Z"),
    ).resolves.toBeNull();
    expect(db.writes).toHaveLength(0);
  });

  it("filtra series activas por ejercicio y usuario", async () => {
    const seriePath = "usuarios/uid-a/serie_hecha";
    const serie = (ejercicio: string, deleted_at: string | null) => ({
      ejercicio,
      peso: 100,
      repeticiones: 5,
      fecha: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at,
    });
    db.seed(seriePath, "s1", serie("Press banca", null));
    db.seed(seriePath, "s2", serie("Press banca", "2026-02-01T00:00:00Z"));
    db.seed(seriePath, "s3", serie("Sentadilla", null));
    db.seed("usuarios/uid-b/serie_hecha", "s9", serie("Press banca", null));

    const items = await serieHechaRepository.listByExercise("uid-a", "Press banca");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "s1", ejercicio: "Press banca" });
  });
});
