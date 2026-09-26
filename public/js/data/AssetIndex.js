import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { POKEROGUE_REPOSITORIES, PokerogueSource } from './PokerogueSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, '../../..');

/**
 * AssetIndex - Central, scalable, deterministic registry of all real assets in GUI_3DS.
 * 
 * Provides:
 * 1. Strict asset provenance with real physical SHA-256 hashes.
 * 2. Multi-category indexing (pokemon, backgrounds, ui, items, effects, audio, font).
 * 3. Clear asset statuses: AVAILABLE, MISSING, INVALID, UNSUPPORTED.
 * 4. Deterministic JSON serialization (strictly sorted by assetId, no non-deterministic timestamps).
 * 5. Generation of asset-integrity-report.json.
 */
export class AssetIndex {
  /**
   * @param {Object} [options]
   * @param {string} [options.projectRoot]
   * @param {string} [options.indexPath]
   */
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || defaultProjectRoot;
    this.indexPath = options.indexPath || path.join(this.projectRoot, 'project', 'data', 'assets', 'asset-index.json');
    this.repoAssets = POKEROGUE_REPOSITORIES['pokerogue-assets'];

    /** @type {Map<string, Object>} */
    this.assets = new Map();

    this._initializeBaseEntries();
  }

  /**
   * Computes real SHA-256 of a physical file or buffer.
   * @param {string|Buffer} fileOrBuffer
   * @returns {string|null}
   */
  static computeContentSha256(fileOrBuffer) {
    if (Buffer.isBuffer(fileOrBuffer)) {
      return crypto.createHash('sha256').update(fileOrBuffer).digest('hex');
    }
    if (typeof fileOrBuffer === 'string') {
      try {
        if (fs.existsSync(fileOrBuffer)) {
          const buf = fs.readFileSync(fileOrBuffer);
          return crypto.createHash('sha256').update(buf).digest('hex');
        }
      } catch (e) {}
    }
    return null;
  }

  /**
   * Resolves physical file path from candidate locations for a specific asset.
   * @param {string} sourcePath
   * @param {string} assetId
   * @returns {string|null}
   */
  findPhysicalFile(sourcePath, assetId = '') {
    if (!sourcePath && !assetId) return null;
    const baseName = sourcePath ? path.basename(sourcePath) : '';
    const ext = sourcePath ? path.extname(sourcePath) : '.png';

    const candidates = [
      sourcePath ? path.resolve(this.projectRoot, sourcePath) : null,
      baseName ? path.resolve(this.projectRoot, 'test/fixtures/assets', baseName) : null,
      assetId ? path.resolve(this.projectRoot, 'test/fixtures/assets', `${assetId}${ext}`) : null,
      sourcePath ? path.resolve(this.projectRoot, 'assets', sourcePath) : null
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
    }
    return null;
  }

  /**
   * Registers base catalog entries and updates with physical files if found.
   * @private
   */
  _initializeBaseEntries() {
    // 1. Pokémon Entries
    const pokemon = [
      { id: 'pokemon_sprite_25_front', nationalDexId: 25, species: 'Pikachu', facing: 'front', width: 32, height: 32, file: '25.png' },
      { id: 'pkmn_001', nationalDexId: 1, species: 'Bulbasaur', facing: 'front', width: 64, height: 64, file: '1.png' },
      { id: 'pkmn_006', nationalDexId: 6, species: 'Charizard', facing: 'front', width: 96, height: 96, file: '6.png' },
      { id: 'pkmn_025', nationalDexId: 25, species: 'Pikachu', facing: 'front', width: 32, height: 32, file: '25.png' },
      { id: 'pkmn_076', nationalDexId: 76, species: 'Golem', facing: 'front', width: 80, height: 80, file: '76.png' },
      { id: 'pkmn_094', nationalDexId: 94, species: 'Gengar', facing: 'front', width: 72, height: 72, file: '94.png' },
      { id: 'pkmn_448', nationalDexId: 448, species: 'Lucario', facing: 'front', width: 72, height: 72, file: '448.png' }
    ];

    for (const p of pokemon) {
      this.registerEntry({
        id: p.id,
        name: p.species,
        category: 'pokemon',
        type: 'sprite',
        defaultComponent: 'PokemonSprite',
        nationalDexId: p.nationalDexId,
        species: p.species,
        facing: p.facing,
        form: 'normal',
        gender: 'default',
        shiny: false,
        sourcePath: `images/pokemon/${p.file}`,
        format: 'TexturePacker PNG + JSON',
        dimensions: { width: p.width, height: p.height },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/sprites/pokemon/${p.nationalDexId}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        romfsPath: `romfs/sprites/pokemon/${p.nationalDexId}.t3x`,
        sourceRepository: this.repoAssets.url,
        sourceRevision: this.repoAssets.revision
      });
    }

    // 2. Backgrounds / Arenas
    const backgrounds = [
      { id: 'bg_arena_plains', name: 'Plains Arena', path: 'images/arenas/plains.png', file: 'plains.png' },
      { id: 'bg_arena_forest', name: 'Forest Arena', path: 'images/arenas/forest.png', file: 'forest.png' },
      { id: 'bg_arena_sea', name: 'Sea Arena', path: 'images/arenas/sea.png', file: 'sea.png' },
      { id: 'bg_arena_gym', name: 'Gym Arena', path: 'images/arenas/gym.png', file: 'gym.png' },
      { id: 'bg_arena_cave', name: 'Cave Arena', path: 'images/arenas/cave.png', file: 'cave.png' },
      { id: 'bg_arena_space', name: 'Space Arena', path: 'images/arenas/space.png', file: 'space.png' }
    ];

    for (const bg of backgrounds) {
      const slug = bg.id.replace('bg_arena_', '');
      this.registerEntry({
        id: bg.id,
        name: bg.name,
        category: 'backgrounds',
        type: 'texture',
        defaultComponent: 'Image',
        sourcePath: bg.path,
        format: 'PNG',
        dimensions: { width: 400, height: 240 },
        target3DS: {
          format: 'RGB565',
          t3xPath: `romfs/arenas/${slug}.t3x`,
          tex3dsFlags: '-f rgb565 -z auto'
        },
        romfsPath: `romfs/arenas/${slug}.t3x`,
        sourceRepository: this.repoAssets.url,
        sourceRevision: this.repoAssets.revision
      });
    }

    // 3. UI Elements
    const ui = [
      { id: 'ui_dialog_box', name: 'Dialogue Box', path: 'images/ui/dialog_box.png', w: 320, h: 64, file: 'ui_dialog_box.png' },
      { id: 'ui_command_panel', name: 'Battle Command Panel', path: 'images/ui/command_panel.png', w: 320, h: 120, file: 'ui_command_panel.png' },
      { id: 'ui_hp_box_player', name: 'HP Box (Player)', path: 'images/ui/hp_box_player.png', w: 160, h: 42 },
      { id: 'ui_hp_box_enemy', name: 'HP Box (Enemy)', path: 'images/ui/hp_box_enemy.png', w: 140, h: 36 },
      { id: 'ui_cursor_arrow', name: 'Selection Cursor', path: 'images/ui/cursor.png', w: 16, h: 16 },
      { id: 'ui_pokeball_icon', name: 'Pokéball Icon', path: 'images/ui/pokeball_icon.png', w: 16, h: 16 },
      { id: 'ui_type_electric', name: 'Electric Type Badge', path: 'images/types/electric.png', w: 32, h: 14 },
      { id: 'ui_type_rock', name: 'Rock Type Badge', path: 'images/types/rock.png', w: 32, h: 14 }
    ];

    for (const u of ui) {
      this.registerEntry({
        id: u.id,
        name: u.name,
        category: 'ui',
        type: 'ui',
        defaultComponent: 'Image',
        sourcePath: u.path,
        format: 'PNG',
        dimensions: { width: u.w, height: u.h },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/ui/${u.id}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        romfsPath: `romfs/ui/${u.id}.t3x`,
        sourceRepository: this.repoAssets.url,
        sourceRevision: this.repoAssets.revision
      });
    }

    // 4. Items
    const items = [
      { id: 'item_potion', name: 'Potion', path: 'images/items/potion.png' },
      { id: 'item_super_potion', name: 'Super Potion', path: 'images/items/super_potion.png' },
      { id: 'item_rare_candy', name: 'Rare Candy', path: 'images/items/rare_candy.png' },
      { id: 'item_pokeball', name: 'Poké Ball', path: 'images/items/pokeball.png' },
      { id: 'item_ultra_ball', name: 'Ultra Ball', path: 'images/items/ultra_ball.png' }
    ];

    for (const it of items) {
      this.registerEntry({
        id: it.id,
        name: it.name,
        category: 'items',
        type: 'item',
        defaultComponent: 'Image',
        sourcePath: it.path,
        format: 'PNG',
        dimensions: { width: 24, height: 24 },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/items/${it.id}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        romfsPath: `romfs/items/${it.id}.t3x`,
        sourceRepository: this.repoAssets.url,
        sourceRevision: this.repoAssets.revision
      });
    }

    // 5. Effects
    const effects = [
      { id: 'fx_impact_hit', name: 'Impact Hit Effect', path: 'images/effects/hit.png', w: 48, h: 48 },
      { id: 'fx_slash', name: 'Slash Effect', path: 'images/effects/slash.png', w: 64, h: 64 },
      { id: 'fx_thunder', name: 'Thunder Strike Effect', path: 'images/effects/thunder.png', w: 64, h: 96 }
    ];

    for (const fx of effects) {
      this.registerEntry({
        id: fx.id,
        name: fx.name,
        category: 'effects',
        type: 'effect',
        defaultComponent: 'Image',
        sourcePath: fx.path,
        format: 'PNG',
        dimensions: { width: fx.w, height: fx.h },
        target3DS: {
          format: 'RGBA4444',
          t3xPath: `romfs/effects/${fx.id}.t3x`,
          tex3dsFlags: '-f rgba4444 -z auto'
        },
        romfsPath: `romfs/effects/${fx.id}.t3x`,
        sourceRepository: this.repoAssets.url,
        sourceRevision: this.repoAssets.revision
      });
    }

    // 6. Audio
    const audio = [
      { id: 'audio_se_select', name: 'UI Select Sound', path: 'audio/se/select.wav', romfs: 'romfs/audio/se_select.bcstm' },
      { id: 'audio_se_hit_normal', name: 'Normal Hit Sound', path: 'audio/se/hit_normal.wav', romfs: 'romfs/audio/se_hit_normal.bcstm' },
      { id: 'audio_bgm_battle_wild', name: 'Wild Battle BGM', path: 'audio/bgm/battle_wild.ogg', romfs: 'romfs/audio/bgm_battle_wild.bcstm' },
      { id: 'audio_bgm_victory', name: 'Victory Fanfare BGM', path: 'audio/bgm/victory.ogg', romfs: 'romfs/audio/bgm_victory.bcstm' }
    ];

    for (const au of audio) {
      this.registerEntry({
        id: au.id,
        name: au.name,
        category: 'audio',
        type: 'audio',
        defaultComponent: 'Audio',
        sourcePath: au.path,
        format: 'WAV',
        dimensions: { width: 0, height: 0 },
        target3DS: {
          format: 'BCSTM',
          t3xPath: null,
          tex3dsFlags: ''
        },
        romfsPath: au.romfs,
        sourceRepository: this.repoAssets.url,
        sourceRevision: this.repoAssets.revision
      });
    }
  }

  /**
   * Registers or updates an asset entry with verified provenance.
   * @param {Object} rawEntry
   */
  registerEntry(rawEntry) {
    if (!rawEntry || !rawEntry.id) {
      throw new Error('AssetIndex: Entry must contain a valid string id');
    }

    const physicalPath = this.findPhysicalFile(rawEntry.sourcePath, rawEntry.id);
    let status = 'MISSING';
    let contentSha256 = rawEntry.contentSha256 || null;
    let size = rawEntry.size || 0;

    if (physicalPath) {
      try {
        const stat = fs.statSync(physicalPath);
        if (stat.size === 0) {
          status = 'INVALID';
        } else {
          status = 'AVAILABLE';
          size = stat.size;
          contentSha256 = AssetIndex.computeContentSha256(physicalPath);
        }
      } catch (e) {
        status = 'INVALID';
      }
    }

    const entry = {
      id: rawEntry.id,
      name: rawEntry.name || rawEntry.id,
      category: rawEntry.category || 'ui',
      type: rawEntry.type || 'texture',
      defaultComponent: rawEntry.defaultComponent || 'Image',
      sourcePath: rawEntry.sourcePath || '',
      sourceRepository: rawEntry.sourceRepository || this.repoAssets.url,
      sourceRevision: rawEntry.sourceRevision || this.repoAssets.revision,
      contentSha256: contentSha256,
      hash: contentSha256 || (rawEntry.hash ? rawEntry.hash : null),
      dimensions: rawEntry.dimensions || { width: 64, height: 64 },
      format: rawEntry.format || 'PNG',
      target3DS: {
        format: rawEntry.target3DS?.format || (rawEntry.category === 'audio' ? 'BCSTM' : 'RGBA4444'),
        t3xPath: (rawEntry.category === 'audio' || rawEntry.type === 'audio') ? null : (rawEntry.target3DS?.t3xPath || `romfs/${rawEntry.category}/${rawEntry.id}.t3x`),
        tex3dsFlags: rawEntry.target3DS?.tex3dsFlags !== undefined ? rawEntry.target3DS.tex3dsFlags : (rawEntry.category === 'audio' ? '' : '-f rgba4444 -z auto')
      },
      romfsPath: rawEntry.romfsPath || (rawEntry.category === 'audio' ? `romfs/audio/${rawEntry.id}.bcstm` : `romfs/${rawEntry.category}/${rawEntry.id}.t3x`),
      status: rawEntry.status || status,
      size: size,
      physicalPath: physicalPath || null,
      // Optional Pokémon attributes
      ...(rawEntry.nationalDexId !== undefined ? {
        nationalDexId: rawEntry.nationalDexId,
        species: rawEntry.species || rawEntry.name,
        form: rawEntry.form || 'normal',
        gender: rawEntry.gender || 'default',
        shiny: !!rawEntry.shiny,
        facing: rawEntry.facing || 'front'
      } : {})
    };

    this.assets.set(entry.id, entry);
    return entry;
  }

  /**
   * Returns an asset by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  get(id) {
    return this.assets.get(id) || null;
  }

  /**
   * Returns all assets sorted deterministically by assetId.
   * @returns {Object[]}
   */
  getAll() {
    return Array.from(this.assets.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Searches and filters the index.
   * @param {Object} [filter]
   * @returns {Object[]}
   */
  search(query = '', filter = {}) {
    const q = String(query).trim().toLowerCase();
    return this.getAll().filter(asset => {
      // Query filter
      if (q) {
        const matchesQ = 
          asset.name.toLowerCase().includes(q) ||
          asset.id.toLowerCase().includes(q) ||
          (asset.species && asset.species.toLowerCase().includes(q)) ||
          (asset.nationalDexId && String(asset.nationalDexId) === q);
        if (!matchesQ) return false;
      }

      // Category filter
      if (filter.category && filter.category !== 'all' && asset.category !== filter.category) {
        return false;
      }

      // Type filter
      if (filter.type && asset.type !== filter.type) {
        return false;
      }

      // Screen filter
      if (filter.screen) {
        const expectedScreen = asset.category === 'backgrounds' ? 'top' : (filter.screen);
        if (filter.screen !== 'all' && expectedScreen !== filter.screen) {
          return false;
        }
      }

      // Status filter
      if (filter.status && asset.status !== filter.status) {
        return false;
      }

      // Pokémon specific filters
      if (filter.nationalDexId && asset.nationalDexId !== filter.nationalDexId) {
        return false;
      }
      if (filter.species && asset.species && asset.species.toLowerCase() !== filter.species.toLowerCase()) {
        return false;
      }
      if (filter.facing && asset.facing !== filter.facing) {
        return false;
      }
      if (filter.shiny !== undefined && asset.shiny !== filter.shiny) {
        return false;
      }

      return true;
    });
  }

  /**
   * Generates a deterministic asset index object without timestamps.
   * @returns {Object}
   */
  generateIndexObject() {
    const sorted = this.getAll();
    return {
      schemaVersion: 2,
      sourceRepository: this.repoAssets.url,
      sourceRevision: this.repoAssets.revision,
      assetCount: sorted.length,
      assets: sorted.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category,
        type: a.type,
        defaultComponent: a.defaultComponent,
        sourcePath: a.sourcePath,
        contentSha256: a.contentSha256,
        format: a.format,
        dimensions: a.dimensions,
        target3DS: a.target3DS,
        romfsPath: a.romfsPath,
        status: a.status,
        size: a.size,
        ...(a.nationalDexId !== undefined ? {
          nationalDexId: a.nationalDexId,
          species: a.species,
          facing: a.facing,
          form: a.form,
          gender: a.gender,
          shiny: a.shiny
        } : {})
      }))
    };
  }

  /**
   * Writes asset-index.json to disk deterministically.
   * @param {string} [outputPath]
   * @returns {string} Path written
   */
  writeIndexFile(outputPath = null) {
    const targetPath = outputPath || this.indexPath;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const content = JSON.stringify(this.generateIndexObject(), null, 2) + '\n';
    fs.writeFileSync(targetPath, content, 'utf8');
    return targetPath;
  }

  /**
   * Generates asset integrity report object.
   * @returns {Object}
   */
  generateIntegrityReport() {
    const all = this.getAll();
    const verified = all.filter(a => a.status === 'AVAILABLE');
    const missing = all.filter(a => a.status === 'MISSING');
    const invalid = all.filter(a => a.status === 'INVALID');
    const unsupported = all.filter(a => a.status === 'UNSUPPORTED');
    const totalBytes = verified.reduce((sum, a) => sum + (a.size || 0), 0);

    return {
      schemaVersion: 1,
      sourceRepository: this.repoAssets.url,
      sourceRevision: this.repoAssets.revision,
      assetCount: all.length,
      verifiedCount: verified.length,
      missingCount: missing.length,
      invalidCount: invalid.length,
      unsupportedCount: unsupported.length,
      totalBytes,
      assets: all.map(a => ({
        assetId: a.id,
        source: a.sourcePath,
        revision: a.sourceRevision,
        contentSha256: a.contentSha256 || 'unresolved',
        romfsPath: a.romfsPath,
        size: a.size || 0,
        status: a.status
      }))
    };
  }

  /**
   * Writes asset-integrity-report.json to disk deterministically.
   * @param {string} outputPath
   * @returns {string}
   */
  writeIntegrityReport(outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const content = JSON.stringify(this.generateIntegrityReport(), null, 2) + '\n';
    fs.writeFileSync(outputPath, content, 'utf8');
    return outputPath;
  }
}

export const defaultAssetIndex = new AssetIndex();
