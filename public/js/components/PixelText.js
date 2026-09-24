import { BaseComponent } from './BaseComponent.js';

/**
 * PixelText - Crisp pixelated text display matching 3DS bitmap font rendering.
 */
export class PixelText extends BaseComponent {
  constructor(data = {}) {
    super({
      ...data,
      type: 'PixelText',
      width: Math.round(data.width ?? 120),
      height: Math.round(data.height ?? 24)
    });
  }

  getDefaultProperties() {
    return {
      text: 'Sample Text',
      fontSize: 14,
      fontFamily: 'monospace',
      color: '#ffffff',
      shadowColor: '#101010',
      shadow: true,
      align: 'left' // 'left' | 'center' | 'right'
    };
  }

  draw(ctx, options = {}) {
    const { text, fontSize, fontFamily, color, shadowColor, shadow, align } = this.properties;
    const str = String(text ?? '');
    const fs = Math.max(8, Math.min(64, fontSize || 14));
    const font = `${fs}px "Courier New", monospace`;

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align || 'left';

    let tx = 0;
    if (align === 'center') tx = Math.round(this.width / 2);
    else if (align === 'right') tx = this.width;

    const ty = Math.round(this.height / 2);

    // Pixel shadow (typical in 3DS games for readability)
    if (shadow !== false) {
      ctx.fillStyle = shadowColor || '#000000';
      ctx.fillText(str, tx + 1, ty + 1);
    }

    ctx.fillStyle = color || '#ffffff';
    ctx.fillText(str, tx, ty);
  }
}
