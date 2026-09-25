/**
 * BattleEvents.js
 * Strongly-typed, serializable, deterministic events for PokéRogue 3DS.
 * Free of DOM, UI, and function references.
 */

export class BattleEvent {
  constructor(type, payload = {}, turn = 1, stepIndex = 0) {
    this.type = type;
    this.turn = Number(turn);
    this.stepIndex = Number(stepIndex);
    this.payload = payload;
  }

  toJSON() {
    return {
      type: this.type,
      turn: this.turn,
      stepIndex: this.stepIndex,
      ...this.payload
    };
  }
}

export const BattleEventTypes = Object.freeze({
  TurnStarted: 'TurnStarted',
  MoveSelected: 'MoveSelected',
  MoveStarted: 'MoveStarted',
  MoveMissed: 'MoveMissed',
  MoveHit: 'MoveHit',
  DamageCalculated: 'DamageCalculated',
  DamageApplied: 'DamageApplied',
  HPChanged: 'HPChanged',
  CriticalHit: 'CriticalHit',
  EffectivenessChanged: 'EffectivenessChanged',
  AbilityTriggered: 'AbilityTriggered',
  StatusApplied: 'StatusApplied',
  StatusPreventedMove: 'StatusPreventedMove',
  PokemonFainted: 'PokemonFainted',
  BattleConcluded: 'BattleConcluded',
  TurnEnded: 'TurnEnded',
  TurnRewound: 'TurnRewound'
});

export function createBattleEvent(type, payload = {}, turn = 1, stepIndex = 0) {
  return {
    type,
    ...payload,
    turn: Number(turn),
    stepIndex: Number(stepIndex)
  };
}
