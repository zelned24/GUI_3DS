/**
 * PokemonGrid.js
 * 3DS PokéRogue Starter Selection Grid Component.
 * Supports: PokemonGrid, Species, Forms, Shiny, Cost, Sprite/Icon, Stats, Touch, Focus.
 * Perfectly fitted for the 3DS Bottom Screen (320x240).
 */

import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

export class PokemonGrid extends BaseComponent {
  static schema = {
    type: 'PokemonGrid',
    displayName: 'Pokemon Grid (Starters)',
    category: 'PokéRogue Data Views',
    icon: '📊',
    description: 'Grid of starter Pokémon showing Cost, Shiny, Stats and responsive to Touch & D-Pad',
    capabilities: ['render', 'touch', 'focus', 'data-binding'],
    properties: {
      columns: Props.integer('Columns', 3, { min: 1, max: 6, category: 'Layout' }),
      rows: Props.integer('Rows', 2, { min: 1, max: 4, category: 'Layout' }),
      selectedIndex: Props.integer('Selected Cell Index', 0, { min: 0, category: 'State' }),
      action: Props.action('On Select Action', 'SELECT_STARTER', { category: 'Interaction' }),
      focusId: Props.integer('Focus ID', 0, { min: 0, category: 'Interaction' }),
      startersData: Props.json('Starters Payload', [
        { speciesId: 1, name: 'Bulbasaur', cost: 3, shiny: false, hp: 45, atk: 49, def: 49 },
        { speciesId: 4, name: 'Charmander', cost: 3, shiny: false, hp: 39, atk: 52, def: 43 },
        { speciesId: 7, name: 'Squirtle', cost: 3, shiny: false, hp: 44, atk: 48, def: 65 },
        { speciesId: 25, name: 'Pikachu', cost: 4, shiny: true, hp: 35, atk: 55, def: 40 },
        { speciesId: 74, name: 'Geodude', cost: 2, shiny: false, hp: 40, atk: 80, def: 100 },
        { speciesId: 76, name: 'Golem', cost: 5, shiny: false, hp: 80, atk: 120, def: 130 }
      ], { category: 'Data' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'PokemonGrid',
      width: Math.round(data.width ?? 300),
      height: Math.round(data.height ?? 190)
    });
    this._iconImages = new Map();
  }

  draw(ctx, options = {}) {
    const { columns, rows, selectedIndex, startersData } = this.properties;
    const w = this.width;
    const h = this.height;

    const cols = Math.max(1, columns || 3);
    const rws = Math.max(1, rows || 2);
    const cellWidth = Math.floor(w / cols);
    const cellHeight = Math.floor(h / rws);

    const items = Array.isArray(startersData) ? startersData : [];
    const isFocused = options.focusedId === this.id || options.focusedIndex === this.properties.focusId;

    // Background panel
    ctx.fillStyle = '#181b24';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = isFocused ? '#ffcb05' : '#2d3748';
    ctx.lineWidth = isFocused ? 2 : 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    for (let r = 0; r < rws; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= items.length) break;

        const item = items[idx];
        const cellX = c * cellWidth;
        const cellY = r * cellHeight;
        const isSelected = (idx === selectedIndex);

        // Cell background
        ctx.fillStyle = isSelected ? '#2a344d' : '#1f2430';
        ctx.fillRect(cellX + 2, cellY + 2, cellWidth - 4, cellHeight - 4);

        // Highlight border
        ctx.strokeStyle = isSelected ? '#63b3ed' : '#2d3748';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(cellX + 2.5, cellY + 2.5, cellWidth - 5, cellHeight - 5);

        // Cost Badge (PokéRogue starter cost)
        const cost = item.cost || 3;
        ctx.fillStyle = '#e28743';
        ctx.fillRect(cellX + cellWidth - 18, cellY + 4, 14, 12);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cost), cellX + cellWidth - 11, cellY + 10);

        // Shiny icon
        if (item.shiny) {
          ctx.fillStyle = '#ecc94b';
          ctx.font = '10px sans-serif';
          ctx.fillText('★', cellX + 10, cellY + 10);
        }

        // Species name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(item.name || 'Pokemon').substring(0, 10), cellX + 6, cellY + cellHeight - 14);

        // Mini Stats summary (HP/ATK)
        ctx.fillStyle = '#a0aec0';
        ctx.font = '8px monospace';
        ctx.fillText(`HP:${item.hp || 0} ATK:${item.atk || 0}`, cellX + 6, cellY + cellHeight - 4);

        // Draw Icon if available
        const iconPath = PokemonSpriteResolver.resolveIcon(item.speciesId || 1);
        const iconUrl = `/api/pokerogue/asset?path=${encodeURIComponent(iconPath)}`;
        let img = this._iconImages.get(iconUrl);

        if (!img) {
          img = new Image();
          img.src = iconUrl;
          this._iconImages.set(iconUrl, img);
        }

        if (img.complete && img.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = false;
          // Center icon in top portion of cell
          const iconSize = Math.min(32, cellHeight - 24);
          const iconX = cellX + Math.floor((cellWidth - iconSize) / 2);
          const iconY = cellY + 8;
          ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        } else {
          // Minimal fallback box
          ctx.fillStyle = '#2d3748';
          ctx.fillRect(cellX + Math.floor(cellWidth / 2) - 12, cellY + 12, 24, 24);
          ctx.fillStyle = '#718096';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`#${item.speciesId}`, cellX + Math.floor(cellWidth / 2), cellY + 24);
        }
      }
    }
  }

  /**
   * Translates 3DS Touch coordinate into cell selection.
   */
  handleTouch(localX, localY) {
    const { columns, rows, startersData } = this.properties;
    const cols = Math.max(1, columns || 3);
    const rws = Math.max(1, rows || 2);
    const cellWidth = Math.floor(this.width / cols);
    const cellHeight = Math.floor(this.height / rws);

    const c = Math.floor(localX / cellWidth);
    const r = Math.floor(localY / cellHeight);

    if (c >= 0 && c < cols && r >= 0 && r < rws) {
      const idx = r * cols + c;
      const count = Array.isArray(startersData) ? startersData.length : 0;
      if (idx < count) {
        this.properties.selectedIndex = idx;
        return {
          type: 'SELECT_STARTER',
          index: idx,
          item: startersData[idx]
        };
      }
    }
    return null;
  }
}
