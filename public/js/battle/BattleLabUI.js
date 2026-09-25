/**
 * BattleLabUI.js
 * Interactive Battle Simulation & Debugging Studio for PokéRogue 3DS.
 * Renders battler status cards, move selectors, phase debugger, damage breakdown, and event log.
 * Supports dynamic locale switching (EN / ES) purely for presentation without affecting battle state or RNG.
 */

import { PokemonBattleData, BattleState } from './BattleState.js';
import { BattleEngine } from './BattleEngine.js';
import { SelectMoveCommand } from './BattleCommand.js';
import { dataManager } from '../data/DataManager.js';
import { PokemonSpriteResolver } from '../data/PokemonSpriteResolver.js';

export class BattleLabUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.state = null;
    this.engine = null;
    this.spriteResolver = new PokemonSpriteResolver();
    this.playerSpeciesId = 'pikachu';
    this.enemySpeciesId = 'golem';
    this.initSimulation();
  }

  initSimulation(playerSpeciesId = this.playerSpeciesId, enemySpeciesId = this.enemySpeciesId) {
    this.playerSpeciesId = playerSpeciesId;
    this.enemySpeciesId = enemySpeciesId;
    const pSpecies = dataManager.getSpecies(playerSpeciesId) || dataManager.getAllSpecies()[0];
    const eSpecies = dataManager.getSpecies(enemySpeciesId) || dataManager.getAllSpecies()[1] || pSpecies;

    if (!pSpecies || !eSpecies) {
      console.warn('Species not found for BattleLab simulation');
      return;
    }

    const playerPokemon = new PokemonBattleData(pSpecies, 20);
    const enemyPokemon = new PokemonBattleData(eSpecies, 20);

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

    const currentLocale = dataManager.getLocale();
    const p = this.state.player.active;
    const e = this.state.enemy.active;

    const playerSpriteResolved = this.spriteResolver.resolvePokemonSprite(p.species.speciesId);
    const enemySpriteResolved = this.spriteResolver.resolvePokemonSprite(e.species.speciesId);
    const pSpriteUrl = playerSpriteResolved.exists ? playerSpriteResolved.assetPaths.rawImageUrl : '';
    const eSpriteUrl = enemySpriteResolved.exists ? enemySpriteResolved.assetPaths.rawImageUrl : '';

    const playerHpPercent = Math.max(0, Math.min(100, Math.round((p.currentHp / p.maxHp) * 100)));
    const enemyHpPercent = Math.max(0, Math.min(100, Math.round((e.currentHp / e.maxHp) * 100)));
    const allSpecies = dataManager.getAllSpecies();

    const getHpColor = (percent) => percent > 50 ? '#48bb78' : percent > 20 ? '#ecc94b' : '#f56565';

    // Localized helper lookups
    const getLocalizedMoveName = (move) => {
      const def = dataManager.getMove(move.id);
      return def ? def.getName(currentLocale) : (move.name || move.id);
    };

    const getLocalizedAbilityName = (pokemon) => {
      const def = dataManager.getAbility(pokemon.ability);
      return def ? def.getName(currentLocale) : (pokemon.ability || 'None');
    };

    const getLocalizedSpeciesName = (pokemon) => {
      const def = dataManager.getSpecies(pokemon.species.id);
      return def ? def.getName(currentLocale) : (pokemon.nickname || pokemon.species.name);
    };

    this.container.innerHTML = `
      <div class="battle-lab-root">
        <!-- Battle Lab Header -->
        <div class="battle-lab-header">
          <div class="battle-lab-title">
            <span class="battle-lab-badge">BATTLE LAB</span>
            <h2>PokéRogue 3DS Simulation Studio</h2>
          </div>
          <div class="battler-select-toolbar" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <label style="font-size:11px; font-weight:bold; color:#a0aec0;">Player:</label>
            <select id="select-player-battler" class="battler-select" style="background:#2d3748; color:#fff; border:1px solid #4a5568; border-radius:4px; padding:3px 6px; font-size:12px; cursor:pointer;">
              ${allSpecies.map(s => `<option value="${s.id}" ${s.id === this.playerSpeciesId ? 'selected' : ''}>${s.getName(currentLocale)} (#${s.speciesId})</option>`).join('')}
            </select>
            <span style="color:#718096; font-size:11px; font-weight:bold;">VS</span>
            <label style="font-size:11px; font-weight:bold; color:#a0aec0;">Enemy:</label>
            <select id="select-enemy-battler" class="battler-select" style="background:#2d3748; color:#fff; border:1px solid #4a5568; border-radius:4px; padding:3px 6px; font-size:12px; cursor:pointer;">
              ${allSpecies.map(s => `<option value="${s.id}" ${s.id === this.enemySpeciesId ? 'selected' : ''}>${s.getName(currentLocale)} (#${s.speciesId})</option>`).join('')}
            </select>
            <button id="btn-apply-matchup" style="background:#3182ce; color:#fff; border:none; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:bold; cursor:pointer;">Set Matchup</button>

            <!-- Language Switcher Toolbar (Pure presentation) -->
            <div class="locale-switcher" style="margin-left:auto; display:flex; align-items:center; gap:4px; background:#1a202c; padding:2px 6px; border-radius:4px; border:1px solid #4a5568;">
              <span style="font-size:10px; font-weight:bold; color:#a0aec0;">🌐 LANG:</span>
              <button id="btn-lang-en" class="btn-lang ${currentLocale === 'en' ? 'active' : ''}" style="background:${currentLocale === 'en' ? '#4299e1' : 'transparent'}; color:#fff; border:none; border-radius:3px; padding:2px 5px; font-size:10px; cursor:pointer; font-weight:bold;">EN</button>
              <button id="btn-lang-es" class="btn-lang ${currentLocale.startsWith('es') ? 'active' : ''}" style="background:${currentLocale.startsWith('es') ? '#4299e1' : 'transparent'}; color:#fff; border:none; border-radius:3px; padding:2px 5px; font-size:10px; cursor:pointer; font-weight:bold;">ES</button>
            </div>
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
                <h3>${getLocalizedSpeciesName(p)} <span class="battler-lvl">Lv.${p.level}</span></h3>
                <div class="type-tags">
                  ${p.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('')}
                  ${p.status ? `<span class="status-badge">${p.status.toUpperCase()}</span>` : ''}
                </div>
              </div>
              <div class="battler-sprite">
                <img src="${pSpriteUrl}" alt="${p.species.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="sprite-fallback" style="display:${pSpriteUrl ? 'none' : 'block'};">⚡</div>
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
              <span>Ability: <b>${getLocalizedAbilityName(p)}</b></span>
            </div>
          </div>

          <!-- Enemy Pokemon Card -->
          <div class="battler-card enemy-card ${e.fainted ? 'fainted' : ''}">
            <div class="battler-header">
              <div class="battler-info">
                <h3>${getLocalizedSpeciesName(e)} <span class="battler-lvl">Lv.${e.level}</span></h3>
                <div class="type-tags">
                  ${e.types.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('')}
                  ${e.status ? `<span class="status-badge">${e.status.toUpperCase()}</span>` : ''}
                </div>
              </div>
              <div class="battler-sprite">
                <img src="${eSpriteUrl}" alt="${e.species.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="sprite-fallback" style="display:${eSpriteUrl ? 'none' : 'block'};">🪨</div>
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
              <span>Ability: <b>${getLocalizedAbilityName(e)}</b></span>
            </div>
          </div>
        </div>

        <!-- Command & Moves Section -->
        <div class="battle-commands-panel">
          <div class="section-title">COMMAND PHASE — ${currentLocale.startsWith('es') ? 'SELECCIONA MOVIMIENTO' : 'SELECT PLAYER MOVE'}</div>
          <div class="moves-grid">
            ${p.moves.map(m => `
              <button class="move-button" data-move-id="${m.id}" ${p.fainted || e.fainted ? 'disabled' : ''}>
                <div class="move-btn-top">
                  <span class="move-name">${getLocalizedMoveName(m)}</span>
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
                  <span class="event-desc">${this._formatEvent(ev, currentLocale)}</span>
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

  _formatEvent(ev, locale = 'en') {
    const isEs = locale.startsWith('es');
    switch (ev.type) {
      case 'TurnStarted':
        return isEs ? `Turno ${ev.turn} iniciado.` : `Turn ${ev.turn} started.`;
      case 'MoveStarted': {
        const moveDef = dataManager.getMove(ev.move);
        const moveName = moveDef ? moveDef.getName(locale) : ev.move;
        return isEs ? `¡${ev.user} usó ${moveName}!` : `${ev.user} used ${moveName}!`;
      }
      case 'MoveMissed': {
        const moveDef = dataManager.getMove(ev.move);
        const moveName = moveDef ? moveDef.getName(locale) : ev.move;
        return isEs ? `¡El ${moveName} de ${ev.user} falló!` : `${ev.user}'s ${moveName} missed!`;
      }
      case 'MoveHit': {
        const moveDef = dataManager.getMove(ev.move);
        const moveName = moveDef ? moveDef.getName(locale) : ev.move;
        return isEs ? `¡${moveName} alcanzó a ${ev.target}!` : `${moveName} connected with ${ev.target}!`;
      }
      case 'DamageApplied':
        return isEs ? `¡${ev.target} recibió ${ev.damage} de daño! (Restante: ${ev.currentHp}/${ev.maxHp})` : `${ev.target} took ${ev.damage} damage! (Remaining: ${ev.currentHp}/${ev.maxHp})`;
      case 'AbilityTriggered': {
        const abDef = dataManager.getAbility(ev.ability);
        const abName = abDef ? abDef.getName(locale) : ev.ability;
        return `[${abName}] ${ev.effect}`;
      }
      case 'StatusApplied':
        return isEs ? `¡${ev.pokemon} fue afectado por ${ev.status}!` : `${ev.pokemon} was inflicted with ${ev.status}!`;
      case 'StatusPreventedMove':
        return isEs ? `¡${ev.user} está paralizado! ¡No se puede mover!` : `${ev.user} is paralyzed! It can't move!`;
      case 'PokemonFainted':
        return isEs ? `¡${ev.pokemon} se debilitó!` : `${ev.pokemon} fainted!`;
      case 'TurnEnded':
        return isEs ? `Turno ${ev.turn - 1} finalizado.` : `Turn ${ev.turn - 1} finished.`;
      case 'TurnRewound':
        return isEs ? `Rebobinado al Turno ${ev.turn}.` : `Rewound to Turn ${ev.turn}.`;
      default:
        return JSON.stringify(ev);
    }
  }

  _bindEvents() {
    // Language Switcher Buttons (Purely alters presentation without altering BattleState or RNG)
    const btnEn = this.container.querySelector('#btn-lang-en');
    const btnEs = this.container.querySelector('#btn-lang-es');

    if (btnEn) {
      btnEn.addEventListener('click', () => {
        dataManager.setLocale('en');
        this.render();
      });
    }

    if (btnEs) {
      btnEs.addEventListener('click', () => {
        dataManager.setLocale('es-ES');
        this.render();
      });
    }

    // Move Buttons
    this.container.querySelectorAll('.move-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const moveId = e.currentTarget.dataset.moveId;
        const cmd = new SelectMoveCommand('player', moveId);
        this.engine.executeCommand(cmd);
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

    // Battler Selectors
    const playerSelect = this.container.querySelector('#select-player-battler');
    const enemySelect = this.container.querySelector('#select-enemy-battler');
    const applyMatchupBtn = this.container.querySelector('#btn-apply-matchup');

    const updateMatchup = () => {
      if (playerSelect && enemySelect) {
        this.initSimulation(playerSelect.value, enemySelect.value);
        this.render();
      }
    };

    if (playerSelect) playerSelect.addEventListener('change', updateMatchup);
    if (enemySelect) enemySelect.addEventListener('change', updateMatchup);
    if (applyMatchupBtn) applyMatchupBtn.addEventListener('click', updateMatchup);
  }
}
