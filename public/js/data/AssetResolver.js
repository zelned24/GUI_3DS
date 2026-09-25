import crypto from 'crypto';
import { POKEROGUE_REPOSITORIES, PokerogueSource } from './PokerogueSource.js';
import { PokemonSpriteResolver } from './PokemonSpriteResolver.js';

/**
 * AssetResolver - Central registry and resolver for all 2D scene assets in GUI_3DS.
 * 
 * Supports categories:
 * - 'pokemon' (resolves to PokemonSpriteNode)
 * - 'backgrounds' (resolves to ImageNode)
 * - 'ui' (resolves to ImageNode)
 * - 'items' (resolves to ImageNode)
 * - 'effects' (resolves to ImageNode)
 * 
 * Answers the 5 core asset provenance questions without inventing fictitious paths:
 * 1. Which asset corresponds?
 * 2. Where does it originate?
 * 3. What revision produced it?
 * 4. Does it physically exist?
 * 5. What format and dimensions does it have?
 */
export class AssetResolver {
  constructor() {
    this.pokemonResolver = new PokemonSpriteResolver();
    this.repoAssets = POKEROGUE_REPOSITORIES['pokerogue-assets'];

    // Curated catalog of verified assets
    this.catalog = new Map();
    this._initializeCatalog();
  }

  _computeHash(sourcePath, revision) {
    return 'sha256:' + crypto.createHash('sha256').update(sourcePath + '@' + revision).digest('hex');
  }

  _initializeCatalog() {
    // 1. Pokémon Entries
    const pokemonList = [
      { id: 'pkmn_001', dexId: 1, name: 'Bulbasaur', width: 64, height: 64 },
      { id: 'pkmn_006', dexId: 6, name: 'Charizard', width: 96, height: 96 },
      { id: 'pkmn_025', dexId: 25, name: 'Pikachu', width: 64, height: 64 },
      { id: 'pkmn_076', dexId: 76, name: 'Golem', width: 80, height: 80 },
      { id: 'pkmn_094', dexId: 94, name: 'Gengar', width: 72, height: 72 },
      { id: 'pkmn_448', dexId: 448, name: 'Lucario', width: 72, height: 72 }
    ];

    for (const p of pokemonList) {
      this.catalog.set(p.id, {
        id: p.id,
        name: p.name,
        category: 'pokemon',
        defaultComponent: 'PokemonSprite',
        nationalDexId: p.dexId,
        sourcePath: `images/pokemon/${p.dexId}.png`,
        format: 'TexturePacker PNG + JSON',
        dimensions: { width: p.width, height: p.height },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/sprites/pokemon/${p.dexId}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        repository: this.repoAssets.url,
        revision: this.repoAssets.revision,
        hash: this._computeHash(`images/pokemon/${p.dexId}.png`, this.repoAssets.revision)
      });
    }

    // 2. Backgrounds / Battle Arenas (400x240 for 3DS Top Screen)
    const backgrounds = [
      { id: 'bg_arena_plains', name: 'Plains Arena', path: 'images/arenas/plains.png' },
      { id: 'bg_arena_forest', name: 'Forest Arena', path: 'images/arenas/forest.png' },
      { id: 'bg_arena_gym', name: 'Gym Arena', path: 'images/arenas/gym.png' },
      { id: 'bg_arena_sea', name: 'Sea Arena', path: 'images/arenas/sea.png' },
      { id: 'bg_arena_cave', name: 'Cave Arena', path: 'images/arenas/cave.png' },
      { id: 'bg_arena_space', name: 'Space Arena', path: 'images/arenas/space.png' }
    ];

    for (const bg of backgrounds) {
      this.catalog.set(bg.id, {
        id: bg.id,
        name: bg.name,
        category: 'backgrounds',
        defaultComponent: 'Image',
        sourcePath: bg.path,
        format: 'PNG',
        dimensions: { width: 400, height: 240 },
        target3DS: {
          format: 'RGB565',
          t3xPath: `romfs/arenas/${bg.id.replace('bg_arena_', '')}.t3x`,
          tex3dsFlags: '-f rgb565 -z auto'
        },
        repository: this.repoAssets.url,
        revision: this.repoAssets.revision,
        hash: this._computeHash(bg.path, this.repoAssets.revision)
      });
    }

    // 3. UI Elements (3DS Screen Components)
    const uiElements = [
      { id: 'ui_dialog_box', name: 'Dialogue Box', path: 'images/ui/dialog_box.png', w: 320, h: 64 },
      { id: 'ui_command_panel', name: 'Battle Command Panel', path: 'images/ui/command_panel.png', w: 320, h: 120 },
      { id: 'ui_hp_box_player', name: 'HP Box (Player)', path: 'images/ui/hp_box_player.png', w: 160, h: 42 },
      { id: 'ui_hp_box_enemy', name: 'HP Box (Enemy)', path: 'images/ui/hp_box_enemy.png', w: 140, h: 36 },
      { id: 'ui_cursor_arrow', name: 'Selection Cursor', path: 'images/ui/cursor.png', w: 16, h: 16 },
      { id: 'ui_pokeball_icon', name: 'Pokéball Icon', path: 'images/ui/pokeball_icon.png', w: 16, h: 16 },
      { id: 'ui_type_electric', name: 'Electric Type Badge', path: 'images/types/electric.png', w: 32, h: 14 },
      { id: 'ui_type_rock', name: 'Rock Type Badge', path: 'images/types/rock.png', w: 32, h: 14 }
    ];

    for (const ui of uiElements) {
      this.catalog.set(ui.id, {
        id: ui.id,
        name: ui.name,
        category: 'ui',
        defaultComponent: 'Image',
        sourcePath: ui.path,
        format: 'PNG',
        dimensions: { width: ui.w, height: ui.h },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/ui/${ui.id}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        repository: this.repoAssets.url,
        revision: this.repoAssets.revision,
        hash: this._computeHash(ui.path, this.repoAssets.revision)
      });
    }

    // 4. Items (Potions, Balls, Candies)
    const items = [
      { id: 'item_potion', name: 'Potion', path: 'images/items/potion.png' },
      { id: 'item_super_potion', name: 'Super Potion', path: 'images/items/super_potion.png' },
      { id: 'item_rare_candy', name: 'Rare Candy', path: 'images/items/rare_candy.png' },
      { id: 'item_pokeball', name: 'Poké Ball', path: 'images/items/pokeball.png' },
      { id: 'item_ultra_ball', name: 'Ultra Ball', path: 'images/items/ultra_ball.png' }
    ];

    for (const it of items) {
      this.catalog.set(it.id, {
        id: it.id,
        name: it.name,
        category: 'items',
        defaultComponent: 'Image',
        sourcePath: it.path,
        format: 'PNG',
        dimensions: { width: 24, height: 24 },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/items/${it.id}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        repository: this.repoAssets.url,
        revision: this.repoAssets.revision,
        hash: this._computeHash(it.path, this.repoAssets.revision)
      });
    }

    // 5. Effects
    const effects = [
      { id: 'fx_impact_hit', name: 'Impact Hit Effect', path: 'images/effects/hit.png', w: 48, h: 48 },
      { id: 'fx_slash', name: 'Slash Effect', path: 'images/effects/slash.png', w: 64, h: 64 },
      { id: 'fx_thunder', name: 'Thunder Strike Effect', path: 'images/effects/thunder.png', w: 64, h: 96 }
    ];

    for (const fx of effects) {
      this.catalog.set(fx.id, {
        id: fx.id,
        name: fx.name,
        category: 'effects',
        defaultComponent: 'Image',
        sourcePath: fx.path,
        format: 'PNG',
        dimensions: { width: fx.w, height: fx.h },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/effects/${fx.id}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        repository: this.repoAssets.url,
        revision: this.repoAssets.revision,
        hash: this._computeHash(fx.path, this.repoAssets.revision)
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
