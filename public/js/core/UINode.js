import { Transform } from './Transform.js';
import { globalRNG } from './DeterministicRNG.js';

/**
 * UINode - Hierarchical scene node representing any element in the 3DS UI Studio.
 * Inspired by M3DS and modern game engines, with parent-child relationships,
 * relative transforms, and component properties.
 */
export class UINode {
  /**
   * @param {Object} data 
   */
  constructor(data = {}) {
    this.id = data.id || globalRNG.nextId('node');
    this.name = data.name || this.id;
    this.type = data.type || 'UINode';
    this.screen = data.screen || 'top'; // 'top' | 'bottom'
    this.parent = data.parent || null;
    this.children = Array.isArray(data.children) ? [...data.children] : [];

    // Spatial transform
    this.transform = data.transform instanceof Transform
      ? data.transform
      : new Transform({
          x: data.x ?? data.transform?.x ?? 0,
          y: data.y ?? data.transform?.y ?? 0,
          width: data.width ?? data.transform?.width ?? 100,
          height: data.height ?? data.transform?.height ?? 40,
          scaleX: data.transform?.scaleX ?? 1.0,
          scaleY: data.transform?.scaleY ?? 1.0,
          pivotX: data.transform?.pivotX ?? 0.0,
          pivotY: data.transform?.pivotY ?? 0.0,
          rotation: data.transform?.rotation ?? 0.0,
          opacity: data.opacity ?? data.transform?.opacity ?? 1.0
        });

    this.visible = data.visible !== false;
    this.enabled = data.enabled !== false;
    this.locked = Boolean(data.locked);
    this.zIndex = Math.round(data.zIndex ?? 1);
    this.metadata = { ...(data.metadata || {}) };

    // Properties initialized with component defaults and overrides
    const defaultProps = this.getDefaultProperties();
    this.properties = { ...defaultProps, ...(data.properties || {}) };
  }

  // --- Convenience Backward-Compatibility Accessors ---
  get x() { return this.transform.x; }
  set x(val) { this.transform.x = Math.round(val); }

  get y() { return this.transform.y; }
  set y(val) { this.transform.y = Math.round(val); }

  get width() { return this.transform.width; }
  set width(val) { this.transform.width = Math.max(1, Math.round(val)); }

  get height() { return this.transform.height; }
  set height(val) { this.transform.height = Math.max(1, Math.round(val)); }

  get opacity() { return this.transform.opacity; }
  set opacity(val) { this.transform.opacity = Math.max(0, Math.min(1, val)); }

  getDefaultProperties() {
    return {};
  }

  /**
   * Calculates world (screen-space) absolute coordinates by traversing parent hierarchy.
   * @param {Object} model - ProjectModel instance for node lookup
   * @returns {{ x: number, y: number, width: number, height: number, opacity: number }}
   */
  getWorldTransform(model) {
    let wx = this.x;
    let wy = this.y;
    let wOpacity = this.opacity;

    let currentParentId = this.parent;
    let guard = 0;
    while (currentParentId && guard++ < 50) {
      const pNode = model?.getComponent(currentParentId);
      if (!pNode) break;
      wx += pNode.x;
      wy += pNode.y;
      wOpacity *= pNode.opacity;
      currentParentId = pNode.parent;
    }

    return {
      x: Math.round(wx),
      y: Math.round(wy),
      width: this.width,
      height: this.height,
      opacity: parseFloat(wOpacity.toFixed(2))
    };
  }

  /**
   * Adds a child node ID to this node.
   */
  addChild(childId) {
    if (!this.children.includes(childId)) {
      this.children.push(childId);
    }
  }

  /**
   * Removes a child node ID from this node.
   */
  removeChild(childId) {
    this.children = this.children.filter(id => id !== childId);
  }

  /**
   * Checks if this node is a descendant of a given ancestor ID.
   */
  isDescendantOf(ancestorId, model) {
    let currentParent = this.parent;
    let guard = 0;
    while (currentParent && guard++ < 50) {
      if (currentParent === ancestorId) return true;
      const pNode = model?.getComponent(currentParent);
      currentParent = pNode?.parent || null;
    }
    return false;
  }

  /**
   * Render node onto canvas context.
   * If options.evaluatedMap is passed, applies transient animated properties without mutating base document data.
   */
  render(ctx, options = {}) {
    let tf = this.transform;
    let isVisible = this.visible;

    if (options.evaluatedMap && options.evaluatedMap.has(this.id)) {
      const evalData = options.evaluatedMap.get(this.id);
      if (evalData.visible !== undefined) {
        isVisible = evalData.visible;
      }
      if (evalData.opacity !== undefined || (evalData.transform && Object.keys(evalData.transform).length > 0)) {
        const opVal = evalData.opacity !== undefined 
          ? evalData.opacity 
          : (evalData.transform?.opacity !== undefined ? evalData.transform.opacity : this.transform.opacity);
        tf = new Transform({
          x: evalData.transform?.x !== undefined ? Math.round(evalData.transform.x) : this.transform.x,
          y: evalData.transform?.y !== undefined ? Math.round(evalData.transform.y) : this.transform.y,
          width: evalData.transform?.width !== undefined ? Math.round(evalData.transform.width) : this.transform.width,
          height: evalData.transform?.height !== undefined ? Math.round(evalData.transform.height) : this.transform.height,
          scaleX: evalData.transform?.scaleX !== undefined ? parseFloat(evalData.transform.scaleX) : this.transform.scaleX,
          scaleY: evalData.transform?.scaleY !== undefined ? parseFloat(evalData.transform.scaleY) : this.transform.scaleY,
          pivotX: evalData.transform?.pivotX !== undefined ? parseFloat(evalData.transform.pivotX) : this.transform.pivotX,
          pivotY: evalData.transform?.pivotY !== undefined ? parseFloat(evalData.transform.pivotY) : this.transform.pivotY,
          rotation: evalData.transform?.rotation !== undefined ? parseFloat(evalData.transform.rotation) : this.transform.rotation,
          opacity: Math.max(0, Math.min(1, parseFloat(opVal)))
        });
      }
    }

    if (!isVisible) return;
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1.0) * tf.opacity;
    ctx.translate(tf.x, tf.y);

    const hasPivot = (tf.pivotX !== 0 || tf.pivotY !== 0);
    const pivotPxX = tf.width * (tf.pivotX || 0);
    const pivotPxY = tf.height * (tf.pivotY || 0);

    if (hasPivot) {
      ctx.translate(pivotPxX, pivotPxY);
    }
    if (tf.rotation !== 0) {
      ctx.rotate((tf.rotation * Math.PI) / 180);
    }
    if (tf.scaleX !== 1.0 || tf.scaleY !== 1.0) {
      ctx.scale(tf.scaleX, tf.scaleY);
    }
    if (hasPivot) {
      ctx.translate(-pivotPxX, -pivotPxY);
    }

    this.draw(ctx, options);
    ctx.restore();
  }

  /**
   * Override in specialized subclasses.
   */
  draw(ctx, options) {
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Clones node with new ID.
   */
  clone(overrides = {}) {
    const json = this.toJSON();
    return new this.constructor({
      ...json,
      id: overrides.id || `${this.id}_copy`,
      name: overrides.name || `${this.name} Copy`,
      x: overrides.x !== undefined ? Math.round(overrides.x) : this.x + 8,
      y: overrides.y !== undefined ? Math.round(overrides.y) : this.y + 8,
      children: [], // Cloned node starts with fresh children unless recursively cloned
      ...overrides
    });
  }

  /**
   * Serializes node to clean declarative JSON.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      screen: this.screen,
      parent: this.parent || null,
      children: [...this.children],
      transform: this.transform.toJSON(),
      // Top-level spatial shortcuts preserved for simple inspection
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      visible: Boolean(this.visible),
      enabled: Boolean(this.enabled),
      locked: Boolean(this.locked),
      zIndex: Math.round(this.zIndex),
      properties: { ...this.properties },
      metadata: { ...this.metadata }
    };
  }
}
