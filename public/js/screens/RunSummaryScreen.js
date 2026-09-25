/**
 * RunSummaryScreen.js
 * Final run victory screen displayed after conquering Wave 10.
 * TOP (400x240): Hall of fame trophy, run clear fanfare, total waves 10/10.
 * BOTTOM (320x240): Run statistics report and [START NEW RUN] / [RETURN TO TITLE].
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';

export class RunSummaryScreen extends BaseScreen {
  constructor(appShell) {
    super(appShell);
    this.summary = null;
  }

  async enter(payload = {}) {
    this.summary = payload.runSummary || this.appShell.waveManager.getRunSummary();
    this._render();
  }

  _render() {
    if (!this.topEl || !this.bottomEl || !this.summary) return;

    // TOP SCREEN (400x240): Hall of Fame Trophy
    this.topEl.innerHTML = `
      <div class="screen-view summary-top-view">
        <div class="trophy-box">
          <div class="trophy-icon">🏆</div>
          <h1 class="summary-title">RUN COMPLETED!</h1>
          <div class="summary-badge">POKÉROGUE 3DS CHAMPION</div>
          <div class="waves-cleared-text">10 / 10 WAVES CONQUERED</div>
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240): Stats & Action
    this.bottomEl.innerHTML = `
      <div class="screen-view summary-bottom-view">
        <div class="summary-card">
          <div class="summary-header-row">RUN STATISTICS</div>
          <div class="summary-stats-list">
            <div class="sum-row"><span>Battles Won:</span> <strong>${this.summary.wavesCompleted} / 10</strong></div>
            <div class="sum-row"><span>Total Turns:</span> <strong>${this.summary.totalTurns}</strong></div>
            <div class="sum-row"><span>Damage Dealt:</span> <strong>${this.summary.damageDealt} HP</strong></div>
            <div class="sum-row"><span>Damage Taken:</span> <strong>${this.summary.damageTaken} HP</strong></div>
            <div class="sum-row"><span>Partner:</span> <strong>${this.summary.playerSpecies.toUpperCase()} (Lv.${this.summary.playerLevel})</strong></div>
          </div>

          <div class="summary-actions">
            <button id="btn_sum_new_run" class="btn-game-touch primary pulse">
              <span class="btn-text">NEW RUN</span>
            </button>
            <button id="btn_sum_title" class="btn-game-touch secondary">
              <span class="btn-text">MAIN TITLE</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.bottomEl.querySelector('#btn_sum_new_run')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.SETUP);
    });

    this.bottomEl.querySelector('#btn_sum_title')?.addEventListener('click', () => {
      this.appShell.transitionTo(AppStates.TITLE);
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
