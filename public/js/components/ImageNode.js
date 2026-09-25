import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

/**
 * ImageNode - Generic 2D Image / Texture display component for Nintendo 3DS.
 * Authoring properties: asset, x, y, width, height, scale, rotation, pivot, opacity, flipX, flipY.
 */
export class ImageNode extends BaseComponent {
  static schema = {
    type: 'Image',
    displayName: 'Image',
    category: 'Visual',
    icon: '🖼️',
    description: '2D Sprite / Texture image element for Nintendo 3DS screens',
    capabilities: ['render', 'asset'],
    properties: {
      asset: Props.string('Asset ID', 'bg_arena_plains', { category: 'Asset' }),
      flipX: Props.boolean('Flip Horizontal', false, { category: 'Appearance' }),
      flipY: Props.boolean('Flip Vertical', false, { category: 'Appearance' }),
      tint: Props.color('Tint Color', '#ffffff', { category: 'Appearance' }),
      blendMode: Props.enum('Blend Mode', ['normal', 'additive', 'multiply'], 'normal', { category: 'Appearance' }),
      fit: Props.enum('Fit Mode', ['stretch', 'contain', 'cover', 'center'], 'stretch', { category: 'Appearance' }),
      filterNearest: Props.boolean('Pixel Perfect (Nearest)', true, { category: 'Appearance' })
    }
  };

  // Shared in-memory image cache for browser preview
  static imageCache = new Map();

  constructor(data = {}) {
    super({
      ...data,
      type: 'Image',
      width: Math.round(data.width ?? 128),
      height: Math.round(data.height ?? 80)
    });
  }

  draw(ctx, options = {}) {
    const { asset, flipX, flipY, tint, blendMode, fit, filterNearest } = this.properties;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Pixelated sampling for 3DS retro fidelity
    if (filterNearest && ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = false;
    }

    // Apply horizontal & vertical flips around node center
    if (flipX || flipY) {
      ctx.translate(w / 2, h / 2);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.translate(-w / 2, -h / 2);
    }

    // Check if an actual HTMLImageElement is cached for this asset
    const cachedImg = asset ? ImageNode.imageCache.get(asset) : null;

    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      if (fit === 'contain') {
        const scale = Math.min(w / cachedImg.naturalWidth, h / cachedImg.naturalHeight);
        const dw = cachedImg.naturalWidth * scale;
        const dh = cachedImg.naturalHeight * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(cachedImg, dx, dy, dw, dh);
      } else if (fit === 'cover') {
        const scale = Math.max(w / cachedImg.naturalWidth, h / cachedImg.naturalHeight);
        const dw = cachedImg.naturalWidth * scale;
        const dh = cachedImg.naturalHeight * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(cachedImg, dx, dy, dw, dh);
      } else if (fit === 'center') {
        const dx = (w - cachedImg.naturalWidth) / 2;
        const dy = (h - cachedImg.naturalHeight) / 2;
        ctx.drawImage(cachedImg, dx, dy);
      } else {
        // Default: stretch to node bounds
        ctx.drawImage(cachedImg, 0, 0, w, h);
      }
    } else {
      // Crisp pixelated placeholder rendering for authoring/offline/tests
      this._drawPlaceholder(ctx, w, h, asset);
    }

    ctx.restore();
  }

  _drawPlaceholder(ctx, w, h, asset) {
    // Checkerboard backdrop
    const checkSize = 8;
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#262f42';
    for (let py = 0; py < h; py += checkSize) {
      for (let px = 0; px < w; px += checkSize) {
        if (((px / checkSize) + (py / checkSize)) % 2 === 0) {
          ctx.fillRect(px, py, Math.min(checkSize, w - px), Math.min(checkSize, h - py));
        }
      }
    }

    // Outer border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Inner icon badge & label
    if (w >= 32 && h >= 24) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const shortLabel = asset ? asset.split('/').pop().replace(/\.[^/.]+$/, '') : 'No Asset';
      const truncated = shortLabel.length > 14 ? shortLabel.substring(0, 12) + '..' : shortLabel;

      if (h >= 40) {
        ctx.fillText('🖼️', w / 2, h / 2 - 8);
        ctx.fillText(truncated, w / 2, h / 2 + 10);
      } else {
        ctx.fillText(truncated, w / 2, h / 2);
      }
    }
  }
}
