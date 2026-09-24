import { BaseComponent } from './BaseComponent.js';

/**
 * TouchButton - Interactive 3DS touch button with normal, focused, and pressed states.
 */
export class TouchButton extends BaseComponent {
  constructor(data = {}) {
    super({
      ...data,
      type: 'TouchButton',
      width: Math.round(data.width ?? 140),
      height: Math.round(data.height ?? 36)
    });
  }

  getDefaultProperties() {
    return {
      label: 'BUTTON',
      action: 'ACTION_TRIGGER',
      focusId: 0,
      backgroundColor: '#2b3040',
      focusedColor: '#404c66',
      pressedColor: '#1a1d26',
      borderColor: '#e84545',
      textColor: '#ffffff',
      fontSize: 14,
      borderRadius: 4
    };
  }

  draw(ctx, options = {}) {
    const {
      label,
      backgroundColor,
      focusedColor,
      pressedColor,
      borderColor,
      textColor,
      fontSize,
      borderRadius
    } = this.properties;

    const isPressed = options.pressedId === this.id;
    const isFocused = options.focusedId === this.id || options.focusedIndex === this.properties.focusId;

    let bg = backgroundColor || '#2b3040';
    if (isPressed) {
      bg = pressedColor || '#1a1d26';
    } else if (isFocused) {
      bg = focusedColor || '#404c66';
    }

    const w = this.width;
    const h = this.height;
    const r = Math.max(0, Math.min(borderRadius ?? 4, Math.min(w, h) / 2));

    // Outer border
    ctx.fillStyle = isFocused ? '#ffcb05' : (borderColor || '#e84545');
    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fill();

    // Inner button surface
    ctx.fillStyle = bg;
    const bw = isFocused ? 2 : 1;
    this._roundRect(ctx, bw, bw, w - bw * 2, h - bw * 2, Math.max(0, r - bw));
    ctx.fill();

    // Button label
    const str = String(label || 'BUTTON');
    const fs = Math.max(8, Math.min(32, fontSize || 14));
    ctx.font = `bold ${fs}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2) + (isPressed ? 1 : 0);

    // Shadow
    ctx.fillStyle = '#101010';
    ctx.fillText(str, cx + 1, cy + 1);

    // Text
    ctx.fillStyle = isFocused ? '#ffcb05' : (textColor || '#ffffff');
    ctx.fillText(str, cx, cy);
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
