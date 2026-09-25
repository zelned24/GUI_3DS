import { Keyframe, InterpolationTypes } from './Keyframe.js';
import { Interpolation } from './Interpolation.js';

/**
 * AnimationTrack - Animation channel targeting a specific property on a Scene Node.
 * Manages an ordered sequence of Keyframes and performs temporal evaluation.
 */
export class AnimationTrack {
  /**
   * @param {Object} data 
   * @param {string} [data.id]
   * @param {string} data.targetNodeId - ID of the target UINode in the Scene
   * @param {string} data.propertyPath - E.g. 'transform.x', 'transform.opacity'
   * @param {string} [data.displayName] - Human-friendly label
   * @param {string} [data.valueType='number'] - 'number' | 'boolean' | 'color' | 'string'
   * @param {boolean} [data.muted=false]
   * @param {boolean} [data.solo=false]
   * @param {Array<Object|Keyframe>} [data.keyframes=[]]
   */
  constructor(data = {}) {
    if (!data.targetNodeId || !data.propertyPath) {
      throw new Error('AnimationTrack must specify targetNodeId and propertyPath');
    }

    this.id = data.id || `track_${data.targetNodeId}_${data.propertyPath.replace(/\./g, '_')}`;
    this.targetNodeId = data.targetNodeId;
    this.propertyPath = data.propertyPath;
    this.displayName = data.displayName || this._generateDisplayName(data.propertyPath);
    this.valueType = data.valueType || this._inferValueType(data.propertyPath);
    this.muted = Boolean(data.muted);
    this.solo = Boolean(data.solo);

    this.keyframes = [];
    if (Array.isArray(data.keyframes)) {
      for (const kf of data.keyframes) {
        this.addKeyframe(kf.frame, kf.value, kf.interpolation, kf.curve);
      }
    }
  }

  _generateDisplayName(path) {
    const map = {
      'transform.x': 'Position X',
      'transform.y': 'Position Y',
      'transform.scaleX': 'Scale X',
      'transform.scaleY': 'Scale Y',
      'transform.rotation': 'Rotation',
      'transform.opacity': 'Opacity',
      'visible': 'Visibility',
      'properties.tint': 'Tint',
      'properties.progress': 'Progress'
    };
    return map[path] || path;
  }

  _inferValueType(path) {
    if (path.includes('opacity') || path.includes('scale') || path.includes('rotation') || path.endsWith('.x') || path.endsWith('.y')) {
      return 'number';
    }
    if (path === 'visible') return 'boolean';
    if (path.includes('tint') || path.includes('Color')) return 'color';
    return 'number';
  }

  /**
   * Adds or updates a keyframe at the specified integer frame.
   * Keyframes are always kept strictly sorted by frame number.
   * @param {number} frame 
   * @param {*} value 
   * @param {string} [interpolation='linear'] 
   * @param {Object} [curve=null]
   * @returns {Keyframe}
   */
  addKeyframe(frame, value, interpolation = InterpolationTypes.LINEAR, curve = null) {
    const intFrame = Math.max(0, Math.round(frame));
    const existing = this.getKeyframeAt(intFrame);

    if (existing) {
      existing.value = value;
      existing.interpolation = interpolation || existing.interpolation;
      if (curve !== undefined) existing.curve = curve;
      return existing;
    }

    const kf = new Keyframe({
      frame: intFrame,
      value,
      interpolation,
      curve
    });

    this.keyframes.push(kf);
    this.keyframes.sort((a, b) => a.frame - b.frame);
    return kf;
  }

  /**
   * Removes keyframe at the specified frame.
   * @param {number} frame 
   * @returns {Keyframe|null}
   */
  removeKeyframe(frame) {
    const intFrame = Math.max(0, Math.round(frame));
    const idx = this.keyframes.findIndex(k => k.frame === intFrame);
    if (idx === -1) return null;
    const [removed] = this.keyframes.splice(idx, 1);
    return removed;
  }

  /**
   * Retrieves keyframe at the exact integer frame.
   * @param {number} frame 
   */
  getKeyframeAt(frame) {
    const intFrame = Math.max(0, Math.round(frame));
    return this.keyframes.find(k => k.frame === intFrame) || null;
  }

  /**
   * Checks if a keyframe exists at the exact frame.
   * @param {number} frame 
   */
  hasKeyframeAt(frame) {
    return this.getKeyframeAt(frame) !== null;
  }

  /**
   * Moves a keyframe from one frame to another with integer snapping.
   * @param {number} fromFrame 
   * @param {number} toFrame 
   * @returns {boolean}
   */
  moveKeyframe(fromFrame, toFrame) {
    const srcFrame = Math.max(0, Math.round(fromFrame));
    const dstFrame = Math.max(0, Math.round(toFrame));

    if (srcFrame === dstFrame) return true;

    const existing = this.getKeyframeAt(srcFrame);
    if (!existing) return false;

    // If destination already has a keyframe, overwrite or remove it
    this.removeKeyframe(dstFrame);

    existing.frame = dstFrame;
    this.keyframes.sort((a, b) => a.frame - b.frame);
    return true;
  }

  /**
   * Evaluates the value of this track at the given frame.
   * Deterministic, zero cumulative error, and does not mutate any document state.
   * @param {number} frame 
   * @returns {*}
   */
  evaluate(frame) {
    if (this.keyframes.length === 0) {
      return null;
    }

    const intFrame = Math.max(0, Math.round(frame));

    // Exactly one keyframe
    if (this.keyframes.length === 1) {
      return this.keyframes[0].value;
    }

    // Before or at first keyframe
    if (intFrame <= this.keyframes[0].frame) {
      return this.keyframes[0].value;
    }

    // After or at last keyframe
    const last = this.keyframes[this.keyframes.length - 1];
    if (intFrame >= last.frame) {
      return last.value;
    }

    // Search interval [k0, k1] where k0.frame <= intFrame < k1.frame
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const k0 = this.keyframes[i];
      const k1 = this.keyframes[i + 1];

      if (intFrame >= k0.frame && intFrame <= k1.frame) {
        if (k0.frame === k1.frame) {
          return k0.value;
        }

        const t = (intFrame - k0.frame) / (k1.frame - k0.frame);
        return Interpolation.interpolate(k0.value, k1.value, t, k0.interpolation, this.valueType);
      }
    }

    return last.value;
  }

  /**
   * Deterministic JSON serialization.
   */
  toJSON() {
    return {
      id: this.id,
      targetNodeId: this.targetNodeId,
      propertyPath: this.propertyPath,
      displayName: this.displayName,
      valueType: this.valueType,
      muted: this.muted,
      solo: this.solo,
      keyframes: this.keyframes.map(k => k.toJSON())
    };
  }

  /**
   * Instantiates AnimationTrack from JSON.
   */
  static fromJSON(data) {
    return new AnimationTrack(data);
  }
}
