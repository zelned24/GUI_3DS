/**
 * Fallback Vertical Slice - Isolated Test Fixture.
 * CRITICAL: This is strictly a test fixture for unit tests and offline fallback.
 * IT MUST NEVER BE TREATED AS PRODUCTION DATA.
 * 
 * Source tag: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION'
 */

export function getFallbackTestFixture() {
  return {
    source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
    isFixture: true,
    species: [
      {
        id: 'pikachu',
        speciesId: 25,
        name: 'Pikachu',
        generation: 1,
        type1: 'Electric',
        type2: 'NONE',
        baseStats: { hp: 35, atk: 55, def: 40, spatk: 50, spdef: 50, spd: 90 },
        ability1: 'Static',
        ability2: null,
        abilityHidden: 'Lightning Rod',
        passive: 'Motor Drive',
        height: 0.4,
        weight: 6.0,
        levelMoves: [
          { level: 1, move: 'tackle', id: 'tackle' },
          { level: 5, move: 'quick_attack', id: 'quick_attack' },
          { level: 9, move: 'thunderbolt', id: 'thunderbolt' }
        ],
        learnableMoves: [
          { level: 1, move: 'tackle', id: 'tackle' },
          { level: 5, move: 'quick_attack', id: 'quick_attack' },
          { level: 9, move: 'thunderbolt', id: 'thunderbolt' }
        ],
        eggMoves: ['volt_tackle', 'fake_out', 'extreme_speed', 'wish'],
        sprites: {
          atlasPath: 'romfs/sprites/pokemon/25.t3x',
          icon: 'images/pokemon/25.png'
        },
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      },
      {
        id: 'golem',
        speciesId: 76,
        name: 'Golem',
        generation: 1,
        type1: 'Rock',
        type2: 'Ground',
        baseStats: { hp: 80, atk: 120, def: 130, spatk: 55, spdef: 65, spd: 45 },
        ability1: 'Rock Head',
        ability2: 'Sturdy',
        abilityHidden: 'Sand Veil',
        passive: 'Solid Rock',
        height: 1.4,
        weight: 300.0,
        levelMoves: [
          { level: 1, move: 'tackle', id: 'tackle' },
          { level: 16, move: 'rock_slide', id: 'rock_slide' },
          { level: 32, move: 'earthquake', id: 'earthquake' }
        ],
        learnableMoves: [
          { level: 1, move: 'tackle', id: 'tackle' },
          { level: 16, move: 'rock_slide', id: 'rock_slide' },
          { level: 32, move: 'earthquake', id: 'earthquake' }
        ],
        eggMoves: ['accelerock', 'head_smash', 'shore_up', 'diamond_storm'],
        sprites: {
          atlasPath: 'romfs/sprites/pokemon/76.t3x',
          icon: 'images/pokemon/76.png'
        },
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      }
    ],
    moves: [
      {
        moveId: 85,
        id: 'thunderbolt',
        name: 'Thunderbolt',
        type: 'Electric',
        category: 'Special',
        power: 90,
        accuracy: 100,
        pp: 15,
        priority: 0,
        flags: { contact: false, protectable: true },
        secondaryEffects: [{ chance: 10, status: 'PARALYSIS' }],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      },
      {
        moveId: 33,
        id: 'tackle',
        name: 'Tackle',
        type: 'Normal',
        category: 'Physical',
        power: 40,
        accuracy: 100,
        pp: 35,
        priority: 0,
        flags: { contact: true, protectable: true },
        secondaryEffects: [],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      },
      {
        moveId: 98,
        id: 'quick_attack',
        name: 'Quick Attack',
        type: 'Normal',
        category: 'Physical',
        power: 40,
        accuracy: 100,
        pp: 30,
        priority: 1,
        flags: { contact: true, protectable: true },
        secondaryEffects: [],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      },
      {
        moveId: 89,
        id: 'earthquake',
        name: 'Earthquake',
        type: 'Ground',
        category: 'Physical',
        power: 100,
        accuracy: 100,
        pp: 10,
        priority: 0,
        flags: { contact: false, protectable: true },
        secondaryEffects: [],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      },
      {
        moveId: 157,
        id: 'rock_slide',
        name: 'Rock Slide',
        type: 'Rock',
        category: 'Physical',
        power: 75,
        accuracy: 90,
        pp: 10,
        priority: 0,
        flags: { contact: false, protectable: true },
        secondaryEffects: [],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      }
    ],
    abilities: [
      {
        id: 'static',
        name: 'Static',
        description: 'The Pokémon is charged with static electricity, so contact with it may cause paralysis.',
        trigger: 'ON_DAMAGE_RECEIVED',
        conditions: [{ key: 'contact', value: true }],
        effects: [{ action: 'APPLY_STATUS', status: 'PARALYSIS', chance: 30 }],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      },
      {
        id: 'sturdy',
        name: 'Sturdy',
        description: 'It cannot be knocked out with one hit if at full HP.',
        trigger: 'ON_DAMAGE_PREVENTION',
        conditions: [{ key: 'hpRatio', value: 1.0 }],
        effects: [{ action: 'SURVIVE_LETHAL_HIT', minHP: 1 }],
        sourceMetadata: {
          source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
          sourcePath: 'test/fixtures/fallbackVerticalSlice.js',
          sourceRevision: 'test-fixture-v1',
          importedAt: 'CANONICAL_TEST_FIXTURE',
          license: 'AGPL-v3.0-only'
        }
      }
    ]
  };
}
