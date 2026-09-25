/**
 * AIAdapter.js
 * Intelligent combat decision system.
 * Evaluates candidates based on damage prediction, type effectiveness, KO potential, priority, and status synergy.
 * Provides full explainability via AIDecision, AICandidate, AIScore, and AIReason.
 */

import { dataManager } from '../../data/DataManager.js';

export class AIReason {
  constructor(tag, scoreDelta, explanation) {
    this.tag = tag;
    this.scoreDelta = scoreDelta;
    this.explanation = explanation;
  }
}

export class AICandidate {
  constructor(actionType, move, target) {
    this.actionType = actionType; // 'MOVE' | 'SWITCH' | 'ITEM'
    this.move = move;
    this.target = target;
    this.score = 0;
    this.reasons = [];
  }

  addReason(tag, scoreDelta, explanation) {
    this.score += scoreDelta;
    this.reasons.push(new AIReason(tag, scoreDelta, explanation));
  }
}

export class AIDecision {
  constructor(selectedCandidate, allCandidates = []) {
    this.selectedCandidate = selectedCandidate;
    this.allCandidates = allCandidates;
    this.chosenAction = selectedCandidate ? selectedCandidate.move?.id : null;
    this.confidenceScore = selectedCandidate ? selectedCandidate.score : 0;
  }
}

export class AIAdapter {
  static selectBestAction(aiPokemon, playerPokemon, battleContext = {}) {
    const moves = aiPokemon.moves || [];
    const candidates = [];

    for (const move of moves) {
      const candidate = new AICandidate('MOVE', move, playerPokemon);

      // 1. Base Power factor
      const pwr = move.power || 0;
      candidate.addReason('BASE_POWER', pwr * 0.5, `Move base power ${pwr}`);

      // 2. Type Effectiveness
      const mult = dataManager.getTypeMultiplier(move.type, playerPokemon.types);
      if (mult >= 2.0) {
        candidate.addReason('SUPER_EFFECTIVE', 40 * mult, `Super effective against target types (${mult}x)`);
      } else if (mult === 0) {
        candidate.addReason('TYPE_IMMUNITY', -200, `Target is immune to ${move.type} moves (0x)`);
      } else if (mult < 1.0) {
        candidate.addReason('NOT_VERY_EFFECTIVE', -30, `Not very effective against target (${mult}x)`);
      }

      // 3. STAB Bonus
      if (aiPokemon.types.includes(move.type)) {
        candidate.addReason('STAB_BONUS', 15, `Same Type Attack Bonus (1.5x damage)`);
      }

      // 4. Finishing blow check (KO potential)
      if (pwr > 0 && mult > 0) {
        const estDmg = Math.floor((pwr * mult * 0.8) + 10);
        if (estDmg >= playerPokemon.currentHp) {
          candidate.addReason('LETHAL_KO', 100, `Estimated damage (${estDmg}) can knock out opponent (${playerPokemon.currentHp} HP)`);
        }
      }

      // 5. Priority finisher
      if ((move.priority || 0) > 0) {
        candidate.addReason('PRIORITY', 15 * move.priority, `Priority bracket advantage (+${move.priority})`);
      }

      candidates.push(candidate);
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const best = candidates.length > 0 ? candidates[0] : null;
    return new AIDecision(best, candidates);
  }
}
