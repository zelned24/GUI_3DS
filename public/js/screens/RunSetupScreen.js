/**
 * RunSetupScreen.js
 * Run Preparation and Starter Selection Screen for GUI_3DS.
 * TOP (400x240): Selected Pokémon inspection (Type, Base Stats, Ability, Moves).
 * BOTTOM (320x240): Interactive touch selector for Pokémon, Level, and [CONFIRM & START].
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';
import { dataManager } from '../data/DataManager.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

export class RunSetupScreen extends BaseScreen {
  constructor(appShell) {
    super(appShell);
    this.allSpecies = dataManager.getAllSpecies();
    this.selectedSpeciesId = this.allSpecies[0]?.id || 'pikachu';
    this.selectedLevel = 15;
    this.spriteResolver = new PokemonSpriteResolver();
  }

  async enter() {
    this._render();
  }

  _render() {
    if (!this.topEl || !this.bottomEl) return;

    const locale = dataManager.getLocale();
    const isEs = locale.startsWith('es');
    const sp = dataManager.getSpecies(this.selectedSpeciesId) || this.allSpecies[0];
    const spName = sp.getName ? sp.getName(locale) : sp.name;
    const spriteRes = this.spriteResolver.resolvePokemonSprite(sp.speciesId);
    const spriteUrl = spriteRes.exists ? spriteRes.assetPaths.image : `images/pokemon/${sp.speciesId}.png`;

    // TOP SCREEN (400x240): Battler Preview
    this.topEl.innerHTML = `
      <div class="screen-view setup-top-view">
        <div class="setup-header">
          <span class="badge-tag">${isEs ? 'DATOS DEL POKÉMON' : 'STARTER INTEL'}</span>
          <span class="setup-dex-num">#${sp.speciesId}</span>
        </div>
        <div class="setup-main-grid">
          <div class="setup-sprite-pane">
            <img src="${spriteUrl}" alt="${spName}" class="setup-pkmn-sprite" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="sprite-fallback" style="display:none; font-size:32px;">⚡</div>
            <div class="setup-name">${spName}</div>
            <div class="setup-types">
              <span class="type-pill type-${sp.type1.toLowerCase()}">${sp.type1}</span>
              ${sp.type2 && sp.type2 !== 'NONE' ? `<span class="type-pill type-${sp.type2.toLowerCase()}">${sp.type2}</span>` : ''}
            </div>
          </div>
          <div class="setup-stats-pane">
            <div class="stat-row"><span>PS / HP</span> <strong>${sp.baseStats.hp}</strong></div>
            <div class="stat-row"><span>${isEs ? 'ATAQUE' : 'ATK'}</span> <strong>${sp.baseStats.atk}</strong></div>
            <div class="stat-row"><span>${isEs ? 'DEFENSA' : 'DEF'}</span> <strong>${sp.baseStats.def}</strong></div>
            <div class="stat-row"><span>${isEs ? 'ATQ. ESP' : 'SP.ATK'}</span> <strong>${sp.baseStats.spatk}</strong></div>
            <div class="stat-row"><span>${isEs ? 'DEF. ESP' : 'SP.DEF'}</span> <strong>${sp.baseStats.spdef}</strong></div>
            <div class="stat-row"><span>${isEs ? 'VELOCIDAD' : 'SPD'}</span> <strong>${sp.baseStats.spd}</strong></div>
            <div class="ability-row">${isEs ? 'Habilidad' : 'Ability'}: <strong>${sp.abilities.primary || 'Static'}</strong></div>
          </div>
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240): Touch Setup Controls
    this.bottomEl.innerHTML = `
      <div class="screen-view setup-bottom-view">
        <div class="setup-card">
          <div class="setup-section-title">${isEs ? 'ELIGE TU POKÉMON INICIAL' : 'CHOOSE YOUR STARTER'}</div>
          <div class="setup-field">
            <label>${isEs ? 'Especie Pokémon:' : 'Pokémon Species:'}</label>
            <select id="select_starter_species" class="game-select">
              ${this.allSpecies.map(s => `
                <option value="${s.id}" ${s.id === this.selectedSpeciesId ? 'selected' : ''}>
                  ${s.getName ? s.getName(locale) : s.name} (#${s.speciesId})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="setup-field">
            <label>${isEs ? 'Nivel Inicial:' : 'Starting Level:'}</label>
            <div class="level-control">
              <button id="btn_lvl_down" class="btn-step">-5</button>
              <span id="lvl_display" class="lvl-val">Lv. ${this.selectedLevel}</span>
              <button id="btn_lvl_up" class="btn-step">+5</button>
            </div>
          </div>

          <div class="setup-actions">
            <button id="btn_setup_back" class="btn-game-touch secondary">${isEs ? 'ATRÁS' : 'BACK'}</button>
            <button id="btn_setup_start" class="btn-game-touch primary">${isEs ? 'EMPEZAR ➔' : 'EMBARK ➔'}</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.bottomEl.querySelector('#select_starter_species')?.addEventListener('change', (e) => {
      this.selectedSpeciesId = e.target.value;
      this._render();
    });

    this.bottomEl.querySelector('#btn_lvl_down')?.addEventListener('click', () => {
      this.selectedLevel = Math.max(5, this.selectedLevel - 5);
      this._render();
    });

    this.bottomEl.querySelector('#btn_lvl_up')?.addEventListener('click', () => {
      this.selectedLevel = Math.min(50, this.selectedLevel + 5);
      this._render();
    });

    this.bottomEl.querySelector('#btn_setup_back')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.TITLE);
    });

    this.bottomEl.querySelector('#btn_setup_start')?.addEventListener('click', () => {
      this.appShell.startNewRun({
        speciesId: this.selectedSpeciesId,
        level: this.selectedLevel
      });
    });
  }

  handleInput(gameInput) {
    if (gameInput.action === 'CONFIRM') {
      this.appShell.startNewRun({
        speciesId: this.selectedSpeciesId,
        level: this.selectedLevel
      });
      return true;
    } else if (gameInput.action === 'CANCEL') {
      this.appShell.transitionTo(AppStates.TITLE);
      return true;
    }
    return false;
  }
}
