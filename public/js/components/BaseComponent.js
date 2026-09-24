import { UINode } from '../core/UINode.js';
import { Props } from '../core/PropertySystem.js';

/**
 * BaseComponent - Base class for specialized 3DS UI components.
 * Extends UINode and defines static component schemas for automatic Inspector rendering.
 */
export class BaseComponent extends UINode {
  /**
   * Static schema declaring metadata, capabilities, and typed properties.
   */
  static schema = {
    type: 'BaseComponent',
    displayName: 'Base Component',
    category: 'General',
    icon: '📦',
    description: 'Generic UI node element',
    capabilities: ['render'],
    properties: {
      opacity: Props.float('Opacity', 1.0, { min: 0.0, max: 1.0, step: 0.05, category: 'Transform' })
    }
  };

  constructor(data = {}) {
    super(data);
  }

  getDefaultProperties() {
    const props = {};
    const schemaProps = this.constructor.schema?.properties || {};
    for (const [key, propDef] of Object.entries(schemaProps)) {
      props[key] = propDef.defaultValue;
    }
    return props;
  }
}
