/**
 * PokerogueManifest - Canonical manifest of imported upstream PokéRogue data.
 * Records source provenance, commit revisions, schema versions, and SHA-256 hashes.
 * Implements deterministic export with sorted keys and excluded volatile timestamps.
 */

// Pure-JS SHA-256 implementation for synchronous cross-platform determinism
function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }

  for (j = 0; j < words[lengthProperty]; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? (w[i] || 0) : (
            (w[i - 16] || 0)
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + (w[i - 7] || 0)
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0
        );
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

export class PokerogueManifest {
  /**
   * @param {Object} [data]
   */
  constructor(data = {}) {
    this.schemaVersion = data.schemaVersion || '1.0.0';
    this.target = data.target || 'Nintendo 3DS';
    /** @type {Record<string, Object>} */
    this.files = { ...(data.files || {}) };
    /** @type {Record<string, Object>} */
    this.entities = { ...(data.entities || {}) };
  }

  /**
   * Computes SHA-256 for a given text content.
   */
  static computeHash(content) {
    return sha256Sync(typeof content === 'string' ? content : JSON.stringify(content));
  }

  /**
   * Records a file provenance entry.
   */
  recordFile(repoKey, revision, sourcePath, content, extra = {}) {
    const key = `${repoKey}:${sourcePath}`;
    const hash = typeof content === 'string' ? PokerogueManifest.computeHash(content) : (content?.hash || 'unhashed');
    this.files[key] = {
      repository: repoKey,
      revision,
      sourcePath,
      hash,
      schemaVersion: this.schemaVersion,
      ...extra
    };
    return this.files[key];
  }

  /**
   * Records an entity provenance entry (Species, Move, Ability).
   */
  recordEntity(entityType, entityId, provenance) {
    const key = `${entityType}:${entityId}`;
    this.entities[key] = {
      entityType,
      entityId,
      repository: provenance.repository || 'pokerogue',
      revision: provenance.revision || 'unknown',
      sourcePath: provenance.sourcePath || '',
      hash: provenance.hash || '',
      schemaVersion: this.schemaVersion
    };
  }

  /**
   * Produces a 100% deterministic, reproducible export:
   * - Sorted dictionary keys.
   * - Excludes volatile runtime timestamps.
   */
  getDeterministicExport() {
    function sortObject(obj) {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
      }
      const sorted = {};
      const keys = Object.keys(obj).sort();
      for (const k of keys) {
        if (k === 'importedAt' || k === 'timestamp') continue; // Exclude volatile fields
        sorted[k] = sortObject(obj[k]);
      }
      return sorted;
    }

    const payload = {
      schemaVersion: this.schemaVersion,
      target: this.target,
      files: this.files,
      entities: this.entities
    };

    return JSON.stringify(sortObject(payload), null, 2);
  }
}
