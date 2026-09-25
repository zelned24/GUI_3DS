import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

/**
 * PokemonSpriteNode - Declarative PokéRogue Pokémon sprite element for Nintendo 3DS.
 * References species declaratively without hardcoding arbitrary URLs:
 * species, nationalDexId, form, gender, shiny, variant, facing, animation, frame.
 */
export class PokemonSpriteNode extends BaseComponent {
  static schema = {
    type: 'PokemonSprite',
    displayName: 'Pokémon Sprite',
    category: 'PokéRogue',
    icon: '⚡',
    description: 'Declarative PokéRogue Pokémon sprite with atlas resolution and 3DS t3x targeting',
    capabilities: ['render', 'pokemon', 'asset'],
    properties: {
      species: Props.string('Species', 'Pikachu', { category: 'Pokémon' }),
      nationalDexId: Props.integer('National Dex ID', 25, { min: 1, max: 1025, category: 'Pokémon' }),
      form: Props.string('Form', 'normal', { category: 'Pokémon' }),
      gender: Props.enum('Gender', ['male', 'female', 'genderless'], 'male', { category: 'Pokémon' }),
      shiny: Props.boolean('Shiny', false, { category: 'Pokémon' }),
      variant: Props.integer('Variant', 0, { min: 0, max: 3, category: 'Pokémon' }),
      facing: Props.enum('Facing', ['front', 'back'], 'front', { category: 'Animation' }),
      animation: Props.enum('Animation', ['idle', 'attack', 'hit', 'faint'], 'idle', { category: 'Animation' }),
      frame: Props.integer('Frame Index', 0, { min: 0, max: 60, category: 'Animation' }),
      scale3DS: Props.float('3DS Scale', 1.0, { min: 0.1, max: 4.0, step: 0.1, category: 'Rendering' }),
      showShadow: Props.boolean('Render Shadow', true, { category: 'Rendering' })
    }
  };

  // Shared in-memory sprite cache
  static spriteCache = new Map();
  static defaultResolver = new PokemonSpriteResolver();

  constructor(data = {}) {
    super({
      ...data,
      type: 'PokemonSprite',
      width: Math.round(data.width ?? 96),
      height: Math.round(data.height ?? 96)
    });
  }

  /**
   * Resolves the real asset provenance and paths using PokemonSpriteResolver.
   * @param {PokemonSpriteResolver} [resolver] 
   * @returns {Object}
   */
  resolveAsset(resolver = null) {
    const res = resolver || PokemonSpriteNode.defaultResolver;
    const dexId = this.properties.nationalDexId || 25;
    return res.resolvePokemonSprite(dexId);
  }

  draw(ctx, options = {}) {
    const { species, nationalDexId, shiny, facing, animation, frame, showShadow } = this.properties;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // 1. Draw ground shadow if enabled
    if (showShadow) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 8, Math.max(12, w * 0.35), Math.max(4, h * 0.08), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Check cached HTML image
    const assetResolution = this.resolveAsset();
    const cacheKey = `pkmn_${nationalDexId}_${facing}_${shiny ? 'shiny' : 'norm'}`;
    const cachedImg = PokemonSpriteNode.spriteCache.get(cacheKey);

    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      if (facing === 'back') {
        // Subtle back sprite scaling or horizontal reflection if requested
      }
      ctx.drawImage(cachedImg, 0, 0, w, h);
    } else {
      // 3. Fallback declarative authoring visualizer
      this._drawAuthoringSprite(ctx, w, h, species, nationalDexId, shiny, facing, animation, frame, assetResolution);
    }

    ctx.restore();
  }

  _drawAuthoringSprite(ctx, w, h, species, dexId, shiny, facing, animation, frame, assetRes) {
    // Backdrop panel
    ctx.fillStyle = shiny ? '#2d2238' : '#1c2230';
    ctx.fillRect(4, 4, w - 8, h - 16);

    // Border
    ctx.strokeStyle = shiny ? '#f59e0b' : '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 3.5, w - 7, h - 15);

    // Pokémon silhouette/sprite illustration placeholder
    ctx.fillStyle = shiny ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 4, Math.min(w, h) * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Text labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(species || 'Pokémon', w / 2, h / 2 - 8);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`#${String(dexId).padStart(3, '0')} [${facing.toUpperCase()}]`, w / 2, h / 2 + 7);

    // Shiny indicator
    if (shiny) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px sans-serif';
      ctx.fillText('✨', w - 14, 14);
    }

    // Provenance badge
    ctx.fillStyle = assetRes?.exists ? '#10b981' : '#f59e0b';
    ctx.font = '8px monospace';
    ctx.fillText(assetRes?.exists ? '✓ 3DS ROMFS' : '⚡ ATLAS', w / 2, h - 18);
  }
}
