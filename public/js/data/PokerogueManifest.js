/**
 * public/js/data/PokerogueManifest.js
 * 
 * FASE 5: PokéRogue Import Manifest
 * Records upstream sources, revisions, schema version, import metadata, and file hashes.
 * Enforces strict separation: timestamps are strictly metadata and never participate
 * in deterministic hashing or code generation.
 */

import { POKEROGUE_UPSTREAM_CONFIG } from './PokerogueSource.js';

export function simpleSha256Fallback(str) {
  // 32-bit FNV-1a / Murmur hybrid for deterministic environments lacking crypto
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

export class PokerogueManifest {
  constructor(config = {}) {
    const pokerogue = config.pokerogue || POKEROGUE_UPSTREAM_CONFIG.pokerogue;
    const assets = config.assets || POKEROGUE_UPSTREAM_CONFIG.assets;
    const locales = config.locales || POKEROGUE_UPSTREAM_CONFIG.locales;

    this.repository = pokerogue.repository;
    this.branch = pokerogue.branch;
    this.revision = config.revision || pokerogue.revision;

    this.assetsRepository = assets.repository;
    this.assetsBranch = assets.branch;
    this.assetsRevision = config.assetsRevision || assets.revision;

    this.localesRepository = locales.repository;
    this.localesBranch = locales.branch;
    this.localesRevision = config.localesRevision || locales.revision;

    this.schemaVersion = Number(config.schemaVersion || 1);
    this.importedAt = config.importedAt || new Date().toISOString();
    this.fileHashes = { ...(config.fileHashes || {}) };
  }

  static async computeHash(content) {
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }
    // Node.js crypto check
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const crypto = await import('crypto');
        return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
      } catch (_) {
        // Fallback
      }
    }
    // Web Crypto API check
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuf));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (_) {
        // Fallback
      }
    }
    return simpleSha256Fallback(content);
  }

  async recordFileHash(filePath, content) {
    const hash = await PokerogueManifest.computeHash(content);
    this.fileHashes[filePath] = hash;
    return hash;
  }

  /**
   * Generates a 100% deterministic representation of the manifest.
   * STRICT RULE: Timestamps (importedAt) are excluded from this representation
   * to guarantee byte-for-byte reproducibility across runs.
   */
  getDeterministicExport() {
    const sortedHashes = {};
    Object.keys(this.fileHashes).sort().forEach(k => {
      sortedHashes[k] = this.fileHashes[k];
    });

    return {
      repository: this.repository,
      branch: this.branch,
      revision: this.revision,
      assetsRepository: this.assetsRepository,
      assetsBranch: this.assetsBranch,
      assetsRevision: this.assetsRevision,
      localesRepository: this.localesRepository,
      localesBranch: this.localesBranch,
      localesRevision: this.localesRevision,
      schemaVersion: this.schemaVersion,
      fileHashes: sortedHashes
    };
  }

  getDeterministicString() {
    return JSON.stringify(this.getDeterministicExport(), null, 2);
  }

  toJSON() {
    return {
      ...this.getDeterministicExport(),
      importedAt: this.importedAt
    };
  }
}
