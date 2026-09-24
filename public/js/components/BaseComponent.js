/**
 * BaseComponent - Base abstraction for all 3DS UI Studio components.
 */
export class BaseComponent {
  /**
   * @param {Object} data 
   */
  constructor(data = {}) {
    this.id = data.id || `comp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.type = data.type || 'BaseComponent';
    this.screen = data.screen || 'top'; // 'top' | 'bottom'
    this.x = Math.round(data.x ?? 0);
    this.y = Math.round(data.y ?? 0);
    this.width = Math.round(data.width ?? 64);
    this.height = Math.round(data.height ?? 32);
    this.visible = data.visible !== false;
    this.enabled = data.enabled !== false;
    this.zIndex = Math.round(data.zIndex ?? 1);
    this.parent = data.parent || null;
    this.properties = { ...this.getDefaultProperties(), ...(data.properties || {}) };
  }

  getDefaultProperties() {
    return {};
  }

  /**
   * Clones the component with optional overrides.
   */
  clone(overrides = {}) {
    return new this.constructor({
      ...this.toJSON(),
      id: overrides.id || `${this.id}_copy`,
      x: overrides.x !== undefined ? Math.round(overrides.x) : this.x + 8,
      y: overrides.y !== undefined ? Math.round(overrides.y) : this.y + 8,
      ...overrides
    });
  }

  /**
   * Render component onto an HTML5 2D Canvas context.
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} options 
   */
  render(ctx, options = {}) {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    this.draw(ctx, options);
    ctx.restore();
  }

  /**
   * Override in subclass to draw component contents at local (0, 0).
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} options 
   */
  draw(ctx, options) {
    // Default placeholder
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Serializes component to clean, JSON-compatible object.
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      screen: this.screen,
      x: Math.round(this.x),
      y: Math.round(this.y),
      width: Math.round(this.width),
      height: Math.round(this.height),
      visible: Boolean(this.visible),
      enabled: Boolean(this.enabled),
      zIndex: Math.round(this.zIndex),
      parent: this.parent || null,
      properties: { ...this.properties }
    };
  }
}
