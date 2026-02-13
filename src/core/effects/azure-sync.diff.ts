export interface AzureSyncEntitySnapshot {
  id: string;
  fingerprint: string;
}

export interface AzureSyncDiffResult {
  create: readonly AzureSyncEntitySnapshot[];
  update: readonly AzureSyncEntitySnapshot[];
  archive: readonly AzureSyncEntitySnapshot[];
  unchanged: readonly AzureSyncEntitySnapshot[];
}

const toEntityMap = (
  entities: ReadonlyArray<AzureSyncEntitySnapshot>,
): ReadonlyMap<string, AzureSyncEntitySnapshot> => new Map(entities.map((entity) => [entity.id, entity]));

export const diffAzureSyncEntities = (
  existing: ReadonlyArray<AzureSyncEntitySnapshot>,
  incoming: ReadonlyArray<AzureSyncEntitySnapshot>,
): AzureSyncDiffResult => {
  const existingById = toEntityMap(existing);
  const incomingById = toEntityMap(incoming);

  const create: AzureSyncEntitySnapshot[] = [];
  const update: AzureSyncEntitySnapshot[] = [];
  const unchanged: AzureSyncEntitySnapshot[] = [];
  const archive: AzureSyncEntitySnapshot[] = [];

  for (const entity of incoming) {
    const current = existingById.get(entity.id);
    if (!current) {
      create.push(entity);
      continue;
    }

    if (current.fingerprint !== entity.fingerprint) {
      update.push(entity);
      continue;
    }

    unchanged.push(entity);
  }

  for (const entity of existing) {
    if (!incomingById.has(entity.id)) {
      archive.push(entity);
    }
  }

  return {
    create,
    update,
    archive,
    unchanged,
  };
};
