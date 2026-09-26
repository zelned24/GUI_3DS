import { RogueBox } from './RogueBox.js';
import { PixelText } from './PixelText.js';
import { TouchButton } from './TouchButton.js';
import { HealthBar } from './HealthBar.js';
import { MoveButton } from './MoveButton.js';
import { ImageNode } from './ImageNode.js';
import { PokemonSpriteNode } from './PokemonSpriteNode.js';
import { GroupNode } from './GroupNode.js';
import { CompositionNode } from './CompositionNode.js';

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

// Register components with rich metadata
ComponentRegistry.register('Image', ImageNode, {
  name: 'Image',
  category: 'Visual',
  icon: '🖼️',
  description: '2D Sprite / Texture image element for Nintendo 3DS screens'
});
ComponentRegistry.register('ImageNode', ImageNode);

ComponentRegistry.register('PokemonSprite', PokemonSpriteNode, {
  name: 'Pokémon Sprite',
  category: 'PokéRogue',
  icon: '⚡',
  description: 'Declarative PokéRogue Pokémon sprite with atlas resolution and 3DS t3x targeting'
});
ComponentRegistry.register('PokemonSpriteNode', PokemonSpriteNode);

ComponentRegistry.register('Group', GroupNode, {
  name: 'Group',
  category: 'Containers',
  icon: '📁',
  description: 'Hierarchical node container for organizing child elements'
});
ComponentRegistry.register('GroupNode', GroupNode);

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

ComponentRegistry.register('HealthBar', HealthBar, {
  name: 'Health Bar',
  category: 'PokéRogue Data Views',
  icon: '💚',
  description: 'Dynamic HP meter bound to Pokémon combat data'
});

ComponentRegistry.register('MoveButton', MoveButton, {
  name: 'Move Button',
  category: 'PokéRogue Data Views',
  icon: '⚔️',
  description: 'Combat move slot displaying move name, type, and PP'
});

ComponentRegistry.register('Composition', CompositionNode, {
  name: 'Composition',
  category: 'Compositions',
  icon: '🎞️',
  description: 'Reusable nested scene composition instance with local timeline'
});
ComponentRegistry.register('CompositionNode', CompositionNode);



