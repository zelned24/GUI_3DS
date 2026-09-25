import { InterpolationTypes } from './Keyframe.js';

/**
 * Interpolation - Pure mathematical easing and value interpolation functions for 3DS Animation.
 * Decoupled from the DOM and 100% deterministic.
 */
export class Interpolation {
  /**
   * Evaluates normalized time progress [0..1] according to the interpolation curve.
   * @param {number} t - Normalized time in range [0..1]
   * @param {string} type - One of InterpolationTypes
   * @param {Object} [curve] - Optional custom curve parameters
   * @returns {number}
   */
  static evaluateProgress(t, type = InterpolationTypes.LINEAR, curve = null) {
    const clampedT = Math.max(0, Math.min(1, t));

    switch (type) {
      case InterpolationTypes.STEP:
        return clampedT < 1.0 ? 0.0 : 1.0;

      case InterpolationTypes.LINEAR:
        return clampedT;

      case InterpolationTypes.EASE_IN:
        // Quadratic Ease In: t^2
        return clampedT * clampedT;

      case InterpolationTypes.EASE_OUT:
        // Quadratic Ease Out: t * (2 - t)
        return clampedT * (2.0 - clampedT);

      case InterpolationTypes.EASE_IN_OUT:
        // Smooth Quadratic Ease In-Out
        return clampedT < 0.5
          ? 2.0 * clampedT * clampedT
          : -1.0 + (4.0 - 2.0 * clampedT) * clampedT;

      default:
        return clampedT;
    }
  }

  /**
   * Interpolates between two keyframe values.
   * @param {*} valA - Value at keyframe A
   * @param {*} valB - Value at keyframe B
   * @param {number} t - Normalized progress [0..1]
   * @param {string} interpolationType - Curve type
   * @param {string} [valueType='number'] - 'number' | 'boolean' | 'color' | 'string'
   */
  static interpolate(valA, valB, t, interpolationType = InterpolationTypes.LINEAR, valueType = 'number') {
    const progress = this.evaluateProgress(t, interpolationType);

    if (valueType === 'boolean' || typeof valA === 'boolean' || typeof valB === 'boolean') {
      return progress < 0.5 ? Boolean(valA) : Boolean(valB);
    }

    if (valueType === 'color' || (typeof valA === 'string' && valA.startsWith('#') && typeof valB === 'string' && valB.startsWith('#'))) {
      return this._interpolateHexColor(String(valA), String(valB), progress);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      const result = valA + (valB - valA) * progress;
      return result;
    }

    // Default step for strings or arbitrary objects
    return progress < 1.0 ? valA : valB;
  }

  /**
   * Linear hex color interpolation (#RRGGBB).
   */
  static _interpolateHexColor(hexA, hexB, t) {
    const parse = (hex) => {
      const c = hex.replace('#', '');
      if (c.length === 3) {
        return [
          parseInt(c[0] + c[0], 16),
          parseInt(c[1] + c[1], 16),
          parseInt(c[2] + c[2], 16)
        ];
      }
      return [
        parseInt(c.substring(0, 2), 16) || 0,
        parseInt(c.substring(2, 4), 16) || 0,
        parseInt(c.substring(4, 6), 16) || 0
      ];
    };

    const [r1, g1, b1] = parse(hexA);
    const [r2, g2, b2] = parse(hexB);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
