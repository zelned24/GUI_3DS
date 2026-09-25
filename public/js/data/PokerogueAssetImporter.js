/**
 * PokerogueAssetImporter.js
 * Imports, inspects, and normalizes real PokéRogue assets into the AssetRepository and Canonical Asset Models.
 * Preserves source formats (PNG, JSON, WAV, MP3, TTF) and extracts TexturePacker frames and audio loop metadata.
 */

import { AssetDefinition, AtlasDefinition, AudioDefinition, FontDefinition } from './CanonicalModels.js';

export class PokerogueAssetImporter {
  constructor(assetRepository) {
    this.repo = assetRepository;
  }

  detectMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'json': return 'application/json';
      case 'wav': return 'audio/wav';
      case 'mp3': return 'audio/mpeg';
      case 'ogg': return 'audio/ogg';
      case 'ttf': return 'font/ttf';
      case 'xml': return 'application/xml';
      default: return 'application/octet-stream';
    }
  }

  detectCategory(filePath) {
    const norm = filePath.replace(/\\/g, '/');
    if (norm.includes('images/pokemon/icons/')) return 'ICON';
    if (norm.includes('images/pokemon/')) return 'POKEMON_SPRITE';
    if (norm.includes('images/trainer/')) return 'TRAINER_SPRITE';
    if (norm.includes('images/ui/')) return 'UI';
    if (norm.includes('battle-anims/')) return 'BATTLE_ANIM';
    if (norm.includes('audio/cry/')) return 'AUDIO_CRY';
    if (norm.includes('audio/se/')) return 'AUDIO_SE';
    if (norm.includes('audio/bgm/')) return 'AUDIO_BGM';
    if (norm.includes('fonts/')) return 'FONT';
    return 'METADATA';
  }

  /**
   * Imports an image asset and registers its definition.
   */
  importImage(relativePath, bufferOrData = null, rawMetadata = {}) {
    const mime = this.detectMimeType(relativePath);
    const category = this.detectCategory(relativePath);
    const ext = relativePath.split('.').pop().toLowerCase();

    const assetDef = new AssetDefinition({
      id: relativePath.replace(/\\/g, '/'),
      category,
      sourcePath: relativePath.replace(/\\/g, '/'),
      targetRomFSPath: `romfs/gfx/${relativePath.replace(/^images\//, '')}`,
      extension: ext,
      mimeType: mime,
      channels: 4,
      hasAlpha: true,
      rawMetadata
    });

    this.repo.registerAsset(assetDef);
    return assetDef;
  }

  /**
   * Imports a TexturePacker JSON atlas accompanying a sprite image.
   */
  importAtlas(relativePath, jsonContent) {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    const tex = parsed.textures && parsed.textures[0] ? parsed.textures[0] : parsed;

    const atlasDef = new AtlasDefinition({
      id: relativePath.replace(/\\/g, '/'),
      imagePath: tex.image ? relativePath.replace(/[^/]+$/, tex.image) : relativePath.replace(/\.json$/, '.png'),
      format: tex.format || 'RGBA8888',
      width: tex.size?.w || 0,
      height: tex.size?.h || 0,
      scale: tex.scale || 1,
      frames: tex.frames || []
    });

    this.repo.registerAtlas(atlasDef);
    return atlasDef;
  }

  /**
   * Imports an audio file definition.
   */
  importAudio(relativePath, durationSeconds = 1.0, loopPoints = null) {
    const category = this.detectCategory(relativePath);
    const ext = relativePath.split('.').pop().toLowerCase();

    const audioDef = new AudioDefinition({
      id: relativePath.replace(/\\/g, '/'),
      category,
      sourcePath: relativePath.replace(/\\/g, '/'),
      targetRomFSPath: `romfs/audio/${relativePath.replace(/^audio\//, '')}`,
      durationSeconds,
      loopPoints,
      format: ext
    });

    const assetDef = new AssetDefinition({
      id: audioDef.id,
      category,
      sourcePath: audioDef.sourcePath,
      targetRomFSPath: audioDef.targetRomFSPath,
      extension: ext,
      mimeType: this.detectMimeType(relativePath)
    });

    this.repo.registerAsset(assetDef);
    return audioDef;
  }

  /**
   * Imports font metadata.
   */
  importFont(relativePath, type = 'TTF') {
    const ext = relativePath.split('.').pop().toLowerCase();
    const fontDef = new FontDefinition({
      id: relativePath.replace(/\\/g, '/'),
      sourcePath: relativePath.replace(/\\/g, '/'),
      targetRomFSPath: `romfs/fonts/${relativePath.replace(/^fonts\//, '')}`,
      type
    });

    const assetDef = new AssetDefinition({
      id: fontDef.id,
      category: 'FONT',
      sourcePath: fontDef.sourcePath,
      targetRomFSPath: fontDef.targetRomFSPath,
      extension: ext,
      mimeType: this.detectMimeType(relativePath)
    });

    this.repo.registerAsset(assetDef);
    return fontDef;
  }

  /**
   * Imports auxiliary JSON metadata (e.g. starter-colors.json, exp-sprites.json).
   */
  importMetadata(key, jsonContent) {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    this.repo.setMetadata(key, parsed);
    return parsed;
  }
}
