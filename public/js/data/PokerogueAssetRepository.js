/**
 * PokerogueAssetRepository.js
 * In-memory index and physical asset manager for PokéRogue resources.
 */

import { AssetDefinition, AtlasDefinition, SpriteDefinition } from './CanonicalModels.js';

export class PokerogueAssetRepository {
  constructor() {
    this.assets = new Map(); // relativePath -> AssetDefinition
    this.atlases = new Map(); // relativePath -> AtlasDefinition
    this.sprites = new Map(); // spriteKey -> SpriteDefinition
    this.metadata = {}; // auxiliary metadata like exp-sprites, starter-colors
  }

  hasAsset(relativePath) {
    if (!relativePath) return false;
    const clean = relativePath.replace(/\\/g, '/');
    return this.assets.has(clean);
  }

  getAsset(relativePath) {
    if (!relativePath) return null;
    const clean = relativePath.replace(/\\/g, '/');
    return this.assets.get(clean) || null;
  }

  registerAsset(assetDef) {
    if (!assetDef) return;
    this.assets.set(assetDef.sourcePath.replace(/\\/g, '/'), assetDef);
  }

  registerAtlas(atlasDef) {
    if (!atlasDef) return;
    this.atlases.set(atlasDef.imagePath.replace(/\\/g, '/'), atlasDef);
  }

  getAtlas(imagePath) {
    return this.atlases.get(imagePath.replace(/\\/g, '/')) || null;
  }

  getAllAssets() {
    return Array.from(this.assets.values());
  }

  setMetadata(key, val) {
    this.metadata[key] = val;
  }

  getMetadata(key) {
    return this.metadata[key] || null;
  }
}
