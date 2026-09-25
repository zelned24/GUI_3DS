/**
 * PokemonSprite.js
 * 3DS PokéRogue Pokemon Sprite Component.
 * Binds to upstream asset paths resolved via PokemonSpriteResolver.
 * Supports front/back, shiny, female variants, and displays MISSING ASSET when unavailable.
 */

import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

export class PokemonSprite extends BaseComponent {
  static schema = {
    type: 'PokemonSprite',
    displayName: 'Pokemon Sprite',
    category: 'PokéRogue Data Views',
    icon: '👾',
    description: 'Renders Pokémon sprite or icon bound to upstream PokéRogue asset path',
    capabilities: ['render', 'data-binding'],
    properties: {
      speciesId: Props.integer('Species ID', 25, { min: 1, max: 1025, category: 'Data Binding' }),
      speciesName: Props.string('Species Key', 'pikachu', { category: 'Data Binding' }),
      viewMode: Props.enum('View Mode', 'Front', ['Front', 'Back', 'Icon'], { category: 'Asset' }),
      shiny: Props.boolean('Shiny', false, { category: 'Asset' }),
      female: Props.boolean('Female Form', false, { category: 'Asset' }),
      scale: Props.integer('Pixel Scale', 1, { min: 1, max: 4, category: 'Display' }),
      showBorder: Props.boolean('Frame Border', false, { category: 'Display' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'PokemonSprite',
      width: Math.round(data.width ?? 64),
      height: Math.round(data.height ?? 64)
    });
    this._loadedImage = null;
    this._loadedSrc = null;
    this._loadError = false;
  }

  draw(ctx) {
    const { speciesId, viewMode, shiny, female, showBorder } = this.properties;
    const w = this.width;
    const h = this.height;

    // Resolve upstream asset path
    let relPath = '';
    if (viewMode === 'Icon') {
      relPath = PokemonSpriteResolver.resolveIcon(speciesId || 25);
    } else {
      relPath = PokemonSpriteResolver.resolveSprite(speciesId || 25, {
        back: viewMode === 'Back',
        shiny: !!shiny,
        female: !!female
      });
    }

    const assetUrl = `/api/pokerogue/asset?path=${encodeURIComponent(relPath)}`;

    if (this._loadedSrc !== assetUrl) {
      this._loadedSrc = assetUrl;
      this._loadError = false;
      this._loadedImage = new Image();
      this._loadedImage.onload = () => {
        // Redraw will happen on next frame
      };
      this._loadedImage.onerror = () => {
        this._loadError = true;
      };
      this._loadedImage.src = assetUrl;
    }

    // Border if requested
    if (showBorder) {
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }

    if (this._loadedImage && this._loadedImage.complete && this._loadedImage.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      // Draw centered with aspect preservation
      const imgW = this._loadedImage.naturalWidth;
      const imgH = this._loadedImage.naturalHeight;
      const scale = Math.min(w / imgW, h / imgH);
      const drawW = Math.round(imgW * scale);
      const drawH = Math.round(imgH * scale);
      const drawX = Math.round((w - drawW) / 2);
      const drawY = Math.round((h - drawH) / 2);

      ctx.drawImage(this._loadedImage, drawX, drawY, drawW, drawH);
    } else if (this._loadError) {
      // Prompt Rule: Display MISSING ASSET banner, never a fake emoji
      ctx.fillStyle = '#2d1515';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e53e3e';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

      ctx.fillStyle = '#fc8181';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MISSING', Math.floor(w / 2), Math.floor(h / 2) - 6);
      ctx.fillText('ASSET', Math.floor(w / 2), Math.floor(h / 2) + 6);
    } else {
      // Loading spinner / placeholder
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#718096';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOADING...', Math.floor(w / 2), Math.floor(h / 2));
    }
  }
}
