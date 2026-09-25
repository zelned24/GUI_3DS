/**
 * BattleLabUI.js
 * Advanced Interactive Battle Simulation & Debugging Studio for PokéRogue 3DS.
 * Features:
 *  - Player & Enemy battler configuration (Species, Level, Nature, Status, Weather, Terrain)
 *  - Phase Debugger with Queued Phases inspection & Step-by-Step execution
 *  - Gen 9 Damage Debugger detailing Level, Power, Atk, Def, Base Formula, STAB, Type, Crit, Weather, Random, Final
 *  - Explainable AI Decision Inspector (Candidates, Scores, Reasons)
 *  - Deterministic PRNG and Monotonic Sequence Number event logging
 *  - Real Citro2D asset references and sprite views
 */

import { PokemonBattleData, BattleState } from './BattleState.js';
import { BattleEngine } from './BattleEngine.js';
import { dataManager } from '../data/DataManager.js';

export class BattleLabUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = null;
    this.engine = null;
    this.playerSpeciesId = 'pikachu';
    this.enemySpeciesId = 'golem';
    this.selectedWeather = 'none';
    this.selectedTerrain = 'none';
    this.activeTab = 'debugger'; // 'debugger', 'ai', 'config'
    this.initSimulation();
  }

  initSimulation(seed = 4242) {
    const pikaSpecies = dataManager.getSpecies(this.playerSpeciesId);
    const golemSpecies = dataManager.getSpecies(this.enemySpeciesId);

    if (!pikaSpecies || !golemSpecies) {
      console.warn('Species not found for BattleLab simulation');
      return;
    }

    const playerPokemon = new PokemonBattleData(pikaSpecies, 20);
    const enemyPokemon = new PokemonBattleData(golemSpecies, 20);

    this.state = new BattleState(playerPokemon, enemyPokemon, seed);
    this.state.weather = this.selectedWeather;
    this.state.terrain = this.selectedTerrain;
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

    const pikaSpecies = dataManager.getSpecies(p.speciesId);
    const golemSpecies = dataManager.getSpecies(e.speciesId);

    const pIconUrl = `/api/pokerogue/asset?path=${encodeURIComponent(pikaSpecies?.sprites?.icon || 'images/pokemon/icons/1/25.png')}`;
    const eIconUrl = `/api/pokerogue/asset?path=${encodeURIComponent(golemSpecies?.sprites?.icon || 'images/pokemon/icons/1/76.png')}`;

    const queuedPhases = this.engine.phaseQueue.getQueuedPhaseNames();

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
            <span class="tag prng-tag">RNG Calls: ${this.state.rng.callCount}</span>
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
                <img src="${pIconUrl}" alt="${p.nickname}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="missing-asset-banner" style="display:none; font-size:9px;">MISSING ASSET</div>
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
              <span>Ability: <b>${p.ability}</b></span>
              <span>Nature: <b>${p.nature}</b></span>
            </div>

            <!-- Move Selectors -->
            <div class="battler-moves-panel">
              <div class="panel-subtitle">Select Player Command:</div>
              <div class="moves-grid">
                ${p.moves.map(m => `
                  <button class="move-button type-${m.type.toLowerCase()}" data-move-id="${m.id}" ${p.fainted || e.fainted ? 'disabled' : ''}>
                    <div class="move-btn-top">
                      <span class="move-btn-name">${m.name}</span>
                      <span class="move-btn-pp">${m.pp}/${m.maxPp}</span>
                    </div>
                    <div class="move-btn-bottom">
                      <span class="move-btn-type">${m.type}</span>
                      <span class="move-btn-power">Pwr ${m.power || '—'}</span>
                    </div>
                  </button>
                `).join('')}
              </div>
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
                <img src="${eIconUrl}" alt="${e.nickname}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="missing-asset-banner" style="display:none; font-size:9px;">MISSING ASSET</div>
              </div>
            </div>

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
              <span>Ability: <b>${e.ability}</b></span>
              <span>Nature: <b>${e.nature}</b></span>
            </div>

            <div class="battler-moves-panel">
              <div class="panel-subtitle">Enemy Moveset (AI Driven):</div>
              <div class="moves-grid">
                ${e.moves.map(m => `
                  <div class="move-button-static type-${m.type.toLowerCase()}">
                    <span class="move-btn-name">${m.name}</span>
                    <span class="move-btn-power">Pwr ${m.power}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Simulation Toolbar -->
        <div class="simulation-controls">
          <div class="btn-group">
            <button id="btn-step-phase" class="btn btn-sm" title="Execute next phase in queue">▶ Step Phase</button>
            <button id="btn-undo-turn" class="btn btn-sm" title="Rewind to previous turn snapshot" ${this.engine.turnHistory.length === 0 ? 'disabled' : ''}>↶ Rewind Turn</button>
            <button id="btn-reset-sim" class="btn btn-sm" title="Reset simulation with current seed">🔄 Reset Match</button>
          </div>

          <!-- Weather & Terrain Selectors -->
          <div class="field-selectors">
            <label>Weather:
              <select id="select-weather">
                <option value="none" ${this.state.weather === 'none' ? 'selected' : ''}>Clear</option>
                <option value="rain" ${this.state.weather === 'rain' ? 'selected' : ''}>Rain</option>
                <option value="sun" ${this.state.weather === 'sun' ? 'selected' : ''}>Harsh Sun</option>
                <option value="sandstorm" ${this.state.weather === 'sandstorm' ? 'selected' : ''}>Sandstorm</option>
                <option value="snow" ${this.state.weather === 'snow' ? 'selected' : ''}>Snow</option>
              </select>
            </label>
            <label>Terrain:
              <select id="select-terrain">
                <option value="none" ${this.state.terrain === 'none' ? 'selected' : ''}>None</option>
                <option value="electric" ${this.state.terrain === 'electric' ? 'selected' : ''}>Electric</option>
                <option value="grassy" ${this.state.terrain === 'grassy' ? 'selected' : ''}>Grassy</option>
                <option value="misty" ${this.state.terrain === 'misty' ? 'selected' : ''}>Misty</option>
                <option value="psychic" ${this.state.terrain === 'psychic' ? 'selected' : ''}>Psychic</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Lower Grid: Phase Debugger, Damage Debugger, Explainable AI, Event Log -->
        <div class="debugger-grid">
          <!-- Phase Debugger -->
          <div class="debugger-panel">
            <div class="debugger-title">⚡ PHASE DEBUGGER</div>
            <div class="phase-debug-content">
              <div>Active Phase: <span class="badge-phase">${this.state.phase}</span></div>
              <div style="margin-top: 6px;">Queued Phases:</div>
              <div class="phase-queue-list">
                ${queuedPhases.length > 0 ? queuedPhases.map((q, idx) => `
                  <div class="phase-item ${idx === 0 ? 'next-phase' : ''}">${idx + 1}. ${q}</div>
                `).join('') : '<span class="text-muted">Queue empty (waiting for command)</span>'}
              </div>
            </div>
          </div>

          <!-- Gen 9 Damage Debugger -->
          <div class="debugger-panel">
            <div class="debugger-title">🎯 DAMAGE FORMULA DEBUGGER</div>
            ${this.state.damageBreakdown ? `
              <div class="breakdown-table">
                <div class="breakdown-row"><span>Move:</span> <b>${this.state.damageBreakdown.move} (${this.state.damageBreakdown.moveType} / ${this.state.damageBreakdown.category})</b></div>
                <div class="breakdown-row"><span>Attacker / Target:</span> <b>${this.state.damageBreakdown.attacker} ➔ ${this.state.damageBreakdown.defender}</b></div>
                <div class="breakdown-row"><span>Level / Base Power:</span> <b>Lv.${this.state.damageBreakdown.level} / Pwr ${this.state.damageBreakdown.power}</b></div>
                <div class="breakdown-row"><span>Effective Stats:</span> <b>Atk: ${this.state.damageBreakdown.attackStat} / Def: ${this.state.damageBreakdown.defenseStat}</b></div>
                <div class="breakdown-row"><span>Base Formula Result:</span> <b>${this.state.damageBreakdown.baseFormulaValue}</b></div>
                <div class="breakdown-row"><span>STAB Multiplier:</span> <b>${this.state.damageBreakdown.stab}x</b></div>
                <div class="breakdown-row"><span>Type Effectiveness:</span> <b style="color: ${this.state.damageBreakdown.typeEffectiveness === 0 ? '#f56565' : this.state.damageBreakdown.typeEffectiveness > 1 ? '#48bb78' : '#cbd5e0'}">${this.state.damageBreakdown.typeEffectiveness}x</b></div>
                <div class="breakdown-row"><span>Critical Hit:</span> <b>${this.state.damageBreakdown.isCritical ? 'YES (1.5x)' : 'NO (1.0x)'}</b></div>
                <div class="breakdown-row"><span>Weather Multiplier:</span> <b>${this.state.damageBreakdown.weatherMultiplier}x</b></div>
                <div class="breakdown-row"><span>RNG Random Factor:</span> <b>${this.state.damageBreakdown.randomFactor}</b></div>
                <div class="breakdown-row total"><span>Final Applied Damage:</span> <b>${this.state.damageBreakdown.finalDamage} HP</b></div>
              </div>
            ` : `
              <div class="debugger-empty">Select a move and execute a turn to view full damage formula step-by-step breakdown.</div>
            `}
          </div>

          <!-- Explainable AI Decision Inspector -->
          <div class="debugger-panel">
            <div class="debugger-title">🧠 EXPLAINABLE AI INSPECTOR</div>
            ${this.state.lastAIDecision ? `
              <div class="ai-debug-content">
                <div>Chosen Action: <b>${this.state.lastAIDecision.chosenAction}</b> (Score: ${this.state.lastAIDecision.confidenceScore})</div>
                <div style="margin-top: 8px;">Candidates Evaluated:</div>
                <div class="ai-candidate-list">
                  ${this.state.lastAIDecision.allCandidates.map(c => `
                    <div class="ai-candidate-card ${c === this.state.lastAIDecision.selectedCandidate ? 'chosen' : ''}">
                      <div class="candidate-header">
                        <span><b>${c.move.name}</b></span>
                        <span class="score-badge">Score: ${c.score.toFixed(1)}</span>
                      </div>
                      <ul class="reason-list">
                        ${c.reasons.map(r => `<li>[${r.tag}] ${r.explanation} (${r.scoreDelta > 0 ? '+' : ''}${r.scoreDelta})</li>`).join('')}
                      </ul>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : `
              <div class="debugger-empty">AI decision will be analyzed on the first combat turn.</div>
            `}
          </div>

          <!-- Sequential Event Log -->
          <div class="debugger-panel event-log-panel">
            <div class="debugger-title">📜 DETERMINISTIC EVENT LOG (${this.state.eventLog.length})</div>
            <div class="event-log-scroll">
              ${this.state.eventLog.slice(-12).reverse().map(ev => `
                <div class="event-log-item">
                  <span class="event-seq">#${ev.sequenceNumber}</span>
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
      case 'TurnStarted': return `Turn ${ev.turn} started. [Reason: ${ev.turnOrderReason}]`;
      case 'TurnOrderResolved': return `${ev.first} acts before ${ev.second} (${ev.reason})`;
      case 'MoveStarted': return `${ev.user} used ${ev.move}!`;
      case 'MoveMissed': return `${ev.user}'s ${ev.move} missed! (Roll ${ev.roll} > Threshold ${ev.threshold})`;
      case 'MoveHit': return `${ev.move} hit ${ev.target}!`;
      case 'DamageApplied': return `${ev.target} took ${ev.damage} damage! (${ev.currentHp}/${ev.maxHp} HP)`;
      case 'AbilityTriggered': return `[${ev.ability}] ${ev.effect}`;
      case 'StatusApplied': return `${ev.pokemon} was inflicted with ${ev.status}!`;
      case 'StatusPreventedMove': return ev.message;
      case 'PokemonFainted': return `${ev.pokemon} fainted!`;
      case 'TurnEnded': return `Turn ${ev.turn - 1} completed.`;
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
          this.engine.queueTurn(this.state.player.active.moves[0].id);
        }
        this.engine.step();
        this.render();
      });
    }

    // Rewind Turn Button
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
        this.initSimulation(this.state.seed);
        this.render();
      });
    }

    // Weather Selector
    const weatherSel = this.container.querySelector('#select-weather');
    if (weatherSel) {
      weatherSel.addEventListener('change', (e) => {
        this.selectedWeather = e.target.value;
        this.state.weather = this.selectedWeather;
        this.render();
      });
    }

    // Terrain Selector
    const terrainSel = this.container.querySelector('#select-terrain');
    if (terrainSel) {
      terrainSel.addEventListener('change', (e) => {
        this.selectedTerrain = e.target.value;
        this.state.terrain = this.selectedTerrain;
        this.render();
      });
    }
  }
}
