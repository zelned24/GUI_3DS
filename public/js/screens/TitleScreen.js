/**
 * TitleScreen.js
 * Main game title screen for Nintendo 3DS GUI_3DS.
 * TOP (400x240): Stylized PokéRogue 3DS logo, pixel badges, edition metadata.
 * BOTTOM (320x240): Interactive touch / D-Pad menu [START RUN], [DEBUG MODE], [DATA STUDIO].
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';
import { dataManager } from '../data/DataManager.js';

export class TitleScreen extends BaseScreen {
  async enter() {
    this._render();
  }

  _render() {
    if (!this.topEl || !this.bottomEl) return;

    const locale = dataManager.getLocale();
    const isEs = locale.startsWith('es');

    // TOP SCREEN (400x240)
    this.topEl.innerHTML = `
      <div class="screen-view title-top-view">
        <div class="title-logo-box">
          <div class="title-sub">${isEs ? 'EDICIÓN NINTENDO 3DS' : 'NINTENDO 3DS EDITION'}</div>
          <h1 class="title-main">POKÉROGUE 3DS</h1>
          <div class="title-badge-row">
            <span class="badge-citro">CITRO2D</span>
            <span class="badge-gen9">GEN 9 MATH</span>
            <span class="badge-wave">WAVES 1–10</span>
          </div>
        </div>
        <div class="title-marquee">
          <span>${isEs ? '⚡ PULSA START O TOCA LA PANTALLA PARA EMPEZAR ⚡' : '⚡ PRESS START OR TOUCH SCREEN TO EMBARK ⚡'}</span>
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240)
    this.bottomEl.innerHTML = `
      <div class="screen-view title-bottom-view">
        <div class="menu-box">
          <div class="menu-title">${isEs ? 'MENÚ PRINCIPAL' : 'MAIN MENU'}</div>
          <button id="btn_menu_start" class="btn-game-touch primary">
            <span class="btn-icon">⚔️</span>
            <span class="btn-text">${isEs ? 'INICIAR PARTIDA' : 'START RUN'}</span>
          </button>
          <button id="btn_menu_options" class="btn-game-touch">
            <span class="btn-icon">⚙️</span>
            <span class="btn-text">${isEs ? 'OPCIONES / IDIOMA' : 'OPTIONS'}</span>
          </button>
          <button id="btn_menu_debug" class="btn-game-touch">
            <span class="btn-icon">🛠️</span>
            <span class="btn-text">DEBUG / BATTLE LAB</span>
          </button>
        </div>
        <div class="touch-hint">${isEs ? 'Toca una opción o usa D-Pad + A' : 'Touch an option or use D-Pad + A'}</div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.bottomEl.querySelector('#btn_menu_start')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.SETUP);
    });

    this.bottomEl.querySelector('#btn_menu_options')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.OPTIONS);
    });

    this.bottomEl.querySelector('#btn_menu_debug')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.DEBUG);
    });
  }

  handleInput(gameInput) {
    if (gameInput.action === 'CONFIRM') {
      this.appShell.transitionTo(AppStates.SETUP);
      return true;
    }
    return false;
  }
}
