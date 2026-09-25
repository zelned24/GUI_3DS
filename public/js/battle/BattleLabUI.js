/**
 * BattleLabUI.js
 * Interactive Battle Simulation & Debugging Studio for PokéRogue 3DS.
 * Renders battler status cards, move selectors, phase debugger, damage breakdown, and event log.
 */

import { PokemonBattleData, BattleState } from './BattleState.js';
import { BattleEngine } from './BattleEngine.js';
import { dataManager } from '../data/DataManager.js';

export class BattleLabUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = null;
    this.engine = null;
    this.initSimulation();
  }

  initSimulation() {
    const pikaSpecies = dataManager.getSpecies('pikachu');
    const golemSpecies = dataManager.getSpecies('golem');

    if (!pikaSpecies || !golemSpecies) {
      console.warn('Species not found for BattleLab simulation');
      return;
    }

    const playerPokemon = new PokemonBattleData(pikaSpecies, 20);
    const enemyPokemon = new PokemonBattleData(golemSpecies, 20);

    this.state = new BattleState(playerPokemon, enemyPokemon, 4242);
    this.engine = new BattleEngine(this.state);

    // Subscribe to engine events for real-time UI updates
    this.engine.on('HPChanged', () => this.render());
    this.engine.on('StatusApplied', () => this.render());
    this.engine.on('PokemonFainted', () => this.render());
    this.engine.on('TurnEnded', () => this.render());
    this.engine.on('TurnRewound', () => this.render());
    this.engine.on('DamageCalculated', () => this.render());
    this.engine.on('AbilityTriggered', () => this.render());
  }

  render() {
    if (!this.container || !this.state) return;

    const p = this.state.player.active;
    const e = this.state.enemy.active;

    const playerHpPercent = Math.max(0, Math.min(100, Math.round((p.currentHp / p.maxHp) * 100)));
    const enemyHpPercent = Math.max(0, Math.min(100, Math.round((e.currentHp / e.maxHp) * 100)));

    const getHpColor = (percent) => percent > 50 ? '#48bb78' : percent > 20 ? '#ecc94b' : '#f56565';

    this.container.innerHTML = `
      <div class="battle-lab-root">
        <!-- Battle Lab Header -->
        <div class="battle-lab-header">
          <div class="battle-lab-title">
            <span class="battle-lab-badge">BATTLE LAB</span>
            <h2>PokéRogue 3DS Simulation Studio</h2>
          </div>
          <div class="battle-lab-meta">
            <span class="tag">Wave ${this.state.wave}</span>
            <span class="tag">Turn ${this.state.turn}</span>
            <span class="tag phase-tag">${this.state.phase}</span>
            <span class="tag seed-tag">Seed: ${this.state.seed}</span>
          </div>
        </div>

        <!-- Combat Arena Overview -->
        <div class="battle-arena-grid">
          <!-- Player Pokemon Card -->
          <div class="battler-card player-card ${p.fainted ? 'fainted' : ''}">
            <div class="battler-header">
              <div class="battler-info">
                <h3>${p.nickname} <span class="battler-lvl">Lv.${p.level}</span></h3>
                <div class="type-tags">
                  ${p.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('')}
                  ${p.status ? `<span class="status-badge">${p.status.toUpperCase()}</span>` : ''}
                </div>
              </div>
              <div class="battler-sprite">
                <img src="${dataManager.getSpecies('pikachu')?.sprites?.icon || 'assets/pikachu.png'}" alt="Pikachu" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="sprite-fallback" style="display:none;">⚡</div>
              </div>
            </div>

            <!-- Health Bar Binding -->
            <div class="health-bar-container">
              <div class="health-bar-label">
                <span>HP</span>
                <span>${p.currentHp} / ${p.maxHp}</span>
              </div>
              <div class="health-bar-track">
                <div class="health-bar-fill" style="width: ${playerHpPercent}%; background: ${getHpColor(playerHpPercent)};"></div>
              </div>
            </div>

            <div class="battler-stats-mini">
              <span>ATK ${p.getEffectiveStat('atk')}</span>
              <span>DEF ${p.getEffectiveStat('def')}</span>
              <span>SPA ${p.getEffectiveStat('spatk')}</span>
              <span>SPD ${p.getEffectiveStat('spd')}</span>
              <span>Ability: <b>${p.ability}</b></span>
            </div>
          </div>

          <!-- Enemy Pokemon Card -->
          <div class="battler-card enemy-card ${e.fainted ? 'fainted' : ''}">
            <div class="battler-header">
              <div class="battler-info">
                <h3>${e.nickname} <span class="battler-lvl">Lv.${e.level}</span></h3>
                <div class="type-tags">
                  ${e.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('')}
                  ${e.status ? `<span class="status-badge">${e.status.toUpperCase()}</span>` : ''}
                </div>
              </div>
              <div class="battler-sprite">
                <img src="${dataManager.getSpecies('golem')?.sprites?.icon || 'assets/golem.png'}" alt="Golem" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="sprite-fallback" style="display:none;">🪨</div>
              </div>
            </div>

            <!-- Health Bar Binding -->
            <div class="health-bar-container">
              <div class="health-bar-label">
                <span>HP</span>
                <span>${e.currentHp} / ${e.maxHp}</span>
              </div>
              <div class="health-bar-track">
                <div class="health-bar-fill" style="width: ${enemyHpPercent}%; background: ${getHpColor(enemyHpPercent)};"></div>
              </div>
            </div>

            <div class="battler-stats-mini">
              <span>ATK ${e.getEffectiveStat('atk')}</span>
              <span>DEF ${e.getEffectiveStat('def')}</span>
              <span>SPA ${e.getEffectiveStat('spatk')}</span>
              <span>SPD ${e.getEffectiveStat('spd')}</span>
              <span>Ability: <b>${e.ability}</b></span>
            </div>
          </div>
        </div>

        <!-- Command & Moves Section -->
        <div class="battle-commands-panel">
          <div class="section-title">COMMAND PHASE — SELECT PLAYER MOVE</div>
          <div class="moves-grid">
            ${p.moves.map(m => `
              <button class="move-button" data-move-id="${m.id}" ${p.fainted || e.fainted ? 'disabled' : ''}>
                <div class="move-btn-top">
                  <span class="move-name">${m.name}</span>
                  <span class="move-pp">PP ${m.pp}/${m.maxPp}</span>
                </div>
                <div class="move-btn-bottom">
                  <span class="type-badge type-${m.type.toLowerCase()}">${m.type}</span>
                  <span class="category-badge">${m.category}</span>
                  <span class="power-badge">PWR ${m.power || '—'}</span>
                </div>
              </button>
            `).join('')}
          </div>

          <!-- Simulation Flow Controls -->
          <div class="simulation-controls">
            <button id="btn-step-phase" class="btn btn-secondary" title="Execute next phase in queue">⏭ Step Phase</button>
            <button id="btn-undo-turn" class="btn btn-secondary" title="Rewind to previous turn snapshot">↩ Undo Turn</button>
            <button id="btn-reset-sim" class="btn btn-danger" title="Reset simulation to initial state">🔄 Reset</button>
          </div>
        </div>

        <!-- Debuggers Row -->
        <div class="debuggers-grid">
          <!-- Damage Debugger -->
          <div class="debugger-panel damage-debugger">
            <div class="debugger-title">📐 DAMAGE DEBUGGER</div>
            ${this.state.damageBreakdown ? `
              <div class="damage-breakdown-list">
                <div class="breakdown-row"><span>Move</span><b>${this.state.damageBreakdown.move} (${this.state.damageBreakdown.category})</b></div>
                <div class="breakdown-row"><span>Attacker / Target</span><b>${this.state.damageBreakdown.attacker} ➔ ${this.state.damageBreakdown.defender}</b></div>
                <div class="breakdown-row"><span>Base Power</span><b>${this.state.damageBreakdown.basePower}</b></div>
                <div class="breakdown-row"><span>Effective Stats</span><b>A: ${this.state.damageBreakdown.attackStat} / D: ${this.state.damageBreakdown.defenseStat}</b></div>
                <div class="breakdown-row"><span>STAB Multiplier</span><b>${this.state.damageBreakdown.stab}x</b></div>
                <div class="breakdown-row"><span>Type Effectiveness</span><b style="color: ${this.state.damageBreakdown.typeEffectiveness === 0 ? '#f56565' : this.state.damageBreakdown.typeEffectiveness > 1 ? '#48bb78' : '#cbd5e0'}">${this.state.damageBreakdown.typeEffectiveness}x</b></div>
                <div class="breakdown-row"><span>Critical Hit</span><b>${this.state.damageBreakdown.isCritical ? 'YES (1.5x)' : 'NO (1.0x)'}</b></div>
                <div class="breakdown-row"><span>RNG Roll</span><b>${this.state.damageBreakdown.randomFactor}</b></div>
                <div class="breakdown-row total"><span>Calculated Damage</span><b>${this.state.damageBreakdown.finalDamage} HP</b></div>
              </div>
            ` : `
              <div class="debugger-empty">Select a move and execute a turn to view full damage formula step-by-step breakdown.</div>
            `}
          </div>

          <!-- Event Log -->
          <div class="debugger-panel event-log-panel">
            <div class="debugger-title">📜 BATTLE EVENT LOG (${this.state.eventLog.length})</div>
            <div class="event-log-scroll">
              ${this.state.eventLog.slice(-12).reverse().map(ev => `
                <div class="event-log-item">
                  <span class="event-badge">${ev.type}</span>
                  <span class="event-desc">${this._formatEvent(ev)}</span>
                </div>
              `).join('')}
              ${this.state.eventLog.length === 0 ? '<div class="debugger-empty">Ready for simulation.</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _formatEvent(ev) {
    switch (ev.type) {
      case 'TurnStarted': return `Turn ${ev.turn} started.`;
      case 'MoveStarted': return `${ev.user} used ${ev.move}!`;
      case 'MoveMissed': return `${ev.user}'s ${ev.move} missed!`;
      case 'MoveHit': return `${ev.move} connected with ${ev.target}!`;
      case 'DamageApplied': return `${ev.target} took ${ev.damage} damage! (Remaining: ${ev.currentHp}/${ev.maxHp})`;
      case 'AbilityTriggered': return `[${ev.ability}] ${ev.effect}`;
      case 'StatusApplied': return `${ev.pokemon} was inflicted with ${ev.status}!`;
      case 'StatusPreventedMove': return `${ev.user} is paralyzed! It can't move!`;
      case 'PokemonFainted': return `${ev.pokemon} fainted!`;
      case 'TurnEnded': return `Turn ${ev.turn - 1} finished.`;
      case 'TurnRewound': return `Rewound to Turn ${ev.turn}.`;
      default: return JSON.stringify(ev);
    }
  }

  _bindEvents() {
    // Move Buttons
    this.container.querySelectorAll('.move-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const moveId = e.currentTarget.dataset.moveId;
        this.engine.runFullTurn(moveId);
        this.render();
      });
    });

    // Step Phase Button
    const stepBtn = this.container.querySelector('#btn-step-phase');
    if (stepBtn) {
      stepBtn.addEventListener('click', () => {
        if (this.engine.phaseQueue.length === 0) {
          // If queue empty, queue turn with default move
          this.engine.queueTurn(this.state.player.active.moves[0].id);
        }
        this.engine.step();
        this.render();
      });
    }

    // Undo Turn Button
    const undoBtn = this.container.querySelector('#btn-undo-turn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.engine.rewindToPreviousTurn();
        this.render();
      });
    }

    // Reset Sim Button
    const resetBtn = this.container.querySelector('#btn-reset-sim');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.initSimulation();
        this.render();
      });
    }
  }
}
