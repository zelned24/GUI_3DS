/**
 * ImportCache.js
 * Tracks file hashes, revisions, and dependency hashes for incremental importing.
 */

export class ImportCache {
  constructor(initialData = {}) {
    this.sourceRevision = initialData.sourceRevision || '';
    this.importRevision = initialData.importRevision || 1;
    // Map of filePath -> { fileHash, dependencyHash, lastImported, entityIds: [] }
    this.entries = initialData.entries || {};
  }

  isEntryValid(filePath, currentHash, dependencyHash = '') {
    const entry = this.entries[filePath];
    if (!entry) return false;
    return entry.fileHash === currentHash && entry.dependencyHash === dependencyHash;
  }

  updateEntry(filePath, fileHash, dependencyHash = '', entityIds = []) {
    this.entries[filePath] = {
      fileHash,
      dependencyHash,
      lastImported: new Date().toISOString(),
      entityIds
    };
  }

  invalidateDependencies(affectedPaths = []) {
    const invalidatedEntities = new Set();
    for (const p of affectedPaths) {
      const entry = this.entries[p];
      if (entry && entry.entityIds) {
        entry.entityIds.forEach(id => invalidatedEntities.add(id));
      }
      delete this.entries[p];
    }
    return Array.from(invalidatedEntities);
  }

  serialize() {
    return {
      sourceRevision: this.sourceRevision,
      importRevision: this.importRevision,
      entries: this.entries
    };
  }
}
