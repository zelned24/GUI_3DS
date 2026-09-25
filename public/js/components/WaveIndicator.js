/**
 * WaveIndicator.js
 * 3DS PokéRogue Wave & Biome Indicator Component.
 * Displays wave progress, current biome, and boss encounter warnings.
 */

import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

export class WaveIndicator extends BaseComponent {
  static schema = {
    type: 'WaveIndicator',
    displayName: 'Wave Indicator',
    category: 'PokéRogue Data Views',
    icon: '🌊',
    description: 'Displays current run wave number, biome and boss wave indicator',
    capabilities: ['render', 'data-binding'],
    properties: {
      wave: Props.integer('Current Wave', 1, { min: 1, max: 250, category: 'Data' }),
      biome: Props.string('Biome Name', 'TOWN', { category: 'Data' }),
      isBoss: Props.boolean('Is Boss Wave', false, { category: 'Data' }),
      showProgressDots: Props.boolean('Show 10-Wave Dots', true, { category: 'Display' }),
      backgroundColor: Props.color('Background Color', '#1a202c', { category: 'Style' }),
      textColor: Props.color('Text Color', '#ffffff', { category: 'Style' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'WaveIndicator',
      width: Math.round(data.width ?? 120),
      height: Math.round(data.height ?? 32)
    });
  }

  draw(ctx) {
    const { wave, biome, isBoss, showProgressDots, backgroundColor, textColor } = this.properties;
    const w = this.width;
    const h = this.height;

    const bossWave = isBoss || (wave % 10 === 0);

    // Frame
    ctx.fillStyle = backgroundColor || '#1a202c';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = bossWave ? '#e53e3e' : '#4a5568';
    ctx.lineWidth = bossWave ? 2 : 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Wave Text
    ctx.fillStyle = bossWave ? '#fc8181' : (textColor || '#ffffff');
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`WAVE ${wave || 1}`, 6, 4);

    // Biome Text
    ctx.fillStyle = '#a0aec0';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(biome || 'TOWN').toUpperCase(), w - 6, 4);

    // Progress Dots for 10-wave cycle
    if (showProgressDots) {
      const cycleStep = ((wave - 1) % 10) + 1; // 1 to 10
      const dotRadius = 2;
      const startX = 6;
      const dotY = h - 8;
      const spacing = Math.floor((w - 12) / 10);

      for (let i = 1; i <= 10; i++) {
        const x = startX + (i - 1) * spacing + dotRadius;
        ctx.beginPath();
        ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2);
        if (i < cycleStep) {
          ctx.fillStyle = '#48bb78'; // Completed
        } else if (i === cycleStep) {
          ctx.fillStyle = bossWave ? '#f56565' : '#ecc94b'; // Current
        } else {
          ctx.fillStyle = '#2d3748'; // Future
        }
        ctx.fill();
      }
    }
  }
}
