/**
 * MoveButton.js
 * 3DS PokéRogue Move Selection Button Component.
 * Binds to MoveDefinition (e.g., Thunderbolt) displaying Type, PP, Category,
 * and responding to 3DS Touch / D-Pad focus.
 */

import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

export class MoveButton extends BaseComponent {
  static schema = {
    type: 'MoveButton',
    displayName: 'Move Button',
    category: 'PokéRogue Data Views',
    icon: '⚡',
    description: 'Battle command button bound to Pokémon move data',
    capabilities: ['render', 'touch', 'focus', 'data-binding'],
    properties: {
      moveBinding: Props.string('Move Binding', 'thunderbolt', { category: 'Data Binding' }),
      moveName: Props.string('Move Name', 'Thunderbolt', { category: 'Data' }),
      moveType: Props.enum('Move Type', 'Electric', [
        'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting',
        'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost',
        'Dragon', 'Dark', 'Steel', 'Fairy'
      ], { category: 'Data' }),
      category: Props.enum('Category', 'Special', ['Physical', 'Special', 'Status'], { category: 'Data' }),
      power: Props.integer('Power', 90, { min: 0, max: 250, category: 'Data' }),
      currentPp: Props.integer('Current PP', 15, { min: 0, max: 64, category: 'Data' }),
      maxPp: Props.integer('Max PP', 15, { min: 1, max: 64, category: 'Data' }),
      action: Props.action('Action Trigger', 'USE_MOVE', { category: 'Interaction' }),
      focusId: Props.integer('Focus ID', 0, { min: 0, category: 'Interaction' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'MoveButton',
      width: Math.round(data.width ?? 145),
      height: Math.round(data.height ?? 40)
    });
  }

  draw(ctx, options = {}) {
    const { moveName, moveType, category, currentPp, maxPp } = this.properties;
    const isPressed = options.pressedId === this.id;
    const isFocused = options.focusedId === this.id || options.focusedIndex === this.properties.focusId;

    const typeColors = {
      Electric: '#f6d851',
      Normal: '#a8a878',
      Fire: '#f08030',
      Water: '#6890f0',
      Grass: '#78c850',
      Ground: '#e0c068',
      Rock: '#b8a038'
    };

    const tColor = typeColors[moveType] || '#718096';
    const w = this.width;
    const h = this.height;

    // Outer frame
    ctx.fillStyle = isFocused ? '#ffcb05' : '#2d3748';
    ctx.fillRect(0, 0, w, h);

    // Inner background
    ctx.fillStyle = isPressed ? '#171923' : '#1a202c';
    ctx.fillRect(1, 1, w - 2, h - 2);

    // Type accent stripe on the left
    ctx.fillStyle = tColor;
    ctx.fillRect(1, 1, 5, h - 2);

    // Move Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(moveName || 'MOVE', 10, 6);

    // Sub-info: Type & PP
    ctx.font = '9px "Courier New", monospace';
    ctx.fillStyle = tColor;
    ctx.fillText((moveType || '').toUpperCase(), 10, 22);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#a0aec0';
    ctx.fillText(`PP ${currentPp ?? 15}/${maxPp ?? 15}`, w - 6, 22);
  }

  exportCppRender(emitter, screenVar = 'bottom') {
    const { moveName, currentPp, maxPp } = this.properties;
    emitter.line(`// MoveButton: ${this.id} (${moveName})`);
    emitter.line(`C2D_DrawRectSolid(${this.x}f, ${this.y}f, 0.5f, ${this.width}f, ${this.height}f, 0xFF48372D);`);
    emitter.line(`C2D_DrawRectSolid(${this.x + 1}f, ${this.y + 1}f, 0.51f, ${this.width - 2}f, ${this.height - 2}f, 0xFF2C201A);`);
    emitter.line(`// Citro2D bitmap text for ${moveName} and PP ${currentPp}/${maxPp}`);
  }
}
