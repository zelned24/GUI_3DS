import { AnimationTrack } from './AnimationTrack.js';
import { globalRNG } from '../core/DeterministicRNG.js';

/**
 * AnimationClip - Self-contained reusable animation asset representing
 * a multi-track set of keyframes over a fixed frame duration.
 */
export class AnimationClip {
  /**
   * @param {Object} data 
   * @param {string} [data.id]
   * @param {string} [data.name]
   * @param {number} [data.durationFrames=30]
   * @param {boolean} [data.loop=false]
   * @param {number} [data.loopCount=1]
   * @param {Array<AnimationTrack|Object>} [data.tracks=[]]
   * @param {Object} [data.metadata={}]
   */
  constructor(data = {}) {
    this.id = data.id || globalRNG.nextId('clip');
    this.name = data.name || this.id;
    this.durationFrames = Math.max(1, Math.round(data.durationFrames || 30));
    this.loop = Boolean(data.loop);
    this.loopCount = Math.max(1, Math.round(data.loopCount || 1));
    this.metadata = { ...(data.metadata || {}) };

    this.tracks = [];
    if (Array.isArray(data.tracks)) {
      for (const t of data.tracks) {
        if (t instanceof AnimationTrack) {
          this.tracks.push(t);
        } else {
          const tObj = typeof t === 'string'
            ? { propertyPath: t, targetNodeId: '__clip__' }
            : (t && t.targetNodeId ? t : { ...t, targetNodeId: '__clip__' });
          this.tracks.push(new AnimationTrack(tObj));
        }
      }
    }
  }

  /**
   * Finds track by ID or propertyPath.
   * @param {string} trackIdOrProp 
   */
  getTrack(trackIdOrProp) {
    return this.tracks.find(t => t.id === trackIdOrProp || t.propertyPath === trackIdOrProp) || null;
  }

  /**
   * Adds an animation track to this clip.
   * @param {AnimationTrack|Object|string} track 
   */
  addTrack(track) {
    let tObj;
    if (typeof track === 'string') {
      tObj = { propertyPath: track, targetNodeId: '__clip__' };
    } else if (track && !(track instanceof AnimationTrack) && !track.targetNodeId) {
      tObj = { ...track, targetNodeId: '__clip__' };
    } else {
      tObj = track;
    }
    const t = tObj instanceof AnimationTrack ? tObj : new AnimationTrack(tObj);
    this.tracks.push(t);
    return t;
  }

  /**
   * Retimes this clip to a new frame duration, scaling keyframe times proportionally to integer frames.
   * @param {number} newDurationFrames 
   * @returns {AnimationClip}
   */
  retime(newDurationFrames) {
    const newDur = Math.max(1, Math.round(newDurationFrames));
    const oldDur = this.durationFrames;
    const factor = oldDur > 0 ? (newDur / oldDur) : 1.0;

    for (const track of this.tracks) {
      for (const kf of track.keyframes) {
        kf.frame = Math.max(0, Math.round(kf.frame * factor));
      }
      track.keyframes.sort((a, b) => a.frame - b.frame);
    }
    this.durationFrames = newDur;
    return this;
  }

  /**
   * Deep clone of this AnimationClip.
   * @returns {AnimationClip}
   */
  clone() {
    return new AnimationClip(this.toJSON());
  }

  /**
   * Deterministic JSON representation.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      durationFrames: this.durationFrames,
      loop: this.loop,
      loopCount: this.loopCount,
      metadata: { ...this.metadata },
      tracks: this.tracks.map(t => (typeof t.toJSON === 'function' ? t.toJSON() : t))
    };
  }

  /**
   * Instantiates an AnimationClip from JSON.
   * @param {Object} data 
   * @returns {AnimationClip}
   */
  static fromJSON(data) {
    return new AnimationClip(data);
  }
}
