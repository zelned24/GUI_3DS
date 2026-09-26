/**
 * InterpolationTypes - Canonical interpolation curves supported by the 3DS Timeline.
 */
export const InterpolationTypes = {
  STEP: 'step',
  LINEAR: 'linear',
  EASE_IN: 'easeIn',
  EASE_OUT: 'easeOut',
  EASE_IN_OUT: 'easeInOut',
  BEZIER: 'bezier'
};

/**
 * TangentModes - Tangent calculation modes for curve handles.
 */
export const TangentModes = {
  AUTO: 'auto',
  LINEAR: 'linear',
  STEP: 'step',
  BEZIER: 'bezier'
};

/**
 * Keyframe - A single temporal animation keyframe at an integer frame.
 * Source of truth for property animation.
 */
export class Keyframe {
  /**
   * @param {Object} data 
   * @param {number} data.frame - Integer frame position >= 0
   * @param {*} data.value - Value at this keyframe
   * @param {string} [data.interpolation='linear'] - One of InterpolationTypes
   * @param {Object} [data.curve=null] - Optional cubic curve/easing parameters
   */
  constructor(data = {}) {
    if (data.frame === undefined || data.frame === null) {
      throw new Error('Keyframe must have a defined frame number');
    }

    // Frames must strictly be integers for 3DS determinism
    this.frame = Keyframe.snapFrame(data.frame);
    this.value = data.value !== undefined ? data.value : 0;
    
    // Validate or default interpolation
    const validInterp = Object.values(InterpolationTypes);
    this.interpolation = validInterp.includes(data.interpolation)
      ? data.interpolation
      : InterpolationTypes.LINEAR;

    if (data.curve) {
      this.curve = {
        mode: data.curve.mode || (this.interpolation === InterpolationTypes.BEZIER ? TangentModes.BEZIER : TangentModes.AUTO),
        cp1: Array.isArray(data.curve.cp1) ? [Number(data.curve.cp1[0]), Number(data.curve.cp1[1])] : [0.25, 0.1],
        cp2: Array.isArray(data.curve.cp2) ? [Number(data.curve.cp2[0]), Number(data.curve.cp2[1])] : [0.25, 1.0],
        tangentIn: data.curve.tangentIn ? { x: Number(data.curve.tangentIn.x || 0), y: Number(data.curve.tangentIn.y || 0) } : { x: -5, y: 0 },
        tangentOut: data.curve.tangentOut ? { x: Number(data.curve.tangentOut.x || 0), y: Number(data.curve.tangentOut.y || 0) } : { x: 5, y: 0 }
      };
    } else {
      this.curve = null;
    }

    this.selected = Boolean(data.selected);
  }

  /**
   * Clones keyframe.
   */
  clone(overrides = {}) {
    return new Keyframe({
      frame: overrides.frame !== undefined ? overrides.frame : this.frame,
      value: overrides.value !== undefined ? overrides.value : this.value,
      interpolation: overrides.interpolation || this.interpolation,
      curve: overrides.curve !== undefined ? overrides.curve : (this.curve ? {
        mode: this.curve.mode,
        cp1: [...this.curve.cp1],
        cp2: [...this.curve.cp2],
        tangentIn: { ...this.curve.tangentIn },
        tangentOut: { ...this.curve.tangentOut }
      } : null),
      selected: overrides.selected !== undefined ? overrides.selected : this.selected
    });
  }

  /**
   * Deterministic JSON representation.
   */
  toJSON() {
    const json = {
      frame: this.frame,
      value: this.value,
      interpolation: this.interpolation
    };
    if (this.curve) {
      json.curve = {
        mode: this.curve.mode || 'auto',
        cp1: [...this.curve.cp1],
        cp2: [...this.curve.cp2],
        tangentIn: { ...this.curve.tangentIn },
        tangentOut: { ...this.curve.tangentOut }
      };
    }
    return json;
  }

  /**
   * Instantiates Keyframe from JSON.
   */
  static fromJSON(data) {
    return new Keyframe(data);
  }

  /**
   * Snaps a raw frame number to a valid non-negative integer.
   * @param {number} frame 
   * @returns {number}
   */
  static snapFrame(frame) {
    if (frame === undefined || frame === null || isNaN(frame)) return 0;
    return Math.max(0, Math.round(frame));
  }
}
