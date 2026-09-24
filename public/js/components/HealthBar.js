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

  exportCppRender(emitter, screenVar = 'top') {
    const { currentHp, maxHp, highColor, medColor, lowColor, backgroundColor, borderColor } = this.properties;
    const toHex = (c) => emitter.hexColorToC2D(c);

    emitter.line(`// HealthBar: ${this.id}`);
    emitter.line(`{`);
    emitter.indent();
    emitter.line(`float ratio = (float)(${currentHp}) / (float)(${Math.max(1, maxHp)});`);
    emitter.line(`u32 hpColor = ratio > 0.5f ? ${toHex(highColor || '#48bb78')} : (ratio > 0.2f ? ${toHex(medColor || '#ecc94b')} : ${toHex(lowColor || '#f56565')});`);
    emitter.line(`C2D_DrawRectSolid(${this.x}f, ${this.y}f, 0.5f, ${this.width}f, ${this.height}f, ${toHex(borderColor || '#4a5568')});`);
    emitter.line(`C2D_DrawRectSolid(${this.x + 1}f, ${this.y + 1}f, 0.51f, ${this.width - 2}f, ${this.height - 2}f, ${toHex(backgroundColor || '#1a202c')});`);
    emitter.line(`if (ratio > 0.0f) {`);
    emitter.indent();
    emitter.line(`C2D_DrawRectSolid(${this.x + 1}f, ${this.y + 1}f, 0.52f, (${this.width - 2}f) * ratio, ${this.height - 2}f, hpColor);`);
    emitter.unindent();
    emitter.line(`}`);
    emitter.unindent();
    emitter.line(`}`);
  }
}
