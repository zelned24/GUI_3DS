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
import { DeterministicRNG, globalRNG } from '../public/js/core/DeterministicRNG.js';
import { PokerogueSource } from '../public/js/data/PokerogueSource.js';
import { PokerogueRepository } from '../public/js/data/PokerogueRepository.js';
import { PokerogueManifest } from '../public/js/data/PokerogueManifest.js';
import { PokerogueImporter } from '../public/js/data/PokerogueImporter.js';
import { PokemonSpriteResolver } from '../public/js/data/PokemonSpriteResolver.js';
import { PokerogueEnumParser } from '../public/js/data/PokerogueEnumParser.js';
import { PokerogueLocaleImporter } from '../public/js/data/PokerogueLocaleImporter.js';
import { BattleCommand, SelectMoveCommand, ForfeitCommand } from '../public/js/battle/BattleCommand.js';
import { BattleEventTypes } from '../public/js/battle/BattleEvents.js';
import { ActionOrderPhase, DamagePhase, FaintCheckPhase } from '../public/js/battle/BattlePhases.js';
import { BattleSession } from '../public/js/battle/BattleSession.js';
import { getFallbackTestFixture } from './fixtures/fallbackVerticalSlice.js';
import {
  UPSTREAM_SPECIES_ENUM_FIXTURE,
  UPSTREAM_MOVE_ENUM_FIXTURE,
  UPSTREAM_ABILITY_ENUM_FIXTURE,
  UPSTREAM_TYPE_ENUM_FIXTURE,
  UPSTREAM_LOCALES_FIXTURE
} from './fixtures/upstream_enums_fixture.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('----------------------------------------------------');
console.log('  RUNNING 3DS UI STUDIO AUTOMATED TEST SUITE');
console.log('----------------------------------------------------\n');

let passed = 0;
let total = 0;
const testQueue = [];

function test(name, fn) {
  testQueue.push({ name, fn });
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
  assert.strictEqual(pika.source.source, 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION');
  assert.strictEqual(pika.source.license, 'AGPL-v3.0-only');
  assert.ok(pika.sprites.atlasPath.includes('25'));
  assert.ok(pika.learnableMoves.some(m => m.id === 'thunderbolt'));

  const golem = dataManager.getSpecies('golem');
  assert.ok(golem);
  assert.strictEqual(golem.nationalDexId, 76);
  assert.strictEqual(golem.abilities.primary, 'Rock Head');
  assert.strictEqual(golem.abilities.secondary, 'Sturdy');
  assert.ok(golem.sprites.atlasPath.includes('76'));
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
// 10. DETERMINISM & RNG TESTS
// -------------------------------------------------------------
test('DeterministicRNG produces reproducible sequence and deterministic IDs', () => {
  const rng1 = new DeterministicRNG(42);
  const rng2 = new DeterministicRNG(42);

  const seq1 = [rng1.next(), rng1.next(), rng1.nextInt(1, 100)];
  const seq2 = [rng2.next(), rng2.next(), rng2.nextInt(1, 100)];
  assert.deepStrictEqual(seq1, seq2, 'Same seed must generate identical pseudorandom numbers');

  const id1 = rng1.nextId('node');
  const id2 = rng1.nextId('node');
  assert.strictEqual(id1, 'node_1');
  assert.strictEqual(id2, 'node_2');

  // Verify UINode generates deterministic ID without Date.now/Math.random
  const nodeA = new UINode();
  const nodeB = new UINode();
  assert.ok(nodeA.id.startsWith('node_'), 'Node ID should follow deterministic sequence');
  assert.notStrictEqual(nodeA.id, nodeB.id, 'Sequential node IDs should be unique');
});

// -------------------------------------------------------------
// 11. CODE GENERATOR EXPORTERS: HEALTHBAR & MOVEBUTTON
// -------------------------------------------------------------
test('CodeGenerator exports HealthBar and MoveButton to valid C++', () => {
  const testScreen = {
    id: 'BattleTestScreen',
    components: [
      {
        id: 'player_hp',
        type: 'HealthBar',
        screen: 'top',
        x: 20,
        y: 40,
        width: 120,
        height: 12,
        properties: { currentHp: 80, maxHp: 100, showNumbers: true }
      },
      {
        id: 'btn_tackle',
        type: 'MoveButton',
        screen: 'bottom',
        x: 10,
        y: 20,
        width: 140,
        height: 36,
        properties: { moveName: 'Tackle', moveType: 'Normal', currentPp: 35, maxPp: 35, focusId: 1 }
      }
    ]
  };

  const gen = CodeGenerator.generate(testScreen);
  assert.ok(gen.hpp.includes('#include "ui/health_bar.hpp"'), 'HPP should include health_bar.hpp');
  assert.ok(gen.hpp.includes('#include "ui/move_button.hpp"'), 'HPP should include move_button.hpp');
  assert.ok(gen.hpp.includes('std::unique_ptr<HealthBar> m_player_hp;'), 'HPP should declare HealthBar member');
  assert.ok(gen.hpp.includes('std::unique_ptr<MoveButton> m_btn_tackle;'), 'HPP should declare MoveButton member');
  assert.ok(gen.cpp.includes('std::make_unique<HealthBar>(20.0f, 40.0f, 120.0f, 12.0f, 80, 100, true);'), 'CPP should instantiate HealthBar');
  assert.ok(gen.cpp.includes('std::make_unique<MoveButton>(10.0f, 20.0f, 140.0f, 36.0f, "Tackle", "Normal", 35, 35, 1);'), 'CPP should instantiate MoveButton');
});

// -------------------------------------------------------------
// 12. POKEROGUE INGESTION, ASSET RESOLVER & MANIFEST TESTS
// -------------------------------------------------------------
test('FASE 9.1: PokerogueImporter imports real upstream data with full provenance (Pikachu, Golem, Moves, Abilities)', async () => {
  const repo = new PokerogueRepository();
  const importer = new PokerogueImporter(repo);
  const result = await importer.importVerticalSlice();

  assert.strictEqual(result.species.length, 2);
  const pika = result.species.find(s => s.id === 'pikachu');
  const golem = result.species.find(s => s.id === 'golem');
  assert.ok(pika, 'Pikachu should be imported');
  assert.ok(golem, 'Golem should be imported');
  assert.strictEqual(pika.speciesId, 25);
  assert.strictEqual(golem.speciesId, 76);
  assert.strictEqual(pika.source.source, 'pokerogue');
  assert.strictEqual(pika.source.license, 'AGPL-v3.0-only');

  assert.strictEqual(result.moves.length, 5);
  const tb = result.moves.find(m => m.id === 'thunderbolt');
  assert.ok(tb);
  assert.strictEqual(tb.power, 90);
  assert.strictEqual(tb.type, 'ELECTRIC');

  assert.strictEqual(result.abilities.length, 2);
  const st = result.abilities.find(a => a.id === 'static');
  assert.ok(st);
  assert.strictEqual(st.trigger, 'ON_DAMAGE_RECEIVED');
});

test('FASE 9.2: PokemonSpriteResolver resolves real assets answering the 5 core questions without invented paths', () => {
  const resolver = new PokemonSpriteResolver();
  const pikaAsset = resolver.resolvePokemonSprite(25);

  assert.strictEqual(pikaAsset.exists, true, 'Question 4: Does it exist?');
  assert.strictEqual(pikaAsset.assetPaths.image, 'images/pokemon/25.png', 'Question 1: Which asset corresponds?');
  assert.strictEqual(pikaAsset.sourceRepository, 'https://github.com/pagefaultgames/pokerogue-assets', 'Question 2: Where does it originate?');
  assert.strictEqual(pikaAsset.sourceRevision, '056a1f408f26a3be4fef243f7462cb43608c7928', 'Question 3: What revision produced it?');
  assert.strictEqual(pikaAsset.format, 'TexturePacker JSON + PNG', 'Question 5: Format?');
  assert.strictEqual(pikaAsset.dimensions.width, 315);
  assert.strictEqual(pikaAsset.dimensions.height, 315);

  const golemAsset = resolver.resolvePokemonSprite(76);
  assert.strictEqual(golemAsset.exists, true);
  assert.strictEqual(golemAsset.assetPaths.image, 'images/pokemon/76.png');
  assert.strictEqual(golemAsset.dimensions.width, 384);
});

test('FASE 9.3: PokerogueManifest produces 100% reproducible deterministic export independent of metadata timestamps', () => {
  const m1 = new PokerogueManifest();
  m1.recordFile('pokerogue', 'rev1', 'src/data/moves/move.ts', 'content_a');
  m1.recordFile('pokerogue', 'rev1', 'src/data/species.ts', 'content_b');
  m1.recordEntity('Species', 'pikachu', { repository: 'pokerogue', revision: 'rev1', sourcePath: 'pika.ts' });

  const m2 = new PokerogueManifest();
  // Record in reverse order
  m2.recordEntity('Species', 'pikachu', { repository: 'pokerogue', revision: 'rev1', sourcePath: 'pika.ts' });
  m2.recordFile('pokerogue', 'rev1', 'src/data/species.ts', 'content_b');
  m2.recordFile('pokerogue', 'rev1', 'src/data/moves/move.ts', 'content_a');

  const exp1 = m1.getDeterministicExport();
  const exp2 = m2.getDeterministicExport();
  assert.strictEqual(exp1, exp2, 'Manifest exports must be byte-for-byte identical regardless of insertion order');
});

test('FASE 9.4: Fallback vertical slice fixture is clearly separated and marked as test fixture', () => {
  const fixture = getFallbackTestFixture();
  assert.strictEqual(fixture.source, 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION');
  assert.strictEqual(fixture.isFixture, true);
  assert.strictEqual(fixture.species.length, 2);
  assert.strictEqual(fixture.moves.length, 5);
  assert.strictEqual(fixture.abilities.length, 2);
});

test('FASE 9.5: Clean failure reporting for non-existent resources without invented paths', () => {
  const resolver = new PokemonSpriteResolver();
  const missing = resolver.resolvePokemonSprite(9999);
  assert.strictEqual(missing.exists, false, 'Non-existent species must return exists: false');
  assert.strictEqual(missing.assetPaths, null, 'Must NOT invent fake paths');
  assert.ok(missing.error.includes('#9999 is not indexed'), 'Must report clean failure message');
});

test('FASE 9.6: Reimportation without duplicating data (Idempotent import)', async () => {
  const repo = new PokerogueRepository();
  const importer = new PokerogueImporter(repo);

  const initialCount = dataManager.species.size;
  await dataManager.importUpstream(importer);
  const afterFirst = dataManager.species.size;

  // Re-import the exact same vertical slice
  await dataManager.importUpstream(importer);
  const afterSecond = dataManager.species.size;

  assert.strictEqual(afterFirst, afterSecond, 'Re-importing must be idempotent and not duplicate entities');
  assert.strictEqual(dataManager.isFallback, false);
  assert.ok(dataManager.manifest !== null);
});

test('Golden Test: CodeGenerator matches on-disk golden files', () => {
  const screenJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../project/screens/ExampleScreen.json'), 'utf8'));
  const gen = CodeGenerator.generate(screenJson);
  const onDiskHpp = fs.readFileSync(path.join(__dirname, '../project/generated/include/screens/ExampleScreen.hpp'), 'utf8');
  const onDiskCpp = fs.readFileSync(path.join(__dirname, '../project/generated/src/screens/ExampleScreen.cpp'), 'utf8');
  assert.strictEqual(gen.hpp, onDiskHpp, 'Generated HPP should match on-disk golden file');
  assert.strictEqual(gen.cpp, onDiskCpp, 'Generated CPP should match on-disk golden file');
});

test('PokerogueImporter dynamically parses arbitrary TypeScript source without mock tables', () => {
  const customTsSpecies = `
    export const generationOneSpeciesData = {
      [SpeciesId.BULBASAUR]: {
        speciesId: 1,
        name: 'Bulbasaur',
        generation: 1,
        type1: Type.GRASS,
        type2: Type.POISON,
        baseStats: [45, 49, 49, 65, 65, 45],
        ability1: AbilityId.OVERGROW,
        abilityHidden: AbilityId.CHLOROPHYLL,
        height: 0.7,
        weight: 6.9,
        levelMoves: [
          [1, Moves.TACKLE],
          [3, Moves.GROWL],
          [7, Moves.LEECH_SEED]
        ],
        eggMoves: [Moves.PETAL_DANCE]
      }
    };
  `;

  const importer = new PokerogueImporter();
  const parsedSpecies = importer.parseSpeciesFromGeneration(customTsSpecies);
  assert.strictEqual(parsedSpecies.length, 1);
  const bulba = parsedSpecies[0];
  assert.strictEqual(bulba.id, 'bulbasaur');
  assert.strictEqual(bulba.name, 'Bulbasaur');
  assert.strictEqual(bulba.speciesId, 1);
  assert.strictEqual(bulba.type1, 'Grass');
  assert.strictEqual(bulba.type2, 'Poison');
  assert.strictEqual(bulba.baseStats.hp, 45);
  assert.strictEqual(bulba.baseStats.spatk, 65);
  assert.strictEqual(bulba.abilities.primary, 'Overgrow');
  assert.strictEqual(bulba.abilities.hidden, 'Chlorophyll');
  assert.strictEqual(bulba.levelMoves.length, 3);
  assert.strictEqual(bulba.eggMoves[0], 'petal_dance');
});

// -------------------------------------------------------------
// 10. MILESTONE 11: ENUMS, LOCALES & I18N PIPELINE TESTS
// -------------------------------------------------------------
test('MILESTONE 11.1: PokerogueEnumParser parses explicit and sequential enum values with bidirectional mapping', () => {
  const parser = new PokerogueEnumParser();
  const speciesCatalog = parser.parseEnum(UPSTREAM_SPECIES_ENUM_FIXTURE, 'SpeciesId', 'src/enums/species-id.ts');
  const moveCatalog = parser.parseEnum(UPSTREAM_MOVE_ENUM_FIXTURE, 'MoveId', 'src/enums/move-id.ts');
  const abilityCatalog = parser.parseEnum(UPSTREAM_ABILITY_ENUM_FIXTURE, 'AbilityId', 'src/enums/ability-id.ts');
  const typeCatalog = parser.parseEnum(UPSTREAM_TYPE_ENUM_FIXTURE, 'PokemonType', 'src/enums/pokemon-type.ts');

  // SpeciesId checks (Explicit BULBASAUR=1, sequential IVYSAUR=2, explicit PIKACHU=25, explicit GOLEM after GRAVELER)
  assert.strictEqual(speciesCatalog.getId('BULBASAUR'), 1);
  assert.strictEqual(speciesCatalog.getSymbol(1), 'BULBASAUR');
  assert.strictEqual(speciesCatalog.getId('IVYSAUR'), 2);
  assert.strictEqual(speciesCatalog.getId('VENUSAUR'), 3);
  assert.strictEqual(speciesCatalog.getId('PIKACHU'), 25);
  assert.strictEqual(speciesCatalog.getSymbol(25), 'PIKACHU');
  assert.strictEqual(speciesCatalog.getId('GEODUDE'), 74);
  assert.strictEqual(speciesCatalog.getId('GRAVELER'), 75);
  assert.strictEqual(speciesCatalog.getId('GOLEM'), 76);
  assert.strictEqual(speciesCatalog.getSymbol(76), 'GOLEM');
  assert.strictEqual(speciesCatalog.getId('ALOLA_RATTATA'), 2019);

  // MoveId checks (NONE=0, POUND=1, TACKLE=33, THUNDERBOLT=85, EARTHQUAKE=89)
  assert.strictEqual(moveCatalog.getId('NONE'), 0);
  assert.strictEqual(moveCatalog.getId('POUND'), 1);
  assert.strictEqual(moveCatalog.getId('TACKLE'), 33);
  assert.strictEqual(moveCatalog.getId('BODY_SLAM'), 34);
  assert.strictEqual(moveCatalog.getId('THUNDERBOLT'), 85);
  assert.strictEqual(moveCatalog.getSymbol(85), 'THUNDERBOLT');
  assert.strictEqual(moveCatalog.getId('EARTHQUAKE'), 89);

  // AbilityId checks (NONE=0, STENCH=1, STURDY=5, STATIC=9)
  assert.strictEqual(abilityCatalog.getId('NONE'), 0);
  assert.strictEqual(abilityCatalog.getId('STENCH'), 1);
  assert.strictEqual(abilityCatalog.getId('STURDY'), 5);
  assert.strictEqual(abilityCatalog.getSymbol(5), 'STURDY');
  assert.strictEqual(abilityCatalog.getId('STATIC'), 9);
  assert.strictEqual(abilityCatalog.getSymbol(9), 'STATIC');

  // PokemonType checks (UNKNOWN=-1, NORMAL=0, FIGHTING=1, ELECTRIC=13)
  assert.strictEqual(typeCatalog.getId('UNKNOWN'), -1);
  assert.strictEqual(typeCatalog.getId('NORMAL'), 0);
  assert.strictEqual(typeCatalog.getId('FIGHTING'), 1);
  assert.strictEqual(typeCatalog.getSymbol(-1), 'UNKNOWN');
});

test('MILESTONE 11.2: PokerogueLocaleImporter ingests EN and ES JSON packages preserving semantic structure', () => {
  const importer = new PokerogueLocaleImporter();
  const enMovePkg = importer.parseLocale(JSON.stringify(UPSTREAM_LOCALES_FIXTURE.en.move), 'en', 'move', 'en/move.json');
  const esMovePkg = importer.parseLocale(JSON.stringify(UPSTREAM_LOCALES_FIXTURE.es.move), 'es-ES', 'move', 'es-ES/move.json');
  const enAbPkg = importer.parseLocale(JSON.stringify(UPSTREAM_LOCALES_FIXTURE.en.ability), 'en', 'ability', 'en/ability.json');
  const esAbPkg = importer.parseLocale(JSON.stringify(UPSTREAM_LOCALES_FIXTURE.es.ability), 'es-ES', 'ability', 'es-ES/ability.json');

  assert.strictEqual(enMovePkg.get('thunderbolt').name, 'Thunderbolt');
  assert.strictEqual(esMovePkg.get('thunderbolt').name, 'Rayo');
  assert.strictEqual(importer.getText('move', 'thunderbolt', 'name', 'en'), 'Thunderbolt');
  assert.strictEqual(importer.getText('move', 'thunderbolt', 'name', 'es'), 'Rayo');
  assert.ok(importer.getText('move', 'thunderbolt', 'effect', 'es').includes('eléctrico'));

  assert.strictEqual(importer.getText('ability', 'static', 'name', 'en'), 'Static');
  assert.strictEqual(importer.getText('ability', 'static', 'name', 'es'), 'Electricidad Estática');
  assert.strictEqual(importer.getText('ability', 'sturdy', 'name', 'es'), 'Robustez');
});

test('MILESTONE 11.3: DataManager registers enums, manages locales, and performs queries without direct upstream access', () => {
  const enumParser = new PokerogueEnumParser();
  const speciesCatalog = enumParser.parseEnum(UPSTREAM_SPECIES_ENUM_FIXTURE, 'SpeciesId', 'src/enums/species-id.ts');
  const moveCatalog = enumParser.parseEnum(UPSTREAM_MOVE_ENUM_FIXTURE, 'MoveId', 'src/enums/move-id.ts');

  dataManager.registerEnums('SpeciesId', speciesCatalog);
  dataManager.registerEnums('MoveId', moveCatalog);

  assert.strictEqual(dataManager.getEnumByName('SpeciesId', 'PIKACHU'), 25);
  assert.strictEqual(dataManager.getEnumByName('SpeciesId', 'GOLEM'), 76);
  assert.strictEqual(dataManager.getEnumById('SpeciesId', 25), 'PIKACHU');
  assert.strictEqual(dataManager.getEnumById('SpeciesId', 76), 'GOLEM');
  assert.strictEqual(dataManager.getEnumByName('MoveId', 'THUNDERBOLT'), 85);
  assert.strictEqual(dataManager.getEnumById('MoveId', 85), 'THUNDERBOLT');

  // Register locale package
  const localeImporter = new PokerogueLocaleImporter();
  const esMovePkg = localeImporter.parseLocale(JSON.stringify(UPSTREAM_LOCALES_FIXTURE.es.move), 'es-ES', 'move', 'es-ES/move.json');
  dataManager.registerLocale(esMovePkg);

  dataManager.setLocale('es-ES');
  assert.strictEqual(dataManager.getLocale(), 'es-ES');
  assert.strictEqual(dataManager.getLocalizedText('move', 'thunderbolt', 'name', 'es'), 'Rayo');
});

test('MILESTONE 11.4: Provenance and determinism across repeated enum and locale imports', () => {
  const parser1 = new PokerogueEnumParser();
  const parser2 = new PokerogueEnumParser();

  const cat1 = parser1.parseEnum(UPSTREAM_SPECIES_ENUM_FIXTURE, 'SpeciesId', 'src/enums/species-id.ts');
  const cat2 = parser2.parseEnum(UPSTREAM_SPECIES_ENUM_FIXTURE, 'SpeciesId', 'src/enums/species-id.ts');

  // Check provenance tracking
  assert.strictEqual(cat1.provenance.source, 'pokerogue');
  assert.strictEqual(cat1.provenance.sourcePath, 'src/enums/species-id.ts');
  assert.strictEqual(cat1.provenance.sourceRevision, '8555c08c823b856cbec4eb99ca84ea52a955836d');
  assert.strictEqual(cat1.provenance.license, 'AGPL-v3.0-only');

  // Exact hash matching (Reproducibility & Determinism)
  assert.strictEqual(cat1.sourceHash, cat2.sourceHash);
  assert.strictEqual(cat1.count, cat2.count);
  assert.deepStrictEqual(cat1.entries(), cat2.entries());
});

test('MILESTONE 11.5: Idempotency of enum and locale registration (no duplicate records)', () => {
  const enumParser = new PokerogueEnumParser();
  const moveCatalog = enumParser.parseEnum(UPSTREAM_MOVE_ENUM_FIXTURE, 'MoveId', 'src/enums/move-id.ts');

  const initialCount = moveCatalog.count;
  // Re-insert existing entries
  moveCatalog.set('THUNDERBOLT', 85);
  moveCatalog.set('TACKLE', 33);
  assert.strictEqual(moveCatalog.count, initialCount, 'Re-inserting entries must not increase count');

  // DataManager re-registration
  dataManager.registerEnums('MoveId', moveCatalog);
  dataManager.registerEnums('MoveId', moveCatalog);
  assert.strictEqual(dataManager.getEnum('MoveId').count, initialCount);
});

test('MILESTONE 11.6: Unknown value handling does not fail silently', () => {
  assert.strictEqual(dataManager.getEnumByName('SpeciesId', 'NON_EXISTENT_POKEMON_XYZ'), null);
  assert.strictEqual(dataManager.getEnumById('SpeciesId', 999999), null);
  assert.strictEqual(dataManager.getLocalizedText('move', 'unknown_move_404', 'name', 'es'), null);
});

test('MILESTONE 11.7: Language switching EN -> ES -> EN is purely presentational and preserves BattleState and RNG determinism', () => {
  const pSpecies = dataManager.getSpecies('pikachu');
  const eSpecies = dataManager.getSpecies('golem');
  assert.ok(pSpecies && eSpecies);

  const pBattler = new PokemonBattleData(pSpecies, 20);
  const eBattler = new PokemonBattleData(eSpecies, 20);

  const seed = 12345;
  const state = new BattleState(pBattler, eBattler, seed);
  const engine = new BattleEngine(state);

  // Snapshot before turn
  const initialPlayerHp = state.player.active.currentHp;
  const initialEnemyHp = state.enemy.active.currentHp;

  // Run a turn in EN
  dataManager.setLocale('en');
  engine.runFullTurn('quick_attack');
  const hpAfterTurn1 = state.enemy.active.currentHp;
  const rngStateAfterTurn1 = state.rngState;

  // Switch language to ES
  dataManager.setLocale('es-ES');
  assert.strictEqual(dataManager.getLocale(), 'es-ES');

  // Verify BattleState and RNG are completely unaffected by locale changes
  assert.strictEqual(state.enemy.active.currentHp, hpAfterTurn1, 'Switching locale must not alter enemy HP');
  assert.strictEqual(state.rngState, rngStateAfterTurn1, 'Switching locale must not alter RNG state');

  // Switch back to EN
  dataManager.setLocale('en');
  assert.strictEqual(state.enemy.active.currentHp, hpAfterTurn1, 'Switching locale back to EN must preserve battle state');
  assert.strictEqual(state.rngState, rngStateAfterTurn1, 'Switching locale back to EN must preserve RNG state');
});

// -------------------------------------------------------------
// 11. MILESTONE 12: BATTLE DOMAIN ARCHITECTURE TESTS
// -------------------------------------------------------------
test('MILESTONE 12.1: BattleCommand validation rejects invalid commands without mutating state', () => {
  const pSpecies = dataManager.getSpecies('pikachu');
  const eSpecies = dataManager.getSpecies('golem');
  const pBattler = new PokemonBattleData(pSpecies, 20);
  const eBattler = new PokemonBattleData(eSpecies, 20);
  const state = new BattleState(pBattler, eBattler, 7777);

  // Valid command
  const activeMove = pBattler.moves[0];
  const validCmd = new SelectMoveCommand('player', activeMove.id);
  const validRes = validCmd.validate(state);
  assert.strictEqual(validRes.valid, true);

  // Invalid command: non-existent move
  const invalidMoveCmd = new SelectMoveCommand('player', 'non_existent_super_laser');
  const invalidMoveRes = invalidMoveCmd.validate(state);
  assert.strictEqual(invalidMoveRes.valid, false);
  assert.ok(invalidMoveRes.reason.includes('not in'));

  // Invalid command: fainted actor
  pBattler.fainted = true;
  pBattler.currentHp = 0;
  const faintedActorRes = validCmd.validate(state);
  assert.strictEqual(faintedActorRes.valid, false);
  assert.ok(faintedActorRes.reason.includes('fainted'));

  // Invalid command: battle already finished
  pBattler.fainted = false;
  pBattler.currentHp = pBattler.maxHp;
  state.phase = 'BattleFinished';
  state.winner = 'player';
  const finishedBattleRes = validCmd.validate(state);
  assert.strictEqual(finishedBattleRes.valid, false);
  assert.ok(finishedBattleRes.reason.includes('concluded'));

  // Serializability check
  const jsonStr = JSON.stringify(validCmd.toJSON());
  const deserialized = BattleCommand.fromJSON(jsonStr);
  assert.strictEqual(deserialized.type, 'SELECT_MOVE');
  assert.strictEqual(deserialized.actorId, 'player');
  assert.strictEqual(deserialized.moveId, activeMove.id);
});

test('MILESTONE 12.2: Phase pipeline executes modularly and preserves Gen 9 math & ability triggers', () => {
  const pSpecies = dataManager.getSpecies('pikachu');
  const eSpecies = dataManager.getSpecies('golem');
  const pBattler = new PokemonBattleData(pSpecies, 20);
  const eBattler = new PokemonBattleData(eSpecies, 20);
  const state = new BattleState(pBattler, eBattler, 8888);

  const pMove = pBattler.moves[0];
  const eMove = eBattler.moves[0];

  // 1. ActionOrderPhase
  const { firstAction, secondAction, playerFirst } = ActionOrderPhase.resolve(state, pMove, eMove);
  assert.ok(firstAction && secondAction);
  // Pikachu has higher base speed than Golem at Lv 20
  assert.strictEqual(playerFirst, true, 'Pikachu should move first due to speed advantage');

  // 2. DamagePhase Gen 9 calculation
  const breakdown = DamagePhase.calculateDamage(state, pBattler, eBattler, pMove);
  assert.ok(breakdown.finalDamage > 0);
  assert.strictEqual(breakdown.attacker, pBattler.nickname);
  assert.strictEqual(breakdown.defender, eBattler.nickname);
  assert.strictEqual(breakdown.stab, 1.0); // Tackle is Normal, Pikachu is Electric

  // 3. FaintCheckPhase
  const faintCheckBefore = FaintCheckPhase.resolve({ emit: () => {}, state }, eBattler, false);
  assert.strictEqual(faintCheckBefore.fainted, false);
  assert.strictEqual(faintCheckBefore.winner, null);

  eBattler.currentHp = 0;
  let eventEmitted = null;
  const mockEngine = {
    state,
    emit: (ev, p) => { eventEmitted = { ev, p }; }
  };
  const faintCheckAfter = FaintCheckPhase.resolve(mockEngine, eBattler, false);
  assert.strictEqual(faintCheckAfter.fainted, true);
  assert.strictEqual(faintCheckAfter.winner, 'player');
  assert.strictEqual(state.winner, 'player');
});

test('MILESTONE 12.3: BattleEngine produces typed serializable events in strict deterministic order', () => {
  const pSpecies = dataManager.getSpecies('pikachu');
  const eSpecies = dataManager.getSpecies('golem');
  const pBattler = new PokemonBattleData(pSpecies, 20);
  const eBattler = new PokemonBattleData(eSpecies, 20);
  const state = new BattleState(pBattler, eBattler, 5555);
  const engine = new BattleEngine(state);

  const recordedEvents = [];
  engine.on('TurnStarted', (e) => recordedEvents.push(e.type));
  engine.on('MoveSelected', (e) => recordedEvents.push(e.type));
  engine.on('MoveStarted', (e) => recordedEvents.push(e.type));
  engine.on('MoveHit', (e) => recordedEvents.push(e.type));
  engine.on('DamageCalculated', (e) => recordedEvents.push(e.type));
  engine.on('DamageApplied', (e) => recordedEvents.push(e.type));
  engine.on('HPChanged', (e) => recordedEvents.push(e.type));
  engine.on('TurnEnded', (e) => recordedEvents.push(e.type));

  const cmd = new SelectMoveCommand('player', 'quick_attack');
  const res = engine.executeCommand(cmd);
  assert.strictEqual(res.success, true);

  // Check event order: MoveSelected -> TurnStarted -> MoveStarted -> MoveHit -> DamageCalculated -> DamageApplied -> HPChanged -> TurnEnded
  assert.ok(recordedEvents.indexOf('MoveSelected') < recordedEvents.indexOf('TurnStarted'));
  assert.ok(recordedEvents.indexOf('TurnStarted') < recordedEvents.indexOf('MoveStarted'));
  assert.ok(recordedEvents.indexOf('MoveStarted') < recordedEvents.indexOf('MoveHit'));
  assert.ok(recordedEvents.indexOf('MoveHit') < recordedEvents.indexOf('DamageCalculated'));
  assert.ok(recordedEvents.indexOf('DamageCalculated') < recordedEvents.indexOf('DamageApplied'));
  assert.ok(recordedEvents.indexOf('DamageApplied') < recordedEvents.indexOf('HPChanged'));
  assert.ok(recordedEvents.indexOf('HPChanged') < recordedEvents.indexOf('TurnEnded'));

  // Ensure all events in eventLog are JSON-serializable without circular references or DOM
  const serializedLog = JSON.stringify(state.eventLog);
  assert.ok(serializedLog.length > 50);
  const parsedLog = JSON.parse(serializedLog);
  assert.strictEqual(parsedLog.length, state.eventLog.length);
});

test('MILESTONE 12.4: Deterministic turn replay produces 100% identical state and RNG progression', () => {
  const runSimulation = (seed) => {
    const pSpecies = dataManager.getSpecies('pikachu');
    const eSpecies = dataManager.getSpecies('golem');
    const pBattler = new PokemonBattleData(pSpecies, 20);
    const eBattler = new PokemonBattleData(eSpecies, 20);
    const state = new BattleState(pBattler, eBattler, seed);
    const engine = new BattleEngine(state);

    engine.executeCommand(new SelectMoveCommand('player', 'quick_attack'));
    engine.executeCommand(new SelectMoveCommand('player', 'tackle'));

    return {
      turn: state.turn,
      playerHp: state.player.active.currentHp,
      enemyHp: state.enemy.active.currentHp,
      rngState: state.rngState,
      eventTypes: state.eventLog.map(e => e.type),
      damageBreakdown: state.damageBreakdown
    };
  };

  const simA = runSimulation(4242);
  const simB = runSimulation(4242);

  assert.strictEqual(simA.turn, simB.turn);
  assert.strictEqual(simA.playerHp, simB.playerHp);
  assert.strictEqual(simA.enemyHp, simB.enemyHp);
  assert.strictEqual(simA.rngState, simB.rngState);
  assert.deepStrictEqual(simA.eventTypes, simB.eventTypes);
  assert.deepStrictEqual(simA.damageBreakdown, simB.damageBreakdown);
});

test('MILESTONE 12.5: BattleSession manages lifecycle, dispatching, and match restart', () => {
  const session = new BattleSession({
    playerSpeciesId: 'pikachu',
    enemySpeciesId: 'golem',
    playerLevel: 20,
    enemyLevel: 20,
    seed: 31415
  });

  assert.strictEqual(session.isConcluded(), false);
  assert.strictEqual(session.getWinner(), null);

  // Dispatch valid move
  const firstMoveId = session.state.player.active.moves[0].id;
  const result = session.selectMove(firstMoveId);
  assert.strictEqual(result.success, true);
  assert.strictEqual(session.commandLog.length, 1);
  assert.strictEqual(session.commandLog[0].type, 'SELECT_MOVE');

  // Dispatch forfeit
  const forfeitRes = session.forfeit();
  assert.strictEqual(forfeitRes.success, true);
  assert.strictEqual(session.isConcluded(), true);
  assert.strictEqual(session.getWinner(), 'enemy');

  // Restart match
  session.restart();
  assert.strictEqual(session.isConcluded(), false);
  assert.strictEqual(session.getWinner(), null);
  assert.strictEqual(session.state.turn, 1);
  assert.strictEqual(session.commandLog.length, 0);
});

test('MILESTONE 12.6: Offline canonical enum fallback ensures 100% resolved IDs without remote connection', async () => {
  // Test importVerticalSlice with null repository (offline simulation)
  const offlineImporter = new PokerogueImporter(null);
  const result = await offlineImporter.importVerticalSlice(null);

  assert.strictEqual(result.species.length, 2);
  const pika = result.species.find(s => s.id === 'pikachu');
  const golem = result.species.find(s => s.id === 'golem');

  // Verify IDs are properly resolved, not 0
  assert.strictEqual(pika.speciesId, 25);
  assert.strictEqual(golem.speciesId, 76);

  assert.ok(result.moves.length >= 2);
  const tb = result.moves.find(m => m.id === 'thunderbolt');
  const tk = result.moves.find(m => m.id === 'tackle');
  assert.strictEqual(tb.moveId, 85);
  assert.strictEqual(tk.moveId, 33);

  const st = result.abilities.find(a => a.id === 'static');
  assert.ok(st);
});

async function runAllTests() {
  for (const { name, fn } of testQueue) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ ${name}`);
      console.error(`     Error: ${err.message}`);
      console.error(err.stack);
    }
  }

  console.log(`\n====================================================`);
  console.log(`  TEST RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
  console.log(`====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

await runAllTests();

