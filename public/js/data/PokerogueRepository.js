import { PokerogueSource, POKEROGUE_REPOSITORIES } from './PokerogueSource.js';

/**
 * PokerogueRepository - Data access layer for upstream PokéRogue source code.
 * Implements canonical in-memory caching and path resolution for generation files,
 * moves, abilities, enums, asset atlases, and localization JSON files.
 */
export class PokerogueRepository {
  constructor() {
    /** @type {Map<string, string>} */
    this.cache = new Map();
  }

  /**
   * Generates a canonical cache key: ${repo}:${revision}:${path}
   */
  getCacheKey(repoKey, filePath) {
    const config = POKEROGUE_REPOSITORIES[repoKey];
    const revision = config ? config.revision : 'unknown';
    const cleanPath = String(filePath).replace(/^\/+/, '');
    return `${repoKey}:${revision}:${cleanPath}`;
  }

  /**
   * Directly seeds the cache with content (useful for offline tests or pre-cached bundles).
   */
  setCache(repoKey, filePath, content) {
    const key = this.getCacheKey(repoKey, filePath);
    this.cache.set(key, content);
  }

  /**
   * Checks if a file is present in the local cache.
   */
  hasCache(repoKey, filePath) {
    return this.cache.has(this.getCacheKey(repoKey, filePath));
  }

  /**
   * Retrieves content from cache or fetches from upstream.
   */
  async getFile(repoKey, filePath) {
    const key = this.getCacheKey(repoKey, filePath);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const content = await PokerogueSource.fetchSourceFile(repoKey, filePath);
    this.cache.set(key, content);
    return content;
  }

  /**
   * Loads the TypeScript species file for a generation (e.g., generation-01.ts).
   * @param {number} gen 1-9
   */
  async loadSpeciesGeneration(gen = 1) {
    const padGen = String(gen).padStart(2, '0');
    const path = `src/data/balance/species/generation-${padGen}.ts`;
    return this.getFile('pokerogue', path);
  }

  /**
   * Loads the upstream moves TypeScript file.
   */
  async loadMovesFile() {
    return this.getFile('pokerogue', 'src/data/moves/move.ts');
  }

  /**
   * Loads the upstream abilities initialization TypeScript file.
   */
  async loadAbilitiesFile() {
    return this.getFile('pokerogue', 'src/data/abilities/init-abilities.ts');
  }

  /**
   * Loads upstream enum source files.
   * @param {'species'|'move'|'ability'|'type'} enumType 
   */
  async loadEnumFile(enumType) {
    const enumMap = {
      species: 'src/enums/species-id.ts',
      move: 'src/enums/move-id.ts',
      ability: 'src/enums/ability-id.ts',
      type: 'src/enums/pokemon-type.ts'
    };
    const path = enumMap[enumType];
    if (!path) {
      throw new Error(`Unknown enum type: ${enumType}`);
    }
    return this.getFile('pokerogue', path);
  }

  /**
   * Loads upstream localization JSON files from pokerogue-locales.
   * @param {string} localeCode 'en', 'es-ES', 'es-419'
   * @param {'move'|'ability'|'pokemon'|'battle'} namespace 
   */
  async loadLocaleFile(localeCode, namespace) {
    const cleanLocale = localeCode === 'es' ? 'es-ES' : (localeCode === 'en' ? 'en' : localeCode);
    const path = `${cleanLocale}/${namespace}.json`;
    return this.getFile('pokerogue-locales', path);
  }

  /**
   * Loads the TexturePacker JSON asset atlas for a Pokemon species.
   * @param {number|string} speciesId 
   */
  async loadPokemonAssetMetadata(speciesId) {
    const path = `images/pokemon/${speciesId}.json`;
    return this.getFile('pokerogue-assets', path);
  }
}
