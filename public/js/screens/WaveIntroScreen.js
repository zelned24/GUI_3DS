/**
 * WaveIntroScreen.js
 * Stage intro banner before entering battle for Waves 1 through 10.
 * TOP (400x240): Wave banner (e.g. WAVE 01 / 10), biome silhouette, threat intel.
 * BOTTOM (320x240): Encounter briefing, enemy details, and [ENGAGE COMBAT] prompt.
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';
import { dataManager } from '../data/DataManager.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

export class WaveIntroScreen extends BaseScreen {
  constructor(appShell) {
    super(appShell);
    this.waveDef = null;
    this.spriteResolver = new PokemonSpriteResolver();
  }

  async enter(payload = {}) {
    this.waveDef = payload.waveDefinition || this.appShell.waveManager.getCurrentWaveDefinition();
    this._render();
  }

  _render() {
    if (!this.topEl || !this.bottomEl || !this.waveDef) return;

    const locale = dataManager.getLocale();
    const isEs = locale.startsWith('es');
    const enemySpecies = dataManager.getSpecies(this.waveDef.enemySpeciesId) || dataManager.getAllSpecies()[0];
    const enemyName = enemySpecies.getName ? enemySpecies.getName(locale) : enemySpecies.name;
    const spriteRes = this.spriteResolver.resolvePokemonSprite(enemySpecies.speciesId);
    const spriteUrl = spriteRes.exists ? spriteRes.assetPaths.image : `images/pokemon/${enemySpecies.speciesId}.png`;

    const titleText = this.waveDef.isBoss
      ? (isEs ? `👑 JEFE FINAL: Golem Alfa` : `👑 FINAL BOSS: Alpha Golem`)
      : (this.waveDef.isMiniBoss
        ? (isEs ? `⚠️ MINI-JEFE: Golem Veterano` : `⚠️ MINI-BOSS: Veteran Golem`)
        : (isEs ? `Encuentro Salvaje - Oleada ${this.waveDef.waveNumber}` : `Wild Encounter - Wave ${this.waveDef.waveNumber}`));

    // TOP SCREEN (400x240): Cinematic Stage Banner
    this.topEl.innerHTML = `
      <div class="screen-view wave-top-view ${this.waveDef.isBoss ? 'boss-wave' : ''}">
        <div class="wave-badge-top">
          <span>${isEs ? 'OLEADA' : 'WAVE'} ${String(this.waveDef.waveNumber).padStart(2, '0')} / 10</span>
        </div>
        <div class="wave-title-big">${titleText}</div>
        <div class="wave-silhouette-box">
          <img src="${spriteUrl}" alt="${enemyName}" class="wave-enemy-sprite" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="sprite-fallback" style="display:none; font-size:36px;">👾</div>
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240): Intel & Action
    this.bottomEl.innerHTML = `
      <div class="screen-view wave-bottom-view">
        <div class="wave-card">
          <div class="wave-target-name">${enemyName} <span class="wave-lvl">Lv. ${this.waveDef.enemyLevel}</span></div>
          <div class="wave-type-row">
            <span class="type-pill type-${enemySpecies.type1.toLowerCase()}">${enemySpecies.type1}</span>
            ${enemySpecies.type2 && enemySpecies.type2 !== 'NONE' ? `<span class="type-pill type-${enemySpecies.type2.toLowerCase()}">${enemySpecies.type2}</span>` : ''}
          </div>
          <div class="wave-desc">
            ${this.waveDef.isBoss
              ? (isEs ? '⚠️ PELIGRO: ¡El Jefe de la etapa Alfa se aproxima!' : '⚠️ DANGER: Alpha stage boss approaching! Prepare your moves.')
              : (isEs ? '¡Un rival salvaje aparece en el escenario 3DS!' : 'A wild encounter emerges on the 3DS arena!')}
          </div>
          <button id="btn_start_wave_battle" class="btn-game-touch primary pulse">
            <span class="btn-text">${isEs ? 'ENTRAR EN BATALLA ➔' : 'ENGAGE COMBAT ➔'}</span>
          </button>
        </div>
      </div>
    `;

    this.bottomEl.querySelector('#btn_start_wave_battle')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.BATTLE);
    });
  }

  handleInput(gameInput) {
    if (gameInput.action === 'CONFIRM') {
      this.appShell.transitionTo(AppStates.BATTLE);
      return true;
    }
    return false;
  }
}
