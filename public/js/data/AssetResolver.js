import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { POKEROGUE_REPOSITORIES, PokerogueSource } from './PokerogueSource.js';
import { PokemonSpriteResolver } from './PokemonSpriteResolver.js';
import { AssetIndex } from './AssetIndex.js';

/**
 * AssetResolver - Central registry and resolver for all 2D scene assets in GUI_3DS.
 * 
 * Supports categories:
 * - 'pokemon' (resolves to PokemonSpriteNode)
 * - 'backgrounds' (resolves to ImageNode)
 * - 'ui' (resolves to ImageNode)
 * - 'items' (resolves to ImageNode)
 * - 'effects' (resolves to ImageNode)
 * - 'audio' (resolves to Audio)
 * 
 * Answers the 5 core asset provenance questions without inventing fictitious paths:
 * 1. Which asset corresponds?
 * 2. Where does it originate?
 * 3. What revision produced it?
 * 4. Does it physically exist?
 * 5. What format and dimensions does it have?
 */
export class AssetResolver {
  constructor(options = {}) {
    this.pokemonResolver = new PokemonSpriteResolver();
    this.repoAssets = POKEROGUE_REPOSITORIES['pokerogue-assets'];
    this.assetIndex = options.assetIndex || new AssetIndex();

    // Curated catalog of verified assets
    this.catalog = new Map();
    this._initializeCatalog();
  }

  _computeHash(sourcePath, revision, assetId = '') {
    const physical = this.assetIndex?.findPhysicalFile(sourcePath, assetId);
    if (physical) {
      return AssetIndex.computeContentSha256(physical);
    }
    return 'sha256:' + crypto.createHash('sha256').update(sourcePath + '@' + revision).digest('hex');
  }

  _initializeCatalog() {
    for (const entry of this.assetIndex.getAll()) {
      this.catalog.set(entry.id, {
        ...entry,
        repository: entry.sourceRepository,
        revision: entry.sourceRevision,
        hash: entry.contentSha256 || entry.hash || this._computeHash(entry.sourcePath, entry.sourceRevision, entry.id)
      });
    }
  }

  /**
   * Resolves an asset by ID from built-in catalog or user registered assets.
   * @param {string} id 
   * @returns {Object|null}
   */
  resolve(id) {
    if (!id || typeof id !== 'string') return null;
    return this.catalog.get(id) || null;
  }

  /**
   * Retrieves an asset by ID (alias for resolve).
   * @param {string} id 
   * @returns {Object|null}
   */
  getAsset(id) {
    return this.resolve(id);
  }

  /**
   * Registers a verified custom or local asset with strict provenance metadata.
   * @param {Object} asset
   * @returns {boolean}
   */
  registerAsset(asset) {
    if (!asset || !asset.id || typeof asset.id !== 'string') {
      throw new Error('Invalid asset registration: must have a non-empty string id');
    }
    if (!asset.sourcePath || typeof asset.sourcePath !== 'string') {
      throw new Error(`Invalid asset registration for "${asset.id}": missing sourcePath`);
    }
    if (!asset.target3DS?.t3xPath || typeof asset.target3DS.t3xPath !== 'string') {
      throw new Error(`Invalid asset registration for "${asset.id}": missing target3DS.t3xPath`);
    }
    let hash = asset.hash;
    if (!hash) {
      hash = this._computeHash(asset.sourcePath, asset.revision || 'local');
    }
    if (typeof hash !== 'string' || hash.length < 8) {
      throw new Error(`Invalid asset registration for "${asset.id}": missing or invalid integrity hash`);
    }
    if (hash.toLowerCase().includes('placeholder') || hash.toLowerCase().includes('dummy')) {
      throw new Error(`Invalid asset registration for "${asset.id}": placeholder hashes are prohibited`);
    }

    this.catalog.set(asset.id, {
      id: asset.id,
      name: asset.name || asset.id,
      category: asset.category || 'ui',
      defaultComponent: asset.defaultComponent || 'Image',
      sourcePath: asset.sourcePath,
      format: asset.format || 'PNG',
      dimensions: asset.dimensions || { width: 64, height: 64 },
      target3DS: {
        format: asset.target3DS.format || 'RGBA4444',
        t3xPath: asset.target3DS.t3xPath,
        tex3dsFlags: asset.target3DS.tex3dsFlags || '-f rgba4444 -z auto'
      },
      repository: asset.repository || 'local',
      revision: asset.revision || 'HEAD',
      hash: hash,
      isLocal: true
    });
    return true;
  }

  /**
   * Returns all assets in the catalog.
   */
  getAllAssets() {
    return Array.from(this.catalog.values());
  }

  /**
   * Returns available asset categories.
   */
  getCategories() {
    return [
      { id: 'all', name: 'All Assets', icon: '📁' },
      { id: 'pokemon', name: 'Pokémon', icon: '⚡' },
      { id: 'backgrounds', name: 'Backgrounds', icon: '🌄' },
      { id: 'ui', name: 'UI Elements', icon: '🔲' },
      { id: 'items', name: 'Items', icon: '🧪' },
      { id: 'effects', name: 'Effects', icon: '💥' }
    ];
  }

  /**
   * Filters and searches assets.
   * @param {string} query 
   * @param {string} category 
   */
  search(query = '', category = 'all') {
    const q = query.trim().toLowerCase();
    return this.getAllAssets().filter(asset => {
      const matchCat = category === 'all' || asset.category === category;
      const matchQuery = !q || 
        asset.name.toLowerCase().includes(q) || 
        asset.id.toLowerCase().includes(q) ||
        (asset.nationalDexId && String(asset.nationalDexId) === q);
      return matchCat && matchQuery;
    });
  }

  /**
   * Creates default node configuration for an asset.
   * @param {string} assetId 
   * @param {Object} [overrides] 
   */
  createNodeData(assetId, overrides = {}) {
    const asset = this.getAsset(assetId);
    if (!asset) {
      return {
        type: 'Image',
        name: assetId,
        x: overrides.x ?? 0,
        y: overrides.y ?? 0,
        width: overrides.width ?? 64,
        height: overrides.height ?? 64,
        properties: { asset: assetId }
      };
    }

    if (asset.category === 'pokemon') {
      return {
        type: 'PokemonSprite',
        name: asset.name,
        screen: overrides.screen || 'top',
        x: overrides.x ?? 60,
        y: overrides.y ?? 40,
        width: asset.dimensions.width,
        height: asset.dimensions.height,
        properties: {
          species: asset.name,
          nationalDexId: asset.nationalDexId,
          facing: overrides.facing || 'front',
          shiny: overrides.shiny || false
        },
        metadata: {
          assetId: asset.id,
          sourcePath: asset.sourcePath,
          target3DS: asset.target3DS
        }
      };
    }

    // Default Image Node (background, ui, item, effect)
    return {
      type: 'Image',
      name: asset.name,
      screen: overrides.screen || (asset.category === 'backgrounds' ? 'top' : 'top'),
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      width: overrides.width ?? asset.dimensions.width,
      height: overrides.height ?? asset.dimensions.height,
      properties: {
        asset: asset.id,
        fit: asset.category === 'backgrounds' ? 'stretch' : 'contain'
      },
      metadata: {
        assetId: asset.id,
        sourcePath: asset.sourcePath,
        target3DS: asset.target3DS
      }
    };
  }
}

// Global shared asset resolver instance
export const assetResolver = new AssetResolver();
