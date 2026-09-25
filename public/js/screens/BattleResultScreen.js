/**
 * BattleResultScreen.js
 * Result Screen for Victory or Defeat.
 * TOP (400x240): Victory / Defeat fanfare banner, score breakdown, turns elapsed.
 * BOTTOM (320x240): Action buttons [NEXT WAVE], [RETRY], [NEW RUN], [TITLE].
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';

export class BattleResultScreen extends BaseScreen {
  constructor(appShell) {
    super(appShell);
    this.resultData = null;
  }

  async enter(payload = {}) {
    this.resultData = payload;
    this._render();
  }

  _render() {
    if (!this.topEl || !this.bottomEl || !this.resultData) return;

    const won = this.resultData.won;
    const wave = this.resultData.wave;
    const isWave10 = wave >= 10 && won;

    // TOP SCREEN (400x240): Fanfare & Performance
    this.topEl.innerHTML = `
      <div class="screen-view result-top-view ${won ? 'result-victory' : 'result-defeat'}">
        <div class="result-banner">
          <h1>${won ? '★ VICTORY! ★' : '☠ DEFEAT ☠'}</h1>
          <div class="result-sub">${won ? `Wave ${wave} Cleared Successfully!` : `Fainted in Wave ${wave}`}</div>
        </div>
        <div class="result-stats-card">
          <div class="res-stat-row"><span>Turns Elapsed:</span> <strong>${this.resultData.turns || 1}</strong></div>
          <div class="res-stat-row"><span>Battle Outcome:</span> <strong>${won ? 'SUCCESS' : 'KNOCKED OUT'}</strong></div>
          ${won ? `<div class="res-stat-row"><span>Wave Progress:</span> <strong>${wave} / 10</strong></div>` : ''}
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240): Controls
    this.bottomEl.innerHTML = `
      <div class="screen-view result-bottom-view">
        <div class="result-actions-box">
          <div class="result-prompt-title">
            ${won ? (isWave10 ? '👑 CONGRATULATIONS! ALL WAVES BEATEN!' : 'READY FOR THE NEXT WAVE?') : 'TRY AGAIN?'}
          </div>

          ${won ? `
            <button id="btn_next_action" class="btn-game-touch primary pulse">
              <span class="btn-text">${isWave10 ? 'VIEW RUN SUMMARY ➔' : 'NEXT WAVE ➔'}</span>
            </button>
          ` : `
            <button id="btn_retry_action" class="btn-game-touch primary">
              <span class="btn-text">RETRY WAVE</span>
            </button>
            <button id="btn_new_run_action" class="btn-game-touch secondary">
              <span class="btn-text">NEW RUN</span>
            </button>
          `}

          <button id="btn_title_action" class="btn-game-touch secondary">
            <span class="btn-text">RETURN TO TITLE</span>
          </button>
        </div>
      </div>
    `;

    this._bindEvents(won, isWave10);
  }

  _bindEvents(won, isWave10) {
    if (won) {
      this.bottomEl.querySelector('#btn_next_action')?.addEventListener('click', () => {
        this.appShell.advanceWave();
      });
    } else {
      this.bottomEl.querySelector('#btn_retry_action')?.addEventListener('click', () => {
        this.appShell.transitionTo(AppStates.WAVE_INTRO);
      });
      this.bottomEl.querySelector('#btn_new_run_action')?.addEventListener('click', () => {
        this.appShell.transitionTo(AppStates.SETUP);
      });
    }

    this.bottomEl.querySelector('#btn_title_action')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.TITLE);
    });
  }

  handleInput(gameInput) {
    if (gameInput.action === 'CONFIRM') {
      if (this.resultData.won) {
        this.appShell.advanceWave();
      } else {
        this.appShell.transitionTo(AppStates.WAVE_INTRO);
      }
      return true;
    }
    return false;
  }
}
