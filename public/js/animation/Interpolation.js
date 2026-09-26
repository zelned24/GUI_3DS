import { InterpolationTypes } from './Keyframe.js';

/**
 * Interpolation - Pure mathematical easing and value interpolation functions for 3DS Animation.
 * Decoupled from the DOM and 100% deterministic.
 */
export class Interpolation {
  /**
   * Solves and evaluates a Cubic Bezier curve timing function (like CSS cubic-bezier).
   * P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1).
   * @param {number} t - Time in range [0..1]
   * @param {number} x1 - Control point 1 X
   * @param {number} y1 - Control point 1 Y
   * @param {number} x2 - Control point 2 X
   * @param {number} y2 - Control point 2 Y
   * @returns {number}
   */
  static evaluateBezier(t, x1 = 0.25, y1 = 0.1, x2 = 0.25, y2 = 1.0) {
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;

    const sampleX = (u) => {
      // 3*(1-u)^2*u*x1 + 3*(1-u)*u^2*x2 + u^3
      const oneMinusU = 1.0 - u;
      return 3.0 * oneMinusU * oneMinusU * u * x1 + 3.0 * oneMinusU * u * u * x2 + u * u * u;
    };

    const sampleXDerivative = (u) => {
      const oneMinusU = 1.0 - u;
      return 3.0 * oneMinusU * oneMinusU * x1 + 6.0 * oneMinusU * u * (x2 - x1) + 3.0 * u * u * (1.0 - x2);
    };

    const sampleY = (u) => {
      const oneMinusU = 1.0 - u;
      return 3.0 * oneMinusU * oneMinusU * u * y1 + 3.0 * oneMinusU * u * u * y2 + u * u * u;
    };

    // Newton-Raphson iteration to find u for sampleX(u) = t
    let u = t;
    for (let i = 0; i < 8; ++i) {
      const x = sampleX(u) - t;
      if (Math.abs(x) < 1e-6) {
        return sampleY(u);
      }
      const d = sampleXDerivative(u);
      if (Math.abs(d) < 1e-6) break;
      u = u - x / d;
      if (u < 0.0 || u > 1.0) break;
    }

    // Fallback: binary search / bisection
    let low = 0.0;
    let high = 1.0;
    u = t;
    for (let i = 0; i < 12; ++i) {
      const x = sampleX(u);
      if (Math.abs(x - t) < 1e-5) {
        return sampleY(u);
      }
      if (x > t) {
        high = u;
      } else {
        low = u;
      }
      u = 0.5 * (low + high);
    }

    return sampleY(u);
  }

  /**
   * Evaluates normalized time progress [0..1] according to the interpolation curve.
   * @param {number} t - Normalized time in range [0..1]
   * @param {string} type - One of InterpolationTypes
   * @param {Object} [curve] - Optional custom curve parameters
   * @returns {number}
   */
  static evaluateProgress(t, type = InterpolationTypes.LINEAR, curve = null) {
    const clampedT = Math.max(0, Math.min(1, t));

    if (type === InterpolationTypes.BEZIER || (curve && curve.mode === 'bezier')) {
      const x1 = curve?.cp1?.[0] !== undefined ? curve.cp1[0] : 0.25;
      const y1 = curve?.cp1?.[1] !== undefined ? curve.cp1[1] : 0.1;
      const x2 = curve?.cp2?.[0] !== undefined ? curve.cp2[0] : 0.25;
      const y2 = curve?.cp2?.[1] !== undefined ? curve.cp2[1] : 1.0;
      return this.evaluateBezier(clampedT, x1, y1, x2, y2);
    }

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
   * Clamps and normalizes values according to property rules.
   * @param {*} value
   * @param {string} propertyPath
   * @returns {*}
   */
  static clampValue(value, propertyPath = '') {
    if (propertyPath === 'opacity' || propertyPath === 'transform.opacity') {
      const num = Number(value);
      if (isNaN(num)) return 1.0;
      return Math.max(0.0, Math.min(1.0, num));
    }
    if (propertyPath === 'visible') {
      return Boolean(value);
    }
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    return value;
  }

  /**
   * Interpolates between two keyframe values.
   * @param {*} valA - Value at keyframe A
   * @param {*} valB - Value at keyframe B
   * @param {number} t - Normalized progress [0..1]
   * @param {string} interpolationType - Curve type
   * @param {string} [valueType='number'] - 'number' | 'boolean' | 'color' | 'string'
   * @param {Object} [curve=null]
   */
  static interpolate(valA, valB, t, interpolationType = InterpolationTypes.LINEAR, valueType = 'number', curve = null) {
    const progress = this.evaluateProgress(t, interpolationType, curve);

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
