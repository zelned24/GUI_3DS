/**
 * HealthBar.js
 * 3DS PokéRogue Health Bar UI Component with live data binding.
 * Binds to PokemonBattleData (e.g., Pikachu HP) with dynamic color transitions (green/yellow/red)
 * and integer pixel-perfect rendering for Citro2D.
 */

import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

export class HealthBar extends BaseComponent {
  static schema = {
    type: 'HealthBar',
    displayName: 'Health Bar',
    category: 'PokéRogue Data Views',
    icon: '💚',
    description: 'Dynamic HP meter bound to Pokémon combat data',
    capabilities: ['render', 'data-binding'],
    properties: {
      pokemonBinding: Props.string('Pokémon Binding', 'pikachu', { category: 'Data Binding' }),
      currentHp: Props.integer('Current HP', 74, { min: 0, max: 999, category: 'Data' }),
      maxHp: Props.integer('Max HP', 82, { min: 1, max: 999, category: 'Data' }),
      showNumbers: Props.boolean('Show Numeric Text', true, { category: 'Display' }),
      highColor: Props.color('High HP (>50%)', '#48bb78', { category: 'Style' }),
      medColor: Props.color('Medium HP (>20%)', '#ecc94b', { category: 'Style' }),
      lowColor: Props.color('Low HP (<=20%)', '#f56565', { category: 'Style' }),
      backgroundColor: Props.color('Track Background', '#1a202c', { category: 'Style' }),
      borderColor: Props.color('Border Color', '#4a5568', { category: 'Style' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'HealthBar',
      width: Math.round(data.width ?? 160),
      height: Math.round(data.height ?? 18)
    });
  }

  draw(ctx) {
    const {
      currentHp,
      maxHp,
      showNumbers,
      highColor,
      medColor,
      lowColor,
      backgroundColor,
      borderColor
    } = this.properties;

    const w = this.width;
    const h = this.height;
    const cur = Math.max(0, Math.min(currentHp ?? 74, maxHp ?? 82));
    const max = Math.max(1, maxHp ?? 82);
    const ratio = cur / max;
    const percent = Math.round(ratio * 100);

    // HP Bar Color
    const fillColor = percent > 50 ? (highColor || '#48bb78') : percent > 20 ? (medColor || '#ecc94b') : (lowColor || '#f56565');

    // Outer border
    ctx.fillStyle = borderColor || '#4a5568';
    ctx.fillRect(0, 0, w, h);

    // Background track
    const border = 1;
    ctx.fillStyle = backgroundColor || '#1a202c';
    ctx.fillRect(border, border, w - border * 2, h - border * 2);

    // Fill bar
    const barWidth = Math.max(0, Math.round((w - border * 2) * ratio));
    if (barWidth > 0) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(border, border, barWidth, h - border * 2);
    }

    // Numeric display
    if (showNumbers) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cur}/${max}`, w - 4, Math.floor(h / 2));

      ctx.textAlign = 'left';
      ctx.fillStyle = '#cbd5e0';
      ctx.fillText('HP', 4, Math.floor(h / 2));
    }
  }
}
