import { AnimationClip } from './AnimationClip.js';
import { AnimationTrack } from './AnimationTrack.js';
import { InterpolationTypes } from './Keyframe.js';

/**
 * ClipLibrary - Built-in library of pure data animation clip presets.
 * Supports preset registration, retrieval, and applying clips to Scene nodes.
 */
export class ClipLibrary {
  static _registry = new Map();

  static initDefaultPresets() {
    this._registry.clear();

    // 1. FadeIn
    const fadeIn = new AnimationClip({
      id: 'clip_fade_in',
      name: 'FadeIn',
      durationFrames: 30,
      metadata: { category: 'Fade', description: 'Smooth 30-frame fade in' }
    });
    const tFadeIn = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.opacity' });
    tFadeIn.addKeyframe(0, 0.0, InterpolationTypes.EASE_OUT);
    tFadeIn.addKeyframe(30, 1.0, InterpolationTypes.LINEAR);
    fadeIn.addTrack(tFadeIn);
    this.register(fadeIn);

    // 2. FadeOut
    const fadeOut = new AnimationClip({
      id: 'clip_fade_out',
      name: 'FadeOut',
      durationFrames: 30,
      metadata: { category: 'Fade', description: 'Smooth 30-frame fade out' }
    });
    const tFadeOut = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.opacity' });
    tFadeOut.addKeyframe(0, 1.0, InterpolationTypes.EASE_IN);
    tFadeOut.addKeyframe(30, 0.0, InterpolationTypes.LINEAR);
    fadeOut.addTrack(tFadeOut);
    this.register(fadeOut);

    // 3. SlideInLeft
    const slideLeft = new AnimationClip({
      id: 'clip_slide_in_left',
      name: 'SlideInLeft',
      durationFrames: 30,
      metadata: { category: 'Slide', description: 'Slide in from left (-100px)' }
    });
    const tSlideL = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.x' });
    tSlideL.addKeyframe(0, -100, InterpolationTypes.EASE_OUT);
    tSlideL.addKeyframe(30, 0, InterpolationTypes.LINEAR);
    slideLeft.addTrack(tSlideL);
    this.register(slideLeft);

    // 4. SlideInRight
    const slideRight = new AnimationClip({
      id: 'clip_slide_in_right',
      name: 'SlideInRight',
      durationFrames: 30,
      metadata: { category: 'Slide', description: 'Slide in from right (+100px)' }
    });
    const tSlideR = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.x' });
    tSlideR.addKeyframe(0, 100, InterpolationTypes.EASE_OUT);
    tSlideR.addKeyframe(30, 0, InterpolationTypes.LINEAR);
    slideRight.addTrack(tSlideR);
    this.register(slideRight);

    // 5. Bounce
    const bounce = new AnimationClip({
      id: 'clip_bounce',
      name: 'Bounce',
      durationFrames: 40,
      metadata: { category: 'Special', description: 'Playful bouncing effect on Y' }
    });
    const tBounce = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.y' });
    tBounce.addKeyframe(0, 0, InterpolationTypes.EASE_OUT);
    tBounce.addKeyframe(15, -30, InterpolationTypes.EASE_IN);
    tBounce.addKeyframe(25, 0, InterpolationTypes.EASE_OUT);
    tBounce.addKeyframe(35, -10, InterpolationTypes.EASE_IN);
    tBounce.addKeyframe(40, 0, InterpolationTypes.LINEAR);
    bounce.addTrack(tBounce);
    this.register(bounce);

    // 6. ScalePop
    const scalePop = new AnimationClip({
      id: 'clip_scale_pop',
      name: 'ScalePop',
      durationFrames: 25,
      metadata: { category: 'Scale', description: 'Punchy scale-up entrance' }
    });
    const tScaleX = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.scaleX' });
    tScaleX.addKeyframe(0, 0.2, InterpolationTypes.EASE_OUT);
    tScaleX.addKeyframe(15, 1.2, InterpolationTypes.EASE_IN_OUT);
    tScaleX.addKeyframe(25, 1.0, InterpolationTypes.LINEAR);
    scalePop.addTrack(tScaleX);

    const tScaleY = new AnimationTrack({ targetNodeId: '__target__', propertyPath: 'transform.scaleY' });
    tScaleY.addKeyframe(0, 0.2, InterpolationTypes.EASE_OUT);
    tScaleY.addKeyframe(15, 1.2, InterpolationTypes.EASE_IN_OUT);
    tScaleY.addKeyframe(25, 1.0, InterpolationTypes.LINEAR);
    scalePop.addTrack(tScaleY);
    this.register(scalePop);
  }

  /**
   * Registers a clip into the library.
   * @param {AnimationClip} clip 
   */
  static register(clip) {
    if (!clip || !clip.id) return;
    this._registry.set(clip.id, clip);
  }

  /**
   * Retrieves clip by ID or name.
   * @param {string} idOrName 
   * @returns {AnimationClip|null}
   */
  static get(idOrName) {
    if (this._registry.size === 0) {
      this.initDefaultPresets();
    }
    if (this._registry.has(idOrName)) {
      return this._registry.get(idOrName);
    }
    for (const clip of this._registry.values()) {
      if (clip.name === idOrName || clip.id === idOrName) {
        return clip;
      }
    }
    return null;
  }

  /**
   * Returns all registered clips.
   * @returns {AnimationClip[]}
   */
  static getAll() {
    if (this._registry.size === 0) {
      this.initDefaultPresets();
    }
    return Array.from(this._registry.values());
  }

  /**
   * Applies an AnimationClip directly to a target Scene Node at a given frame position.
   * Generates standard editable keyframes on the target node's tracks.
   * 
   * @param {SceneModel} scene 
   * @param {AnimationClip|string} clipOrId 
   * @param {string} nodeId 
   * @param {number} [startFrame=0] 
   * @param {Object} [options]
   * @param {number} [options.retimeDuration]
   * @returns {Array<Keyframe>} Generated keyframes
   */
  static applyClipToNode(scene, clipOrId, nodeId, startFrame = 0, options = {}) {
    if (!scene || !nodeId) return [];
    const clip = typeof clipOrId === 'string' ? this.get(clipOrId) : clipOrId;
    if (!clip) {
      throw new Error(`Clip not found: ${clipOrId}`);
    }

    const appliedClip = (options.retimeDuration && options.retimeDuration > 0)
      ? clip.retime(options.retimeDuration)
      : clip;

    const baseFrame = Math.max(0, Math.round(startFrame));
    const generatedKeyframes = [];

    for (const clipTrack of appliedClip.tracks) {
      let sceneTrack = scene.tracks.find(t => t.targetNodeId === nodeId && t.propertyPath === clipTrack.propertyPath);
      if (!sceneTrack) {
        sceneTrack = new AnimationTrack({
          targetNodeId: nodeId,
          propertyPath: clipTrack.propertyPath,
          valueType: clipTrack.valueType
        });
        scene.addTrack(sceneTrack);
      }

      for (const kf of clipTrack.keyframes) {
        const destFrame = baseFrame + kf.frame;
        const newKf = sceneTrack.addKeyframe(destFrame, kf.value, kf.interpolation, kf.curve);
        generatedKeyframes.push(newKf);
      }
    }

    return generatedKeyframes;
  }
}

// Initialize on module load
ClipLibrary.initDefaultPresets();
