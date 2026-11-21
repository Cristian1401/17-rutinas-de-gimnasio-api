import {
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { getAdminDb } from "@/config/firebase";
import type { RutinaRecord, SerieHechaRecord } from "@/schemas/sync";

export const MAX_SYNC_ITEMS = 500;

type CollectionName = "rutina" | "serie_hecha";

export interface SyncRecord {
  updated_at: string;
  deleted_at?: string | null;
}

export type SyncEntity<T extends SyncRecord> = T & { id: string };

export interface SyncRepository<T extends SyncRecord> {
  get(uid: string, id: string): Promise<SyncEntity<T> | null>;
  listSince(uid: string, since?: string): Promise<Array<SyncEntity<T>>>;
  upsertIfNewer(uid: string, id: string, value: T): Promise<SyncEntity<T>>;
  markDeleted(uid: string, id: string, deletedAt: string): Promise<SyncEntity<T> | null>;
}

export interface SerieHechaRepository extends SyncRepository<SerieHechaRecord> {
  listByExercise(uid: string, ejercicio: string): Promise<Array<SyncEntity<SerieHechaRecord>>>;
}

function userCollection(db: Firestore, uid: string, name: CollectionName) {
  return db.collection("usuarios").doc(uid).collection(name);
}

function toEntity<T extends SyncRecord>(
  snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
): SyncEntity<T> | null {
  const data = snapshot.data() as T | undefined;
  if (!data) {
    return null;
  }
  return { ...data, id: snapshot.id };
}

function toEntities<T extends SyncRecord>(
  snapshots: Array<QueryDocumentSnapshot<DocumentData>>,
): Array<SyncEntity<T>> {
  return snapshots
    .map((snapshot) => toEntity<T>(snapshot))
    .filter((entity): entity is SyncEntity<T> => entity !== null);
}

function normalize<T extends SyncRecord>(value: T): T {
  return { ...value, deleted_at: value.deleted_at ?? null };
}

function isNewer(candidate: string, current: string): boolean {
  return Date.parse(candidate) > Date.parse(current);
}

function createSyncRepository<T extends SyncRecord>(name: CollectionName): SyncRepository<T> {
  return {
    async get(uid, id) {
      const snapshot = await userCollection(getAdminDb(), uid, name).doc(id).get();
      return toEntity<T>(snapshot);
    },

    async listSince(uid, since) {
      let query = userCollection(getAdminDb(), uid, name).orderBy("updated_at");
      if (since) {
        query = query.startAfter(since);
      }
      const snapshot = await query.limit(MAX_SYNC_ITEMS).get();
      return toEntities<T>(snapshot.docs);
    },

    async upsertIfNewer(uid, id, value) {
      const ref = userCollection(getAdminDb(), uid, name).doc(id);
      const stored = normalize(value);
      return getAdminDb().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const current = toEntity<T>(snapshot);
        if (current && !isNewer(stored.updated_at, current.updated_at)) {
          return current;
        }
        transaction.set(ref, stored as DocumentData);
        return { ...stored, id };
      });
    },

    async markDeleted(uid, id, deletedAt) {
      const ref = userCollection(getAdminDb(), uid, name).doc(id);
      return getAdminDb().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const current = toEntity<T>(snapshot);
        if (!current || !isNewer(deletedAt, current.updated_at)) {
          return current;
        }
        const deleted = normalize<T>({ ...current, updated_at: deletedAt, deleted_at: deletedAt });
        transaction.set(ref, deleted as DocumentData);
        return { ...deleted, id };
      });
    },
  };
}

function createSerieHechaRepository(): SerieHechaRepository {
  const base = createSyncRepository<SerieHechaRecord>("serie_hecha");
  return {
    ...base,
    async listByExercise(uid, ejercicio) {
      const snapshot = await userCollection(getAdminDb(), uid, "serie_hecha")
        .where("ejercicio", "==", ejercicio)
        .where("deleted_at", "==", null)
        .limit(MAX_SYNC_ITEMS)
        .get();
      return toEntities<SerieHechaRecord>(snapshot.docs);
    },
  };
}

export const rutinaRepository = createSyncRepository<RutinaRecord>("rutina");
export const serieHechaRepository = createSerieHechaRepository();
