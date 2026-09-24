import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

/**
 * RogueBox - PokéRogue-style styled frame / panel for 3DS.
 */
export class RogueBox extends BaseComponent {
  static schema = {
    type: 'RogueBox',
    displayName: 'Rogue Box',
    category: 'Containers',
    icon: '🔲',
    description: 'PokéRogue-style styled container frame for Nintendo 3DS',
    capabilities: ['render', 'container'],
    properties: {
      backgroundColor: Props.color('Background Color', '#1e2230', { category: 'Style' }),
      borderColor: Props.color('Border Color', '#c83834', { category: 'Style' }),
      borderWidth: Props.integer('Border Width', 2, { min: 0, max: 16, category: 'Style' }),
      borderRadius: Props.integer('Corner Radius', 4, { min: 0, max: 24, category: 'Style' }),
      shadow: Props.boolean('Drop Shadow', true, { category: 'Style' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'RogueBox',
      width: Math.round(data.width ?? 160),
      height: Math.round(data.height ?? 100)
    });
  }

  draw(ctx, options = {}) {
    const { backgroundColor, borderColor, borderWidth, borderRadius, shadow } = this.properties;
    const w = this.width;
    const h = this.height;
    const radius = Math.max(0, Math.min(borderRadius ?? 0, Math.min(w, h) / 2));
    const bw = Math.max(0, borderWidth ?? 2);

    // Subtle drop shadow if enabled
    if (shadow) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this._roundRect(ctx, 2, 2, w, h, radius);
      ctx.fill();
    }

    // Outer border / bevel
    if (bw > 0) {
      ctx.fillStyle = borderColor || '#c83834';
      this._roundRect(ctx, 0, 0, w, h, radius);
      ctx.fill();
    }

    // Inner background
    if (w > bw * 2 && h > bw * 2) {
      ctx.fillStyle = backgroundColor || '#1e2230';
      const innerRadius = Math.max(0, radius - bw);
      this._roundRect(ctx, bw, bw, w - bw * 2, h - bw * 2, innerRadius);
      ctx.fill();
    }

    // PokéRogue inner highlight line (retro shine effect)
    if (w > 12 && h > 12) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(bw + 1, bw + 1, w - (bw * 2 + 2), 2);
    }
  }

  _roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
