import { PokerogueManifest } from './PokerogueManifest.js';
import { POKEROGUE_REPOSITORIES } from './PokerogueSource.js';
import { SourceMetadata } from './CanonicalModels.js';

/**
 * PokerogueLocalePackage - Stores localized strings for a specific language and namespace.
 * Namespace examples: 'move', 'ability', 'pokemon', 'battle'.
 */
export class PokerogueLocalePackage {
  constructor(localeCode, namespace, sourcePath = '', repoKey = 'pokerogue-locales') {
    this.localeCode = localeCode; // 'en', 'es', 'es-ES', 'es-419'
    this.namespace = namespace;   // 'move', 'ability', 'pokemon', 'battle'
    this.sourcePath = sourcePath;
    this.repoKey = repoKey;
    this.entries = new Map();     // key -> string | object
    this.provenance = null;
    this.sourceHash = null;
  }

  set(key, value) {
    this.entries.set(String(key).toLowerCase(), value);
  }

  get(key) {
    return this.entries.get(String(key).toLowerCase()) || null;
  }

  has(key) {
    return this.entries.has(String(key).toLowerCase());
  }

  size() {
    return this.entries.size;
  }
}

/**
 * PokerogueLocaleImporter - Imports and canonicalizes upstream i18n JSON packages.
 * Reads real files from pokerogue-locales (e.g. en/move.json, es-ES/move.json, etc.).
 * Preserves upstream structure while normalizing keys for cross-lingual query access.
 */
export class PokerogueLocaleImporter {
  constructor() {
    this.manifest = new PokerogueManifest();
    this.packages = new Map(); // `${locale}:${namespace}` -> PokerogueLocalePackage
  }

  /**
   * Helper to normalize locale codes (e.g. 'es' -> 'es-ES')
   */
  static normalizeLocaleCode(code) {
    const c = String(code || 'en').toLowerCase().trim();
    if (c === 'es' || c === 'es-es') return 'es-ES';
    if (c === 'en' || c === 'en-us') return 'en';
    if (c === 'es-419') return 'es-419';
    return code;
  }

  /**
   * Parses JSON string into a canonical PokerogueLocalePackage.
   * @param {string|object} jsonContent
   * @param {string} localeCode e.g. 'en', 'es-ES'
   * @param {string} namespace e.g. 'move', 'ability', 'pokemon', 'battle'
   * @param {string} sourcePath e.g. 'es-ES/move.json'
   * @param {string} [repoKey='pokerogue-locales']
   * @returns {PokerogueLocalePackage}
   */
  parseLocale(jsonContent, localeCode, namespace, sourcePath = '', repoKey = 'pokerogue-locales') {
    const normLocale = PokerogueLocaleImporter.normalizeLocaleCode(localeCode);
    const repoInfo = POKEROGUE_REPOSITORIES[repoKey] || {
      revision: 'unknown',
      license: 'AGPL-v3.0-only'
    };

    let rawData;
    let rawText = '';
    if (typeof jsonContent === 'string') {
      rawText = jsonContent;
      try {
        rawData = JSON.parse(jsonContent);
      } catch (err) {
        throw new Error(`Failed to parse JSON for locale [${normLocale}:${namespace}] at ${sourcePath}: ${err.message}`);
      }
    } else if (typeof jsonContent === 'object' && jsonContent !== null) {
      rawData = jsonContent;
      rawText = JSON.stringify(jsonContent);
    } else {
      throw new Error(`Invalid JSON content provided for locale [${normLocale}:${namespace}].`);
    }

    const fileHash = PokerogueManifest.computeHash(rawText);
    this.manifest.recordFile(repoKey, repoInfo.revision, sourcePath, rawText);

    const pkg = new PokerogueLocalePackage(normLocale, namespace, sourcePath, repoKey);
    pkg.provenance = new SourceMetadata({
      source: repoKey,
      sourcePath,
      sourceRevision: repoInfo.revision,
      importedAt: 'CANONICAL_LOCALE_IMPORT',
      license: repoInfo.license
    });
    pkg.sourceHash = fileHash;

    // Ingest all entries
    for (const [key, val] of Object.entries(rawData)) {
      pkg.set(key, val);
    }

    const pkgKey = `${normLocale}:${namespace}`;
    this.packages.set(pkgKey, pkg);
    return pkg;
  }

  getPackage(localeCode, namespace) {
    const normLocale = PokerogueLocaleImporter.normalizeLocaleCode(localeCode);
    return this.packages.get(`${normLocale}:${namespace}`) || null;
  }

  /**
   * Retrieves localized text for an entity.
   * Handles both plain strings (pokemon.json) and structured objects (move.json -> { name, effect }).
   * @param {string} namespace 'move' | 'ability' | 'pokemon' | 'battle'
   * @param {string} id Entity identifier e.g. 'thunderbolt' or 'tackle'
   * @param {string} field Field name e.g. 'name', 'effect', 'description'
   * @param {string} [locale='en']
   * @returns {string|null}
   */
  getText(namespace, id, field = 'name', locale = 'en') {
    const normLocale = PokerogueLocaleImporter.normalizeLocaleCode(locale);
    const pkg = this.getPackage(normLocale, namespace);
    if (!pkg) return null;

    const entry = pkg.get(id);
    if (!entry) return null;

    if (typeof entry === 'string') {
      return entry;
    }
    if (typeof entry === 'object' && entry !== null) {
      return entry[field] || entry.name || null;
    }
    return null;
  }
}
