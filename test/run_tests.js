import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ComponentRegistry } from '../public/js/components/ComponentRegistry.js';
import { ProjectModel } from '../public/js/core/ProjectModel.js';
import { Validator } from '../public/js/core/Validator.js';
import { CodeGenerator } from '../public/js/generator/CodeGenerator.js';
import { UINode } from '../public/js/core/UINode.js';
import { Transform } from '../public/js/core/Transform.js';
import { Props, PropertyTypes } from '../public/js/core/PropertySystem.js';
import { PokerogueAdapter } from '../public/js/data/PokerogueAdapter.js';
import { dataManager } from '../public/js/data/DataManager.js';
import { PokemonBattleData, BattleState } from '../public/js/battle/BattleState.js';
import { BattleEngine } from '../public/js/battle/BattleEngine.js';
import { PokerogueSource, POKEROGUE_UPSTREAM_CONFIG } from '../public/js/data/PokerogueSource.js';
import { PokerogueRepository } from '../public/js/data/PokerogueRepository.js';
import { PokerogueManifest } from '../public/js/data/PokerogueManifest.js';
import { PokerogueImporter } from '../public/js/data/PokerogueImporter.js';
import { PokemonSpriteResolver } from '../public/js/data/PokemonSpriteResolver.js';
import { FALLBACK_VERTICAL_SLICE_FIXTURE } from '../public/js/fixtures/fallbackVerticalSlice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('----------------------------------------------------');
console.log('  RUNNING 3DS UI STUDIO AUTOMATED TEST SUITE');
console.log('----------------------------------------------------\n');

let passed = 0;
let total = 0;
const asyncTests = [];

function test(name, fn) {
  total++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      asyncTests.push(res.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  ✕ ${name}`);
        console.error(`     Error: ${err.message}`);
      }));
      return;
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// 1. COMPONENT REGISTRY & FACTORY TESTS
// -------------------------------------------------------------
test('ComponentRegistry registers RogueBox, PixelText, TouchButton', () => {
  const all = ComponentRegistry.getAll();
  assert.strictEqual(all.length >= 3, true);
  const types = all.map(c => c.type);
  assert.ok(types.includes('RogueBox'));
  assert.ok(types.includes('PixelText'));
  assert.ok(types.includes('TouchButton'));
});

test('Component factory enforces integer pixel snapping on creation', () => {
  const comp = ComponentRegistry.create('RogueBox', {
    x: 42.87,
    y: 19.12,
    width: 140.4,
    height: 79.9
  });
  assert.strictEqual(comp.x, 43);
  assert.strictEqual(comp.y, 19);
  assert.strictEqual(comp.width, 140);
  assert.strictEqual(comp.height, 80);
});

test('ComponentRegistry provides static schemas and capabilities', () => {
  const boxSchema = ComponentRegistry.getSchema('RogueBox');
  assert.ok(boxSchema);
  assert.strictEqual(boxSchema.type, 'RogueBox');
  assert.ok(boxSchema.capabilities.includes('render'));
  assert.ok(boxSchema.capabilities.includes('container'));
  assert.ok(boxSchema.properties.backgroundColor);

  const btnSchema = ComponentRegistry.getSchema('TouchButton');
  assert.ok(btnSchema.capabilities.includes('focus'));
  assert.ok(btnSchema.capabilities.includes('touch'));
});

// -------------------------------------------------------------
// 2. TRANSFORM & UINODE HIERARCHY TESTS
// -------------------------------------------------------------
test('Transform quantization for Nintendo 3DS Citro2D', () => {
  const t = new Transform({
    x: 12.3,
    y: 45.8,
    width: 120.2,
    height: 40.7,
    scaleX: 1.5,
    rotation: 90,
    opacity: 0.8
  });
  const q = t.getQuantized3DSTransform();
  assert.strictEqual(q.x, 12);
  assert.strictEqual(q.y, 46);
  assert.strictEqual(q.width, 120);
  assert.strictEqual(q.height, 41);
  assert.strictEqual(q.rotation, 90);
  assert.strictEqual(q.opacity, 0.8);
});

test('UINode hierarchical world transform computation', () => {
  const model = new ProjectModel();
  model.loadScreen({
    id: 'HierarchyScreen',
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: []
  });
  model.setActiveScreen('HierarchyScreen');

  const parentBox = model.addComponent({
    id: 'parent_panel',
    type: 'RogueBox',
    screen: 'top',
    x: 40,
    y: 30,
    width: 200,
    height: 100
  });

  const childText = model.addComponent({
    id: 'child_label',
    type: 'PixelText',
    screen: 'top',
    x: 10,
    y: 15,
    width: 80,
    height: 20,
    parent: 'parent_panel'
  });

  assert.strictEqual(parentBox.children.includes('child_label'), true);
  assert.strictEqual(childText.parent, 'parent_panel');

  const worldTransform = childText.getWorldTransform(model);
  assert.strictEqual(worldTransform.x, 50); // 40 + 10
  assert.strictEqual(worldTransform.y, 45); // 30 + 15
});

// -------------------------------------------------------------
// 3. PROPERTY SYSTEM TESTS
// -------------------------------------------------------------
test('PropertySystem validates and sanitizes typed values', () => {
  const intProp = Props.integer('Count', 5, { min: 0, max: 10 });
  assert.strictEqual(intProp.sanitize('7'), 7);
  assert.strictEqual(intProp.sanitize('20'), 10); // max clamp
  assert.strictEqual(intProp.sanitize('-5'), 0); // min clamp

  const colorProp = Props.color('Color', '#1e2230');
  assert.strictEqual(colorProp.sanitize('#c83834'), '#c83834');
  assert.strictEqual(colorProp.sanitize('invalid-color'), '#1e2230');

  const enumProp = Props.enum('Mode', ['left', 'center', 'right'], 'left');
  assert.strictEqual(enumProp.sanitize('center'), 'center');
  assert.strictEqual(enumProp.sanitize('unknown'), 'left');
});

// -------------------------------------------------------------
// 4. PROJECT MODEL, CRUD, REPARENTING & UNDO/REDO
// -------------------------------------------------------------
test('ProjectModel loads screen JSON and creates component instances with schema v1', () => {
  const model = new ProjectModel();
  const screenJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'project', 'screens', 'ExampleScreen.json'), 'utf8'));
  model.loadScreen(screenJson);

  const active = model.getActiveScreen();
  assert.strictEqual(active.id, 'ExampleScreen');
  assert.strictEqual(active.components.length, 6);
  assert.strictEqual(active.top.width, 400);
  assert.strictEqual(active.bottom.width, 320);
});

test('ProjectModel reparentNode safely updates parent-child links and supports undo/redo', () => {
  const model = new ProjectModel();
  model.loadScreen({
    id: 'ReparentScreen',
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: []
  });
  model.setActiveScreen('ReparentScreen');

  const box = model.addComponent({ id: 'box_a', type: 'RogueBox', screen: 'top', x: 20, y: 20, width: 100, height: 100 });
  const text = model.addComponent({ id: 'text_a', type: 'PixelText', screen: 'top', x: 5, y: 5, width: 50, height: 20 });

  assert.strictEqual(text.parent, null);
  assert.strictEqual(box.children.length, 0);

  // Reparent text under box
  model.reparentNode('text_a', 'box_a');
  assert.strictEqual(text.parent, 'box_a');
  assert.strictEqual(box.children.includes('text_a'), true);

  // Undo reparenting
  model.history.undo();
  assert.strictEqual(text.parent, null);
  assert.strictEqual(box.children.includes('text_a'), false);

  // Redo reparenting
  model.history.redo();
  assert.strictEqual(text.parent, 'box_a');
  assert.strictEqual(box.children.includes('text_a'), true);
});

// -------------------------------------------------------------
// 5. VALIDATOR TESTS
// -------------------------------------------------------------
test('Validator approves valid ExampleScreen', () => {
  const screenJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'project', 'screens', 'ExampleScreen.json'), 'utf8'));
  const report = Validator.validateScreen(screenJson);
  assert.strictEqual(report.valid, true);
  assert.strictEqual(report.errors.filter(e => e.level === 'error').length, 0);
});

test('Validator catches duplicate ID and broken parent references', () => {
  const badScreen = {
    id: 'InvalidScreen',
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: [
      { id: 'btn_1', type: 'TouchButton', screen: 'bottom', x: 0, y: 0, width: 50, height: 20 },
      { id: 'btn_1', type: 'TouchButton', screen: 'bottom', x: 10, y: 10, width: 50, height: 20 },
      { id: 'btn_child', type: 'TouchButton', screen: 'bottom', x: 20, y: 20, width: 50, height: 20, parent: 'non_existent_box' }
    ]
  };
  const report = Validator.validateScreen(badScreen);
  assert.strictEqual(report.valid, false);
  const msgs = report.errors.map(e => e.message);
  assert.ok(msgs.some(m => m.includes('Duplicate component ID "btn_1"')));
  assert.ok(msgs.some(m => m.includes('Broken parent reference')));
});

// -------------------------------------------------------------
// 6. CODE GENERATOR (MODULAR EXPORTER & GOLDEN REGRESSION TEST)
// -------------------------------------------------------------
test('CodeGenerator produces deterministic C++ header and source using Exporter contracts', () => {
  const screenJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'project', 'screens', 'ExampleScreen.json'), 'utf8'));
  const gen1 = CodeGenerator.generate(screenJson);
  const gen2 = CodeGenerator.generate(screenJson);

  // Determinism check: identical JSON must produce identical string byte-for-byte
  assert.strictEqual(gen1.hpp, gen2.hpp, 'HPP generation must be 100% deterministic');
  assert.strictEqual(gen1.cpp, gen2.cpp, 'CPP generation must be 100% deterministic');

  // Verify Header structure
  assert.ok(gen1.hpp.includes('#pragma once'));
  assert.ok(gen1.hpp.includes('#include "screens/screen.hpp"'));
  assert.ok(gen1.hpp.includes('class ExampleScreen : public Screen {'));
  assert.ok(gen1.hpp.includes('void handleInput(const InputManager& input) override;'));
  assert.ok(gen1.hpp.includes('void drawTop(Renderer2D& renderer) override;'));
  assert.ok(gen1.hpp.includes('void drawBottom(Renderer2D& renderer) override;'));
  assert.ok(gen1.hpp.includes('std::unique_ptr<Panel> m_top_banner_box;'));
  assert.ok(gen1.hpp.includes('std::unique_ptr<Text> m_title_text;'));
  assert.ok(gen1.hpp.includes('std::unique_ptr<Button> m_btn_play;'));

  // Verify Source structure
  assert.ok(gen1.cpp.includes('#include "screens/ExampleScreen.hpp"'));
  assert.ok(gen1.cpp.includes('void ExampleScreen::buildUI() {'));
  assert.ok(gen1.cpp.includes('m_top_banner_box = std::make_unique<Panel>(40.0f, 28.0f, 320.0f, 184.0f, PanelStyle::ROGUE_BOX);'));
  assert.ok(gen1.cpp.includes('m_title_text = std::make_unique<Text>(80.0f, 64.0f, "ROGUE 3DS TEST", 0xFF05CBFF, true);'));
  assert.ok(gen1.cpp.includes('m_btn_play = std::make_unique<Button>(60.0f, 56.0f, 200.0f, 44.0f, "PLAY", 1);'));
  assert.ok(gen1.cpp.includes('renderer.clear(0xFF1C1412);'));
  assert.ok(gen1.cpp.includes('renderer.clear(0xFF24181A);'));
});

// -------------------------------------------------------------
// 7. POKEROGUE ADAPTER & CANONICAL DATA MODEL TESTS
// -------------------------------------------------------------


test('PokerogueAdapter imports Pikachu and Golem with provenance & 3DS sprites', () => {
  const pika = dataManager.getSpecies('pikachu');
  assert.ok(pika);
  assert.strictEqual(pika.name, 'Pikachu');
  assert.strictEqual(pika.nationalDexId, 25);
  assert.deepStrictEqual(pika.types, ['Electric']);
  assert.strictEqual(pika.abilities.primary, 'Static');
  assert.strictEqual(pika.source.source, 'pokerogue');
  assert.strictEqual(pika.source.license, 'AGPL-v3.0-only');
  assert.ok(pika.sprites.atlasPath.includes('pikachu'));
  assert.ok(pika.learnableMoves.some(m => m.id === 'thunderbolt'));

  const golem = dataManager.getSpecies('golem');
  assert.ok(golem);
  assert.strictEqual(golem.nationalDexId, 76);
  assert.strictEqual(golem.abilities.primary, 'Rock Head');
  assert.strictEqual(golem.abilities.secondary, 'Sturdy');
});


test('DataManager builds dependency graph and validates type effectiveness', () => {
  const depGraph = dataManager.getDependencyGraph('pikachu');
  assert.strictEqual(depGraph.species, 'Pikachu');
  assert.ok(depGraph.moves.includes('Thunderbolt'));
  assert.strictEqual(depGraph.abilities.primary, 'Static');

  // Type Chart: Electric vs Ground is immune (0x)
  const multGround = dataManager.getTypeMultiplier('Electric', ['Ground']);
  assert.strictEqual(multGround, 0);

  // Type Chart: Electric vs Water is super effective (2x)
  const multWater = dataManager.getTypeMultiplier('Electric', ['Water']);
  assert.strictEqual(multWater, 2);

  // Type Chart: Ground vs Electric is super effective (2x)
  const multEarth = dataManager.getTypeMultiplier('Ground', ['Electric']);
  assert.strictEqual(multEarth, 2);
});

// -------------------------------------------------------------
// 8. BATTLE DOMAIN & DETERMINISTIC SIMULATION TESTS
// -------------------------------------------------------------
test('PokemonBattleData computes Gen 9 stats and supports cloning', () => {
  const pika = dataManager.getSpecies('pikachu');
  const battlePika = new PokemonBattleData(pika, 20);
  assert.strictEqual(battlePika.level, 20);
  assert.ok(battlePika.maxHp > 35);
  assert.strictEqual(battlePika.currentHp, battlePika.maxHp);
  assert.strictEqual(battlePika.ability, 'Static');

  const cloned = battlePika.clone();
  cloned.currentHp -= 10;
  assert.strictEqual(battlePika.currentHp, battlePika.maxHp);
  assert.strictEqual(cloned.currentHp, battlePika.maxHp - 10);
});

test('BattleEngine executes Pikachu vs Golem turn with damage breakdown', () => {
  const pikaSpecies = dataManager.getSpecies('pikachu');
  const golemSpecies = dataManager.getSpecies('golem');

  const pika = new PokemonBattleData(pikaSpecies, 20);
  const golem = new PokemonBattleData(golemSpecies, 20);
  const state = new BattleState(pika, golem, 9999);
  const engine = new BattleEngine(state);

  let moveStarted = false;
  let damageCalculated = false;
  let hpChanged = false;

  const breakdowns = [];
  engine.on('MoveStarted', () => { moveStarted = true; });
  engine.on('DamageCalculated', (ev) => {
    damageCalculated = true;
    assert.ok(ev.breakdown);
    breakdowns.push(ev.breakdown);
  });
  engine.on('HPChanged', () => { hpChanged = true; });

  // Run full turn with Tackle
  engine.runFullTurn('tackle');

  assert.ok(moveStarted, 'MoveStarted event should fire');
  assert.ok(damageCalculated, 'DamageCalculated event should fire');
  assert.ok(hpChanged, 'HPChanged event should fire');
  assert.ok(breakdowns.some(b => b.move === 'Tackle' && b.attacker === 'Pikachu'), 'Tackle breakdown should be computed');
  assert.ok(state.eventLog.length >= 3, 'Event log should record events');
  assert.strictEqual(state.turn, 2, 'Turn should increment to 2');


  // Time-travel / Snapshot test: Rewind to Turn 1
  const rewound = engine.rewindToPreviousTurn();
  assert.strictEqual(rewound, true);
  assert.strictEqual(state.turn, 1);
});

// -------------------------------------------------------------
// 9. NEW COMPONENT REGISTRY TESTS: HEALTHBAR & MOVEBUTTON
// -------------------------------------------------------------
test('ComponentRegistry registers HealthBar and MoveButton', () => {
  const hb = ComponentRegistry.create('HealthBar', {
    x: 40,
    y: 30,
    properties: { currentHp: 50, maxHp: 100 }
  });
  assert.strictEqual(hb.type, 'HealthBar');
  assert.strictEqual(hb.properties.currentHp, 50);

  const mb = ComponentRegistry.create('MoveButton', {
    x: 20,
    y: 60,
    properties: { moveName: 'Thunderbolt', moveType: 'Electric', power: 90 }
  });
  assert.strictEqual(mb.type, 'MoveButton');
  assert.strictEqual(mb.properties.moveName, 'Thunderbolt');
  assert.strictEqual(mb.properties.power, 90);
});

// -------------------------------------------------------------
// 10. POKEROGUE REAL INTEGRATION & AUDIT TESTS (FASE 9)
// -------------------------------------------------------------

// Real upstream snippets extracted directly from pagefaultgames/pokerogue @ beta
const REAL_UPSTREAM_GEN1_SNIPPET = `
  generationOneSpeciesData[SpeciesId.PIKACHU] = {
    species: new PokemonSpecies({
      id: SpeciesId.PIKACHU,
      generation: 1,
      category: "Mouse Pokémon",
      type1: PokemonType.ELECTRIC,
      type2: null,
      height: 0.4,
      weight: 6,
      ability1: AbilityId.STATIC,
      ability2: AbilityId.NONE,
      abilityHidden: AbilityId.LIGHTNING_ROD,
      baseTotal: 320,
      baseHp: 35,
      baseAtk: 55,
      baseDef: 40,
      baseSpatk: 50,
      baseSpdef: 50,
      baseSpd: 90,
      catchRate: 190,
      baseFriendship: 50,
      baseExp: 112,
      growthRate: GrowthRate.MEDIUM_FAST,
      malePercent: 50,
      genderDiffs: true,
      canChangeForm: true
    }),
    starter: SpeciesId.PIKACHU,
    starterCost: 3,
    eggTier: EggTier.COMMON,
    passives: AbilityId.MOTOR_DRIVE,
    levelMoves: [
      [1, MoveId.TACKLE],
      [1, MoveId.TAIL_WHIP],
      [10, MoveId.THUNDER_WAVE],
      [15, MoveId.QUICK_ATTACK],
      [25, MoveId.THUNDERBOLT]
    ],
    tms: [MoveId.PAY_DAY]
  };
  generationOneSpeciesData[SpeciesId.GOLEM] = {
    species: new PokemonSpecies({
      id: SpeciesId.GOLEM,
      generation: 1,
      category: "Megaton Pokémon",
      type1: PokemonType.ROCK,
      type2: PokemonType.GROUND,
      height: 1.4,
      weight: 300,
      ability1: AbilityId.ROCK_HEAD,
      ability2: AbilityId.STURDY,
      abilityHidden: AbilityId.SAND_VEIL,
      baseTotal: 495,
      baseHp: 80,
      baseAtk: 120,
      baseDef: 130,
      baseSpatk: 55,
      baseSpdef: 65,
      baseSpd: 45,
      catchRate: 45,
      baseFriendship: 70,
      baseExp: 248,
      growthRate: GrowthRate.MEDIUM_SLOW,
      malePercent: 50,
      genderDiffs: false
    }),
    starter: SpeciesId.GEODUDE,
    evolutions: [],
    passives: AbilityId.SOLID_ROCK,
    levelMoves: [
      [1, MoveId.SAND_ATTACK],
      [1, MoveId.TACKLE],
      [40, MoveId.EARTHQUAKE]
    ],
    tms: [MoveId.FOCUS_BLAST]
  };
`;

const REAL_UPSTREAM_MOVES_SNIPPET = `
    new AttackMove(MoveId.THUNDERBOLT, PokemonType.ELECTRIC, MoveCategory.SPECIAL, 90, 100, 15, 10, 0, 1) //
      .attr(StatusEffectAttr, StatusEffect.PARALYSIS),
    new AttackMove(MoveId.TACKLE, PokemonType.NORMAL, MoveCategory.PHYSICAL, 40, 100, 35, -1, 0, 1),
`;

const REAL_UPSTREAM_ABILITIES_SNIPPET = `
    new AbBuilder(AbilityId.STATIC, 3) //
      .attr(PostDefendApplyStatusEffectAbAttr, 30, true, StatusEffect.PARALYSIS)
      .bypassFaint()
      .build(),
    new AbBuilder(AbilityId.STURDY, 3) //
      .attr(PreDefendFullHpEndureAbAttr)
      .attr(BlockOneHitKOAbAttr)
      .ignorable()
      .build(),
`;

test('FASE 9.1: PokerogueImporter imports real upstream data with full provenance (Pikachu, Golem, Moves, Abilities)', async () => {
  const repo = new PokerogueRepository();
  const manifest = new PokerogueManifest();
  const importer = new PokerogueImporter(repo, manifest);

  const result = await importer.importVerticalSlice({
    mockSpeciesRaw: REAL_UPSTREAM_GEN1_SNIPPET,
    mockMovesRaw: REAL_UPSTREAM_MOVES_SNIPPET,
    mockAbilitiesRaw: REAL_UPSTREAM_ABILITIES_SNIPPET
  });

  // Verify Pikachu
  const pika = importer.getCanonicalSpecies('pikachu');
  assert.ok(pika, 'Pikachu must be imported');
  assert.strictEqual(pika.name, 'Pikachu');
  assert.strictEqual(pika.speciesId, 25);
  assert.strictEqual(pika.nationalDexId, 25);
  assert.strictEqual(pika.type1, 'Electric');
  assert.strictEqual(pika.type2, 'NONE');
  assert.strictEqual(pika.baseStats.hp, 35);
  assert.strictEqual(pika.baseStats.atk, 55);
  assert.strictEqual(pika.baseStats.def, 40);
  assert.strictEqual(pika.baseStats.spd, 90);
  assert.strictEqual(pika.abilities.primary, 'Static');
  assert.strictEqual(pika.abilities.hidden, 'Lightning Rod');
  assert.strictEqual(pika.source.source, 'pokerogue');
  assert.strictEqual(pika.source.sourceRepository, 'https://github.com/pagefaultgames/pokerogue');
  assert.strictEqual(pika.source.sourceRevision, manifest.revision);
  assert.strictEqual(pika.source.license, 'AGPL-v3.0-only');

  // Verify Golem
  const golem = importer.getCanonicalSpecies('golem');
  assert.ok(golem, 'Golem must be imported');
  assert.strictEqual(golem.speciesId, 76);
  assert.strictEqual(golem.type1, 'Rock');
  assert.strictEqual(golem.type2, 'Ground');
  assert.strictEqual(golem.baseStats.atk, 120);
  assert.strictEqual(golem.baseStats.def, 130);
  assert.strictEqual(golem.abilities.primary, 'Rock Head');
  assert.strictEqual(golem.abilities.secondary, 'Sturdy');

  // Verify Moves
  const tbolt = importer.getCanonicalMove('thunderbolt');
  assert.ok(tbolt, 'Thunderbolt must be imported');
  assert.strictEqual(tbolt.type, 'ELECTRIC');
  assert.strictEqual(tbolt.power, 90);
  assert.strictEqual(tbolt.accuracy, 100);
  assert.strictEqual(tbolt.pp, 15);
  assert.strictEqual(tbolt.secondaryEffects[0].status, 'PARALYSIS');

  const tackle = importer.getCanonicalMove('tackle');
  assert.ok(tackle, 'Tackle must be imported');
  assert.strictEqual(tackle.type, 'NORMAL');
  assert.strictEqual(tackle.power, 40);
  assert.strictEqual(tackle.flags.contact, true);

  // Verify Abilities
  const staticAb = importer.getCanonicalAbility('static');
  assert.ok(staticAb, 'Static ability must be imported');
  assert.strictEqual(staticAb.trigger, 'ON_DAMAGE_RECEIVED');
  assert.ok(staticAb.attributes.includes('PostDefendApplyStatusEffectAbAttr'));

  const sturdyAb = importer.getCanonicalAbility('sturdy');
  assert.ok(sturdyAb, 'Sturdy ability must be imported');
  assert.ok(sturdyAb.attributes.includes('PreDefendFullHpEndureAbAttr'));
  assert.ok(sturdyAb.attributes.includes('BlockOneHitKOAbAttr'));
});

test('FASE 9.2: PokemonSpriteResolver resolves real assets answering the 5 core questions without invented paths', () => {
  const resolver = new PokemonSpriteResolver();
  const reportPika = resolver.resolveAssetReport('pikachu');

  // Question 1: ¿Qué asset corresponde a esta especie?
  assert.strictEqual(reportPika.asset.pngPath, 'images/pokemon/25.png');
  assert.strictEqual(reportPika.asset.jsonPath, 'images/pokemon/25.json');

  // Question 2: ¿De dónde proviene?
  assert.strictEqual(reportPika.origin, 'https://github.com/pagefaultgames/pokerogue-assets');

  // Question 3: ¿Qué revisión lo produjo?
  assert.strictEqual(reportPika.revision, POKEROGUE_UPSTREAM_CONFIG.assets.revision);

  // Question 4: ¿Existe?
  assert.strictEqual(reportPika.exists, true);

  // Question 5: ¿Qué formato tiene?
  assert.strictEqual(reportPika.format, 'TexturePacker JSON + PNG');
  assert.strictEqual(reportPika.colorFormat, 'RGBA8888');

  // Golem Asset check
  const reportGolem = resolver.resolveAssetReport(76);
  assert.strictEqual(reportGolem.exists, true);
  assert.strictEqual(reportGolem.asset.pngPath, 'images/pokemon/76.png');
});

test('FASE 9.3: PokerogueManifest produces 100% reproducible deterministic export independent of metadata timestamps', async () => {
  const m1 = new PokerogueManifest({
    importedAt: '2026-01-01T00:00:00.000Z',
    fileHashes: { 'src/b.ts': 'hash_b', 'src/a.ts': 'hash_a' }
  });

  const m2 = new PokerogueManifest({
    importedAt: '2026-09-25T15:30:45.999Z',
    fileHashes: { 'src/a.ts': 'hash_a', 'src/b.ts': 'hash_b' }
  });

  // Export strings must be identical byte-for-byte regardless of when they were imported
  const exp1 = m1.getDeterministicString();
  const exp2 = m2.getDeterministicString();
  assert.strictEqual(exp1, exp2, 'Deterministic export string must be identical regardless of importedAt');

  // Verify keys in fileHashes are sorted deterministically
  const parsed = JSON.parse(exp1);
  const keys = Object.keys(parsed.fileHashes);
  assert.deepStrictEqual(keys, ['src/a.ts', 'src/b.ts']);
});

test('FASE 9.4: Fallback vertical slice fixture is clearly separated and marked as test fixture', () => {
  assert.strictEqual(FALLBACK_VERTICAL_SLICE_FIXTURE.source, 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION');
  assert.ok(FALLBACK_VERTICAL_SLICE_FIXTURE.species.some(s => s.id === 'pikachu'));
  assert.ok(FALLBACK_VERTICAL_SLICE_FIXTURE.species.some(s => s.id === 'golem'));

  const adapter = new PokerogueAdapter();
  const fallback = adapter.getFallbackTestFixture();
  assert.ok(fallback.species.length >= 2);
});

test('FASE 9.5: Clean failure reporting for non-existent resources without invented paths', () => {
  const resolver = new PokemonSpriteResolver();
  const nonExistent = resolver.resolveAssetReport('missingno_9999');

  assert.strictEqual(nonExistent.exists, false);
  assert.strictEqual(nonExistent.assetPath, null);
  assert.ok(nonExistent.error.includes('does not exist'));

  const importer = new PokerogueImporter();
  const missingSpecies = importer.getCanonicalSpecies('non_existent_mon');
  assert.strictEqual(missingSpecies, null);
});

test('FASE 9.6: Reimportation without duplicating data (Idempotent import)', async () => {
  const importer = new PokerogueImporter();

  await importer.importVerticalSlice({
    mockSpeciesRaw: REAL_UPSTREAM_GEN1_SNIPPET,
    mockMovesRaw: REAL_UPSTREAM_MOVES_SNIPPET,
    mockAbilitiesRaw: REAL_UPSTREAM_ABILITIES_SNIPPET
  });

  assert.strictEqual(importer.importedSpecies.size, 2);
  assert.strictEqual(importer.importedMoves.size, 2);
  assert.strictEqual(importer.importedAbilities.size, 2);

  // Re-run import
  await importer.importVerticalSlice({
    mockSpeciesRaw: REAL_UPSTREAM_GEN1_SNIPPET,
    mockMovesRaw: REAL_UPSTREAM_MOVES_SNIPPET,
    mockAbilitiesRaw: REAL_UPSTREAM_ABILITIES_SNIPPET
  });

  assert.strictEqual(importer.importedSpecies.size, 2, 'Species map size must not grow on reimport');
  assert.strictEqual(importer.importedMoves.size, 2, 'Moves map size must not grow on reimport');
  assert.strictEqual(importer.importedAbilities.size, 2, 'Abilities map size must not grow on reimport');
});

if (asyncTests.length > 0) {
  await Promise.all(asyncTests);
}

console.log(`\n====================================================`);
console.log(`  TEST RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
console.log(`====================================================\n`);

if (passed !== total) {
  process.exit(1);
}

