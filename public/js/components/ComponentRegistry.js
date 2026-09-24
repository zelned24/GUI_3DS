import { RogueBox } from './RogueBox.js';
import { PixelText } from './PixelText.js';
import { TouchButton } from './TouchButton.js';

/**
 * ComponentRegistry - Registry for instantiating and describing 3DS UI components.
 */
export class ComponentRegistry {
  static components = new Map();

  static register(type, componentClass, metadata = {}) {
    this.components.set(type, {
      type,
      componentClass,
      name: metadata.name || type,
      category: metadata.category || 'General',
      icon: metadata.icon || '📦',
      description: metadata.description || ''
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
}

// Register MVP components
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
