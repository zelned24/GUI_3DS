/**
 * BattleScreen.js
 * Dual-Screen Turn-Based Battle Screen conforming to Nintendo 3DS Citro2D layout.
 * TOP SCREEN (400x240): Visual Stage — Opponent & Player battler sprites, health bars, wave badge.
 * BOTTOM SCREEN (320x240): Touch Command Panel — 4 MoveButtons, dialogue combat log, input lock.
 */

import { BaseScreen } from './BaseScreen.js';
import { AppStates } from '../shell/AppShell.js';
import { BattleEngine } from '../battle/BattleEngine.js';
import { SelectMoveCommand } from '../battle/BattleCommand.js';
import { BattleEventTypes } from '../battle/BattleEvents.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

export class BattleScreen extends BaseScreen {
  constructor(appShell) {
    super(appShell);
    this.engine = null;
    this.spriteResolver = new PokemonSpriteResolver();
    this.combatLog = [];
    this.isActionLocked = false;
  }

  async enter() {
    // 1. Create real BattleState from WaveManager
    const state = this.appShell.waveManager.createBattleStateForCurrentWave();
    this.engine = new BattleEngine(state);
    this.combatLog = [`Wave ${state.wave}: Encounter began!`];

    this._bindEngineEvents();
    this._render();
  }

  _bindEngineEvents() {
    this.engine.onEvent((event) => {
      this._handleBattleEvent(event);
    });
  }

  _handleBattleEvent(event) {
    const p = this.engine.state.player.active;
    const e = this.engine.state.enemy.active;

    switch (event.type) {
      case BattleEventTypes.MoveStarted:
        this._addLog(`${event.payload.attacker} used ${event.payload.moveName}!`);
        break;
      case BattleEventTypes.CriticalHit:
        this._addLog(`A critical hit!`);
        break;
      case BattleEventTypes.DamageApplied:
        this._addLog(`${event.payload.target} took ${event.payload.damage} damage!`);
        this._updateHpDisplays();
        break;
      case BattleEventTypes.PokemonFainted:
        this._addLog(`${event.payload.pokemon} fainted!`);
        break;
      case BattleEventTypes.BattleConcluded:
        this._onBattleConcluded(event.payload.winner);
        break;
    }
  }

  _addLog(msg) {
    this.combatLog.push(msg);
    if (this.combatLog.length > 5) this.combatLog.shift();
    const logBox = this.bottomEl?.querySelector('#battle_dialogue_text');
    if (logBox) {
      logBox.innerHTML = this.combatLog.map(m => `<div>${m}</div>`).join('');
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  _render() {
    if (!this.topEl || !this.bottomEl) return;

    const state = this.engine.state;
    const p = state.player.active;
    const e = state.enemy.active;

    const pSpriteRes = this.spriteResolver.resolvePokemonSprite(p.species.speciesId);
    const eSpriteRes = this.spriteResolver.resolvePokemonSprite(e.species.speciesId);

    const pSprite = pSpriteRes.exists ? pSpriteRes.assetPaths.image : `images/pokemon/${p.species.speciesId}.png`;
    const eSprite = eSpriteRes.exists ? eSpriteRes.assetPaths.image : `images/pokemon/${e.species.speciesId}.png`;

    const pHpPct = Math.max(0, Math.min(100, Math.round((p.currentHp / p.maxHp) * 100)));
    const eHpPct = Math.max(0, Math.min(100, Math.round((e.currentHp / e.maxHp) * 100)));

    // TOP SCREEN (400x240): Visual Stage
    this.topEl.innerHTML = `
      <div class="screen-view battle-top-view">
        <div class="battle-top-hud">
          <span class="battle-wave-pill">WAVE ${state.wave} / 10</span>
          <span class="battle-turn-pill">Turn ${state.turn}</span>
        </div>

        <!-- Enemy Battler Row -->
        <div class="battler-row enemy-row">
          <div class="battler-status-plate">
            <div class="plate-name">${e.nickname} <span class="plate-lvl">Lv.${e.level}</span></div>
            <div class="hp-track"><div id="enemy_hp_bar" class="hp-fill hp-${this._getHpColor(eHpPct)}" style="width:${eHpPct}%;"></div></div>
            <div id="enemy_hp_text" class="hp-subtext">${e.currentHp} / ${e.maxHp} HP</div>
          </div>
          <div class="battler-sprite-box">
            <img id="enemy_sprite" src="${eSprite}" alt="${e.nickname}" class="sprite-enemy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="sprite-fallback" style="display:none; font-size:36px;">👾</div>
          </div>
        </div>

        <!-- Player Battler Row -->
        <div class="battler-row player-row">
          <div class="battler-sprite-box">
            <img id="player_sprite" src="${pSprite}" alt="${p.nickname}" class="sprite-player" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="sprite-fallback" style="display:none; font-size:36px;">⚡</div>
          </div>
          <div class="battler-status-plate">
            <div class="plate-name">${p.nickname} <span class="plate-lvl">Lv.${p.level}</span></div>
            <div class="hp-track"><div id="player_hp_bar" class="hp-fill hp-${this._getHpColor(pHpPct)}" style="width:${pHpPct}%;"></div></div>
            <div id="player_hp_text" class="hp-subtext">${p.currentHp} / ${p.maxHp} HP</div>
          </div>
        </div>
      </div>
    `;

    // BOTTOM SCREEN (320x240): Move Selector & Log
    this.bottomEl.innerHTML = `
      <div class="screen-view battle-bottom-view">
        <div class="battle-dialogue-box">
          <div id="battle_dialogue_text" class="dialogue-text">
            ${this.combatLog.map(m => `<div>${m}</div>`).join('')}
          </div>
        </div>

        <div class="moves-grid" id="moves_container">
          ${p.moves.slice(0, 4).map((m, idx) => `
            <button class="game-move-btn" data-move-id="${m.id}" data-idx="${idx}" ${m.pp <= 0 || this.isActionLocked ? 'disabled' : ''}>
              <div class="move-name">${m.name}</div>
              <div class="move-meta">
                <span class="move-type type-${m.type.toLowerCase()}">${m.type}</span>
                <span class="move-pp">${m.pp}/${m.maxPp}</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this._bindMoveButtons();
  }

  _bindMoveButtons() {
    const btns = this.bottomEl.querySelectorAll('.game-move-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const moveId = btn.dataset.moveId;
        this._onSelectMove(moveId);
      });
    });
  }

  async _onSelectMove(moveId) {
    if (this.isActionLocked) return;

    this.isActionLocked = true;
    this.appShell.inputManager.lock('BATTLE_ACTION');
    this._disableMoveButtons(true);

    const cmd = new SelectMoveCommand('player', moveId);
    const result = this.engine.executeCommand(cmd);

    if (!result.success) {
      this._addLog(`Invalid action: ${result.error || 'Cannot use move'}`);
      this.isActionLocked = false;
      this.appShell.inputManager.unlock('BATTLE_ACTION');
      this._disableMoveButtons(false);
      return;
    }

    // Small delay for natural turn reading
    setTimeout(() => {
      if (this.engine.state.winner) {
        return; // Transitioning to result
      }
      this.isActionLocked = false;
      this.appShell.inputManager.unlock('BATTLE_ACTION');
      this._renderMoves();
    }, 600);
  }

  _disableMoveButtons(disabled) {
    const btns = this.bottomEl.querySelectorAll('.game-move-btn');
    btns.forEach(b => b.disabled = disabled);
  }

  _renderMoves() {
    const p = this.engine.state.player.active;
    const container = this.bottomEl.querySelector('#moves_container');
    if (!container) return;

    container.innerHTML = p.moves.slice(0, 4).map((m, idx) => `
      <button class="game-move-btn" data-move-id="${m.id}" data-idx="${idx}" ${m.pp <= 0 || this.isActionLocked ? 'disabled' : ''}>
        <div class="move-name">${m.name}</div>
        <div class="move-meta">
          <span class="move-type type-${m.type.toLowerCase()}">${m.type}</span>
          <span class="move-pp">${m.pp}/${m.maxPp}</span>
        </div>
      </button>
    `).join('');
    this._bindMoveButtons();
  }

  _updateHpDisplays() {
    const p = this.engine.state.player.active;
    const e = this.engine.state.enemy.active;

    const pHpPct = Math.max(0, Math.min(100, Math.round((p.currentHp / p.maxHp) * 100)));
    const eHpPct = Math.max(0, Math.min(100, Math.round((e.currentHp / e.maxHp) * 100)));

    const pHpBar = this.topEl.querySelector('#player_hp_bar');
    const eHpBar = this.topEl.querySelector('#enemy_hp_bar');
    const pHpTxt = this.topEl.querySelector('#player_hp_text');
    const eHpTxt = this.topEl.querySelector('#enemy_hp_text');

    if (pHpBar) {
      pHpBar.style.width = `${pHpPct}%`;
      pHpBar.className = `hp-fill hp-${this._getHpColor(pHpPct)}`;
    }
    if (eHpBar) {
      eHpBar.style.width = `${eHpPct}%`;
      eHpBar.className = `hp-fill hp-${this._getHpColor(eHpPct)}`;
    }
    if (pHpTxt) pHpTxt.innerText = `${p.currentHp} / ${p.maxHp} HP`;
    if (eHpTxt) eHpTxt.innerText = `${e.currentHp} / ${e.maxHp} HP`;
  }

  _getHpColor(pct) {
    if (pct > 50) return 'green';
    if (pct > 20) return 'yellow';
    return 'red';
  }

  _onBattleConcluded(winner) {
    this.isActionLocked = true;
    this.appShell.inputManager.unlock('BATTLE_ACTION');

    const won = winner === 'player';
    this.appShell.waveManager.recordBattleResult({
      won,
      turns: this.engine.state.turn,
      damageDealt: this.engine.state.enemy.active.maxHp - this.engine.state.enemy.active.currentHp,
      damageTaken: this.engine.state.player.active.maxHp - this.engine.state.player.active.currentHp
    });

    setTimeout(() => {
      this.appShell.transitionTo(AppStates.RESULT, {
        won,
        wave: this.engine.state.wave,
        turns: this.engine.state.turn,
        winner
      });
    }, 1000);
  }

  handleInput(gameInput) {
    if (this.isActionLocked) return false;

    // Numerical move shortcuts 1-4
    if (gameInput.action.startsWith('COMMAND_')) {
      const idx = parseInt(gameInput.action.replace('COMMAND_', ''), 10) - 1;
      const p = this.engine.state.player.active;
      if (p.moves[idx]) {
        this._onSelectMove(p.moves[idx].id);
        return true;
      }
    }
    return false;
  }
}
