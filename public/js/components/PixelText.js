import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

/**
 * PixelText - Crisp pixelated text display matching 3DS bitmap font rendering.
 */
export class PixelText extends BaseComponent {
  static schema = {
    type: 'PixelText',
    displayName: 'Pixel Text',
    category: 'Typography',
    icon: '🔤',
    description: 'Crisp bitmap font text element with drop shadow for 3DS readability',
    capabilities: ['render', 'text'],
    properties: {
      text: Props.string('Text Content', 'Sample Text', { category: 'Content' }),
      fontSize: Props.integer('Font Size', 14, { min: 8, max: 64, category: 'Typography' }),
      align: Props.enum('Alignment', ['left', 'center', 'right'], 'left', { category: 'Typography' }),
      color: Props.color('Text Color', '#ffffff', { category: 'Style' }),
      shadow: Props.boolean('Text Shadow', true, { category: 'Style' }),
      shadowColor: Props.color('Shadow Color', '#000000', { category: 'Style' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'PixelText',
      width: Math.round(data.width ?? 120),
      height: Math.round(data.height ?? 24)
    });
  }

  draw(ctx, options = {}) {
    const { text, fontSize, color, shadowColor, shadow, align } = this.properties;
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
