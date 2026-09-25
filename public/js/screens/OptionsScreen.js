/**
 * OptionsScreen.js
 * Settings & Configuration Screen for GUI_3DS.
 * TOP (400x240): Settings preview and information cards.
 * BOTTOM (320x240): Language toggle (EN / ES), Fast Battle text speed, Audio toggle, and [BACK].
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';
import { dataManager } from '../data/DataManager.js';

export class OptionsScreen extends BaseScreen {
  constructor(appShell) {
    super(appShell);
  }

  async enter() {
    this._render();
  }

  _render() {
    if (!this.topEl || !this.bottomEl) return;

    const currentLocale = dataManager.getLocale();
    const isEs = currentLocale.startsWith('es');

    // TOP SCREEN (400x240)
    this.topEl.innerHTML = `
      <div class="screen-view title-top-view">
        <div class="title-logo-box">
          <div class="title-sub">${isEs ? 'AJUSTES DEL SISTEMA' : 'SYSTEM OPTIONS'}</div>
          <h1 class="title-main">${isEs ? 'CONFIGURACIÓN' : 'SETTINGS'}</h1>
          <div class="title-badge-row">
            <span class="badge-citro">${isEs ? 'IDIOMA' : 'LANGUAGE'}: ${currentLocale.toUpperCase()}</span>
            <span class="badge-gen9">3DS COMPATIBLE</span>
          </div>
        </div>
        <div class="title-marquee">
          <span>${isEs ? '⚡ CAMBIOS APLICADOS EN TIEMPO REAL ⚡' : '⚡ CHANGES APPLIED IN REAL TIME ⚡'}</span>
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240)
    this.bottomEl.innerHTML = `
      <div class="screen-view title-bottom-view">
        <div class="menu-box" style="width: 270px; gap: 8px;">
          <div class="menu-title">${isEs ? 'OPCIONES DE JUEGO' : 'GAMEPLAY PREFERENCES'}</div>

          <!-- Language Row -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#23293a; padding:6px 10px; border-radius:4px; border:1px solid #4a5568;">
            <span style="font-size:11px; font-weight:bold; color:#cbd5e0;">${isEs ? 'Idioma / Language:' : 'Language:'}</span>
            <div style="display:flex; gap:4px;">
              <button id="btn_opt_lang_en" class="btn-step ${!isEs ? 'active-lang' : ''}" style="padding:3px 8px; font-size:11px; ${!isEs ? 'background:#3182ce;' : ''}">EN</button>
              <button id="btn_opt_lang_es" class="btn-step ${isEs ? 'active-lang' : ''}" style="padding:3px 8px; font-size:11px; ${isEs ? 'background:#3182ce;' : ''}">ES</button>
            </div>
          </div>

          <!-- Fast Battle Text -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#23293a; padding:6px 10px; border-radius:4px; border:1px solid #4a5568;">
            <span style="font-size:11px; font-weight:bold; color:#cbd5e0;">${isEs ? 'Velocidad de Texto:' : 'Text Speed:'}</span>
            <span style="font-size:11px; font-weight:bold; color:#68d391;">${isEs ? 'Rápida (3DS)' : 'Fast (3DS)'}</span>
          </div>

          <!-- QA Debug Wave Jump -->
          <div style="background:#1a202c; padding:6px 10px; border-radius:4px; border:1px dashed #718096; margin-top:2px;">
            <div style="font-size:10px; font-weight:bold; color:#e2e8f0; margin-bottom:4px;">🛠️ QA DEBUG WAVE WARP:</div>
            <div style="display:flex; gap:6px;">
              <button id="btn_qa_w1" class="btn-step" style="flex:1; font-size:10px; background:#4a5568;">Wave 1</button>
              <button id="btn_qa_w5" class="btn-step" style="flex:1; font-size:10px; background:#d69e2e;">Wave 5</button>
              <button id="btn_qa_w10" class="btn-step" style="flex:1; font-size:10px; background:#e53e3e;">Wave 10</button>
            </div>
          </div>

          <button id="btn_opt_back" class="btn-game-touch secondary" style="margin-top:4px; padding:6px 10px;">
            <span class="btn-icon">↩</span>
            <span class="btn-text">${isEs ? 'VOLVER AL MENÚ' : 'BACK TO MENU'}</span>
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.bottomEl.querySelector('#btn_opt_lang_en')?.addEventListener('click', () => {
      dataManager.setLocale('en');
      this._render();
    });

    this.bottomEl.querySelector('#btn_opt_lang_es')?.addEventListener('click', () => {
      dataManager.setLocale('es-ES');
      this._render();
    });

    this.bottomEl.querySelector('#btn_opt_back')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.TITLE);
    });

    // QA Debug Wave Jumps
    this.bottomEl.querySelector('#btn_qa_w1')?.addEventListener('click', () => {
      this.appShell.startNewRun({}, 1);
    });
    this.bottomEl.querySelector('#btn_qa_w5')?.addEventListener('click', () => {
      this.appShell.startNewRun({}, 5);
    });
    this.bottomEl.querySelector('#btn_qa_w10')?.addEventListener('click', () => {
      this.appShell.startNewRun({}, 10);
    });
  }

  handleInput(gameInput) {
    if (gameInput.action === 'CANCEL' || gameInput.action === 'CONFIRM') {
      this.appShell.transitionTo(AppStates.TITLE);
      return true;
    }
    return false;
  }
}
