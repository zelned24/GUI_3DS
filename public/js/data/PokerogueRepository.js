/**
 * public/js/data/PokerogueRepository.js
 * 
 * First Layer: Low-level data fetcher and cache manager for raw PokéRogue files.
 * Handles network requests, in-memory caching, and resource access.
 */

import { PokerogueSource } from './PokerogueSource.js';

export class PokerogueRepository {
  constructor(source = new PokerogueSource()) {
    this.source = source;
    this.cache = new Map();
  }

  getCacheKey(repoKey, filePath, revision = null) {
    const conf = this.source.getRepoConfig(repoKey);
    const rev = revision || conf.revision;
    return `${conf.name}:${rev}:${filePath}`;
  }

  hasInCache(repoKey, filePath, revision = null) {
    return this.cache.has(this.getCacheKey(repoKey, filePath, revision));
  }

  setCache(repoKey, filePath, content, revision = null) {
    this.cache.set(this.getCacheKey(repoKey, filePath, revision), content);
  }

  getFromCache(repoKey, filePath, revision = null) {
    return this.cache.get(this.getCacheKey(repoKey, filePath, revision));
  }

  clearCache() {
    this.cache.clear();
  }

  async getRawFile(repoKey, filePath, options = {}) {
    const cacheKey = this.getCacheKey(repoKey, filePath, options.revision);
    if (!options.bypassCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const content = await this.source.fetchRaw(repoKey, filePath, options);
    this.cache.set(cacheKey, content);
    return content;
  }

  async loadSpeciesGeneration(gen = 1, options = {}) {
    const padGen = String(gen).padStart(2, '0');
    const path = `src/data/balance/species/generation-${padGen}.ts`;
    return await this.getRawFile('pokerogue', path, options);
  }

  async loadMovesFile(options = {}) {
    return await this.getRawFile('pokerogue', 'src/data/moves/move.ts', options);
  }

  async loadAbilitiesFile(options = {}) {
    return await this.getRawFile('pokerogue', 'src/data/abilities/init-abilities.ts', options);
  }

  async loadPokemonAssetMetadata(speciesId, options = {}) {
    return await this.getRawFile('assets', `images/pokemon/${speciesId}.json`, options);
  }
}
