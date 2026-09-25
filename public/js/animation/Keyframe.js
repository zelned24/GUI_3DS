/**
 * InterpolationTypes - Canonical interpolation curves supported by the 3DS Timeline.
 */
export const InterpolationTypes = {
  STEP: 'step',
  LINEAR: 'linear',
  EASE_IN: 'easeIn',
  EASE_OUT: 'easeOut',
  EASE_IN_OUT: 'easeInOut'
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

    this.curve = data.curve ? { ...data.curve } : null;
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
      curve: overrides.curve !== undefined ? overrides.curve : (this.curve ? { ...this.curve } : null),
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
      json.curve = { ...this.curve };
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
