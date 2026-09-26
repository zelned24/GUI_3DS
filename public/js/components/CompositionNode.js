import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

/**
 * CompositionNode - Reusable nested scene composition instance in a 3DS Scene Graph.
 * Embeds a child scene timeline with dedicated time mapping, local frames, and overrides.
 */
export class CompositionNode extends BaseComponent {
  static schema = {
    type: 'Composition',
    displayName: 'Composition',
    category: 'Compositions',
    icon: '🎞️',
    description: 'Nested scene composition instance with local timeline and overrides',
    capabilities: ['container', 'render'],
    properties: {
      sceneId: Props.string('Scene ID', '', { category: 'Composition' }),
      startFrame: Props.integer('Start Frame', 0, { min: 0, category: 'Timing' }),
      durationFrames: Props.integer('Duration (Frames)', 60, { min: 1, category: 'Timing' }),
      localFrameOffset: Props.integer('Local Frame Offset', 0, { category: 'Timing' }),
      playbackRate: Props.float('Playback Rate', 1.0, { min: 0.1, max: 10.0, step: 0.1, category: 'Timing' }),
      loop: Props.boolean('Loop', false, { category: 'Timing' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'Composition',
      width: Math.round(data.width ?? 200),
      height: Math.round(data.height ?? 120)
    });

    this.sceneId = data.sceneId || data.properties?.sceneId || '';
    this.startFrame = Math.max(0, Math.round(data.startFrame ?? data.properties?.startFrame ?? 0));
    this.durationFrames = Math.max(1, Math.round(data.durationFrames ?? data.properties?.durationFrames ?? 60));
    this.localFrameOffset = Math.round(data.localFrameOffset ?? data.properties?.localFrameOffset ?? 0);
    this.playbackRate = parseFloat(data.playbackRate ?? data.properties?.playbackRate ?? 1.0);
    this.loop = Boolean(data.loop ?? data.properties?.loop ?? false);
    this.overrides = { ...(data.overrides || data.properties?.overrides || {}) };

    // Synchronize properties dictionary
    this.properties = {
      ...this.properties,
      sceneId: this.sceneId,
      startFrame: this.startFrame,
      durationFrames: this.durationFrames,
      localFrameOffset: this.localFrameOffset,
      playbackRate: this.playbackRate,
      loop: this.loop,
      overrides: { ...this.overrides }
    };
  }

  /**
   * Calculates local integer frame for this nested composition given parent frame.
   * @param {number} parentFrame 
   * @returns {number}
   */
  mapParentToLocalFrame(parentFrame) {
    const pFrame = Math.max(0, Math.round(parentFrame));
    let local = Math.floor((pFrame - this.startFrame) * this.playbackRate) + this.localFrameOffset;
    if (this.loop && this.durationFrames > 0) {
      local = ((local % this.durationFrames) + this.durationFrames) % this.durationFrames;
    } else {
      local = Math.max(0, Math.min(this.durationFrames, local));
    }
    return Math.round(local);
  }

  draw(ctx, options = {}) {
    // Composition bounding box in editor view
    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(0, 0, this.width, this.height);

    // Header badge
    ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.fillRect(0, 0, this.width, 18);

    ctx.fillStyle = '#c084fc';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = `🎞️ ${this.properties.sceneId || this.name || 'Composition'} [${this.durationFrames}f]`;
    ctx.fillText(label, 4, 9);

    ctx.restore();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      sceneId: this.sceneId,
      startFrame: this.startFrame,
      durationFrames: this.durationFrames,
      localFrameOffset: this.localFrameOffset,
      playbackRate: this.playbackRate,
      loop: this.loop,
      overrides: { ...this.overrides },
      properties: {
        ...this.properties,
        sceneId: this.sceneId,
        startFrame: this.startFrame,
        durationFrames: this.durationFrames,
        localFrameOffset: this.localFrameOffset,
        playbackRate: this.playbackRate,
        loop: this.loop,
        overrides: { ...this.overrides }
      }
    };
  }
}
