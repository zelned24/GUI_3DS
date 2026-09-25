/**
 * test/fixtures/fallbackVerticalSlice.js
 * 
 * STRICTLY TEST FIXTURE / OFFLINE FALLBACK BASELINE
 * --------------------------------------------------
 * WARNING: This dataset is NOT a production data source.
 * It is solely retained for unit test regression fixtures, offline development,
 * and zero-network CI test harnesses.
 * Production data MUST be ingested via PokerogueImporter directly from upstream.
 */

export const FALLBACK_VERTICAL_SLICE_FIXTURE = {
  description: 'Offline Test Fixture for Unit Tests only',
  source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
  species: [
    {
      speciesId: 25,
      id: 'pikachu',
      name: 'Pikachu',
      generation: 1,
      type1: 'Electric',
      type2: 'NONE',
      baseHp: 35,
      baseAtk: 55,
      baseDef: 40,
      baseSpatk: 50,
      baseSpdef: 50,
      baseSpd: 90,
      ability1: 'Static',
      ability2: 'NONE',
      abilityHidden: 'Lightning Rod',
      passive: 'Motor Drive',
      starterCost: 3,
      eggTier: 'COMMON',
      levelMoves: [
        { level: 1, move: 'tackle' },
        { level: 5, move: 'tail_whip' },
        { level: 10, move: 'thunder_wave' },
        { level: 15, move: 'quick_attack' },
        { level: 25, move: 'thunderbolt' }
      ],
      eggMoves: ['volt_tackle', 'fake_out', 'extreme_speed', 'zing_zap']
    },
    {
      speciesId: 76,
      id: 'golem',
      name: 'Golem',
      generation: 1,
      type1: 'Rock',
      type2: 'Ground',
      baseHp: 80,
      baseAtk: 120,
      baseDef: 130,
      baseSpatk: 55,
      baseSpdef: 65,
      baseSpd: 45,
      ability1: 'Rock Head',
      ability2: 'Sturdy',
      abilityHidden: 'Sand Veil',
      passive: 'Solid Rock',
      starterCost: 3,
      eggTier: 'COMMON',
      levelMoves: [
        { level: 1, move: 'tackle' },
        { level: 11, move: 'rock_throw' },
        { level: 22, move: 'rock_slide' },
        { level: 32, move: 'earthquake' }
      ],
      eggMoves: ['curse', 'counter', 'wide_guard']
    }
  ],
  moves: [
    {
      id: 'thunderbolt',
      name: 'Thunderbolt',
      type: 'Electric',
      category: 'Special',
      power: 90,
      accuracy: 100,
      pp: 15,
      priority: 0,
      target: 'Selected',
      flags: { contact: false, protectable: true },
      secondaryEffects: [{ chance: 10, status: 'PARALYSIS' }]
    },
    {
      id: 'tackle',
      name: 'Tackle',
      type: 'Normal',
      category: 'Physical',
      power: 40,
      accuracy: 100,
      pp: 35,
      priority: 0,
      target: 'Selected',
      flags: { contact: true, protectable: true },
      secondaryEffects: []
    },
    {
      id: 'quick_attack',
      name: 'Quick Attack',
      type: 'Normal',
      category: 'Physical',
      power: 40,
      accuracy: 100,
      pp: 30,
      priority: 1,
      target: 'Selected',
      flags: { contact: true, protectable: true },
      secondaryEffects: []
    },
    {
      id: 'earthquake',
      name: 'Earthquake',
      type: 'Ground',
      category: 'Physical',
      power: 100,
      accuracy: 100,
      pp: 10,
      priority: 0,
      target: 'ALL_NEAR_ENEMIES',
      flags: { contact: false, protectable: true },
      secondaryEffects: []
    },
    {
      id: 'rock_slide',
      name: 'Rock Slide',
      type: 'Rock',
      category: 'Physical',
      power: 75,
      accuracy: 90,
      pp: 10,
      priority: 0,
      target: 'ALL_NEAR_ENEMIES',
      flags: { contact: false, protectable: true },
      secondaryEffects: [{ chance: 30, effect: 'FLINCH' }]
    }
  ],
  abilities: [
    {
      id: 'static',
      name: 'Static',
      trigger: 'ON_CONTACT_RECEIVED',
      effect: 'APPLY_PARALYSIS',
      chance: 30,
      description: 'Contact with the Pokémon may cause paralysis.'
    },
    {
      id: 'sturdy',
      name: 'Sturdy',
      trigger: 'ON_LETHAL_HIT',
      effect: 'ENDURE_LETHAL_AT_FULL_HP',
      chance: 100,
      description: 'It cannot be knocked out with one hit. One-hit KO moves cannot knock it out, either.'
    }
  ]
};
