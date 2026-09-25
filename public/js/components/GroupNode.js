import { BaseComponent } from './BaseComponent.js';

/**
 * GroupNode - Structural grouping container node for 3DS Scene Graphs.
 * Allows moving, scaling, rotating, and animating child nodes together.
 */
export class GroupNode extends BaseComponent {
  static schema = {
    type: 'Group',
    displayName: 'Group',
    category: 'Containers',
    icon: '📁',
    description: 'Hierarchical node container for organizing child elements',
    capabilities: ['container'],
    properties: {}
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'Group',
      width: Math.round(data.width ?? 100),
      height: Math.round(data.height ?? 100)
    });
  }

  draw(ctx, options = {}) {
    // Only render subtle visual boundaries if explicitly enabled in authoring mode
    if (options.showGroupBounds) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }
}
