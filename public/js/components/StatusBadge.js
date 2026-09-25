/**
 * StatusBadge.js
 * 3DS PokéRogue Status Badge Component.
 * Binds to status condition (PSN, TOX, BRN, PAR, SLP, FRZ, FNT) with authentic colors.
 */

import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

export class StatusBadge extends BaseComponent {
  static schema = {
    type: 'StatusBadge',
    displayName: 'Status Badge',
    category: 'PokéRogue Data Views',
    icon: '🏷️',
    description: 'Status ailment indicator bound to Pokémon status condition',
    capabilities: ['render', 'data-binding'],
    properties: {
      statusBinding: Props.string('Binding Key', 'pikachu.status', { category: 'Data Binding' }),
      status: Props.enum('Status Condition', 'NONE', [
        'NONE', 'PAR', 'BRN', 'PSN', 'TOX', 'SLP', 'FRZ', 'FNT'
      ], { category: 'Data' }),
      compact: Props.boolean('Compact View', false, { category: 'Display' }),
      fontSize: Props.integer('Font Size', 10, { min: 8, max: 14, category: 'Display' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'StatusBadge',
      width: Math.round(data.width ?? 48),
      height: Math.round(data.height ?? 18)
    });
  }

  draw(ctx) {
    const { status, fontSize } = this.properties;
    if (!status || status === 'NONE') return;

    const statusColors = {
      PAR: { bg: '#d69e2e', border: '#b7791f', text: '#ffffff', label: 'PAR' },
      BRN: { bg: '#e53e3e', border: '#c53030', text: '#ffffff', label: 'BRN' },
      PSN: { bg: '#805ad5', border: '#6b46c1', text: '#ffffff', label: 'PSN' },
      TOX: { bg: '#553c9a', border: '#44337a', text: '#ffffff', label: 'TOX' },
      SLP: { bg: '#718096', border: '#4a5568', text: '#ffffff', label: 'SLP' },
      FRZ: { bg: '#319795', border: '#285e61', text: '#ffffff', label: 'FRZ' },
      FNT: { bg: '#1a202c', border: '#171923', text: '#e2e8f0', label: 'FNT' }
    };

    const cfg = statusColors[status] || { bg: '#4a5568', border: '#2d3748', text: '#ffffff', label: status };

    const w = this.width;
    const h = this.height;

    // Background & border
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = cfg.border;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Text
    ctx.fillStyle = cfg.text;
    ctx.font = `bold ${fontSize || 10}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.label, Math.floor(w / 2), Math.floor(h / 2));
  }
}
