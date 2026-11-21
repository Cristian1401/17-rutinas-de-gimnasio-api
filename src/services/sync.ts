import {
  rutinaRepository,
  serieHechaRepository,
  type SyncRecord,
  type SyncRepository,
} from "@/repositories/sync";
import type { RutinaRecord, SerieHechaRecord } from "@/schemas/sync";

function createSyncService<T extends SyncRecord>(repository: SyncRepository<T>) {
  return {
    get(uid: string, id: string) {
      return repository.get(uid, id);
    },
    listSince(uid: string, since?: string) {
      return repository.listSince(uid, since);
    },
    upsert(uid: string, id: string, value: T) {
      return repository.upsertIfNewer(uid, id, value);
    },
    remove(uid: string, id: string, deletedAt = new Date().toISOString()) {
      return repository.markDeleted(uid, id, deletedAt);
    },
  };
}

export const rutinaService = createSyncService<RutinaRecord>(rutinaRepository);
export const serieHechaService = createSyncService<SerieHechaRecord>(serieHechaRepository);
