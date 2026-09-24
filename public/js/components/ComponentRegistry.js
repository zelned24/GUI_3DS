import { RogueBox } from './RogueBox.js';
import { PixelText } from './PixelText.js';
import { TouchButton } from './TouchButton.js';

/**
 * ComponentRegistry - Registry for instantiating and describing 3DS UI components & nodes.
 */
export class ComponentRegistry {
  static components = new Map();

  static register(type, componentClass, metadata = {}) {
    const schema = componentClass.schema || {};
    this.components.set(type, {
      type,
      componentClass,
      name: metadata.name || schema.displayName || type,
      category: metadata.category || schema.category || 'General',
      icon: metadata.icon || schema.icon || '📦',
      description: metadata.description || schema.description || '',
      capabilities: schema.capabilities || ['render'],
      schema
    });
  }

  static create(type, data = {}) {
    const entry = this.components.get(type);
    if (!entry) {
      console.warn(`Unknown component type: "${type}", falling back to RogueBox`);
      return new RogueBox(data);
    }
    return new entry.componentClass(data);
  }

  static getAll() {
    return Array.from(this.components.values());
  }

  static get(type) {
    return this.components.get(type);
  }

  static getSchema(type) {
    return this.components.get(type)?.schema || null;
  }
}

// Register MVP components with rich metadata
ComponentRegistry.register('RogueBox', RogueBox, {
  name: 'Rogue Box',
  category: 'Containers',
  icon: '🔲',
  description: 'PokéRogue-style styled frame/panel'
});

ComponentRegistry.register('PixelText', PixelText, {
  name: 'Pixel Text',
  category: 'Typography',
  icon: '🔤',
  description: 'Crisp bitmap font text element'
});

ComponentRegistry.register('TouchButton', TouchButton, {
  name: 'Touch Button',
  category: 'Interactive',
  icon: '🔘',
  description: 'Interactive button for touch or D-pad focus'
});
