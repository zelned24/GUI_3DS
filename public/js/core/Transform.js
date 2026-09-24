/**
 * Transform - 2D spatial transform for 3DS UI nodes.
 * Supports position, size, scale, pivot, rotation, and opacity with
 * quantization to integer coordinates for the physical Nintendo 3DS screens.
 */
export class Transform {
  /**
   * @param {Object} data 
   */
  constructor(data = {}) {
    // Local Position (relative to parent or screen origin)
    this.x = data.x !== undefined ? Math.round(data.x) : 0;
    this.y = data.y !== undefined ? Math.round(data.y) : 0;

    // Dimensions
    this.width = data.width !== undefined ? Math.max(1, Math.round(data.width)) : 100;
    this.height = data.height !== undefined ? Math.max(1, Math.round(data.height)) : 40;

    // Scale
    this.scaleX = data.scaleX !== undefined ? parseFloat(data.scaleX) : 1.0;
    this.scaleY = data.scaleY !== undefined ? parseFloat(data.scaleY) : 1.0;

    // Normalized Pivot [0..1] (default 0,0: top-left)
    this.pivotX = data.pivotX !== undefined ? parseFloat(data.pivotX) : 0.0;
    this.pivotY = data.pivotY !== undefined ? parseFloat(data.pivotY) : 0.0;

    // Rotation in degrees
    this.rotation = data.rotation !== undefined ? parseFloat(data.rotation) : 0.0;

    // Opacity [0.0 .. 1.0]
    this.opacity = data.opacity !== undefined ? Math.max(0, Math.min(1, parseFloat(data.opacity))) : 1.0;
  }

  /**
   * Sets position with integer pixel snapping.
   */
  setPosition(x, y) {
    this.x = Math.round(x);
    this.y = Math.round(y);
  }

  /**
   * Sets dimensions with minimum constraints and integer pixel snapping.
   */
  setSize(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
  }

  /**
   * Returns physical quantized integers for 3DS Citro2D runtime.
   */
  getQuantized3DSTransform() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      width: Math.round(this.width),
      height: Math.round(this.height),
      scaleX: parseFloat(this.scaleX.toFixed(3)),
      scaleY: parseFloat(this.scaleY.toFixed(3)),
      rotation: Math.round(this.rotation),
      opacity: parseFloat(this.opacity.toFixed(2))
    };
  }

  /**
   * Clones the transform.
   */
  clone() {
    return new Transform(this.toJSON());
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      rotation: this.rotation,
      opacity: this.opacity
    };
  }
}
