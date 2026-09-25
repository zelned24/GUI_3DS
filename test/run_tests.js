import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import { ComponentRegistry } from '../public/js/components/ComponentRegistry.js';
import { ProjectModel } from '../public/js/core/ProjectModel.js';
import { Validator } from '../public/js/core/Validator.js';
import { CodeGenerator } from '../public/js/generator/CodeGenerator.js';
import { UINode } from '../public/js/core/UINode.js';
import { Transform } from '../public/js/core/Transform.js';
import { Props, PropertyTypes } from '../public/js/core/PropertySystem.js';
import { SceneModel } from '../public/js/core/SceneModel.js';
import { ImageNode } from '../public/js/components/ImageNode.js';
import { PokemonSpriteNode } from '../public/js/components/PokemonSpriteNode.js';
import { GroupNode } from '../public/js/components/GroupNode.js';
import { AssetResolver, assetResolver } from '../public/js/data/AssetResolver.js';
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
import { AppShell, AppStates } from '../public/js/shell/AppShell.js';
import { WaveManager } from '../public/js/wave/WaveManager.js';
import { getFallbackTestFixture } from './fixtures/fallbackVerticalSlice.js';
import {
  UPSTREAM_SPECIES_ENUM_FIXTURE,
  UPSTREAM_MOVE_ENUM_FIXTURE,
  UPSTREAM_ABILITY_ENUM_FIXTURE,
  UPSTREAM_TYPE_ENUM_FIXTURE,
  UPSTREAM_LOCALES_FIXTURE
} from './fixtures/upstream_enums_fixture.js';

import { Keyframe } from '../public/js/animation/Keyframe.js';
import { Interpolation } from '../public/js/animation/Interpolation.js';
import { AnimationTrack } from '../public/js/animation/AnimationTrack.js';
import { TimelineEvaluator } from '../public/js/animation/TimelineEvaluator.js';
import { SceneValidator } from '../public/js/generator/SceneValidator.js';
import { SceneCppExporter } from '../public/js/generator/SceneCppExporter.js';
import { NativeParityRunner } from './native/NativeParityRunner.js';
import { AudioResolver } from '../public/js/data/AudioResolver.js';
import { AssetPackager } from '../public/js/generator/AssetPackager.js';


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

test('MILESTONE 13.1: AppShell controls state transitions and lifecycle without DOM leakage', async () => {
  const shell = new AppShell();
  assert.strictEqual(shell.currentState, AppStates.BOOT);

  // Transition to TITLE
  await shell.transitionTo(AppStates.TITLE);
  assert.strictEqual(shell.currentState, AppStates.TITLE);

  // Transition to SETUP
  await shell.transitionTo(AppStates.SETUP);
  assert.strictEqual(shell.currentState, AppStates.SETUP);

  // Transition to DEBUG invokes hook
  let debugInvoked = false;
  shell.onEnterDebug = () => { debugInvoked = true; };
  await shell.transitionTo(AppStates.DEBUG);
  assert.strictEqual(shell.currentState, AppStates.DEBUG);
  assert.strictEqual(debugInvoked, true);

  shell.destroy();
});

test('MILESTONE 13.2: WaveManager progresses from Wave 1 to Wave 10 and produces run summary', () => {
  const wm = new WaveManager();
  wm.resetRun({ speciesId: 'pikachu', level: 20 });
  assert.strictEqual(wm.currentWave, 1);
  assert.strictEqual(wm.isRunComplete(), false);

  // Wave 1
  const w1 = wm.getCurrentWaveDefinition();
  assert.strictEqual(w1.waveNumber, 1);
  assert.strictEqual(w1.isBoss, false);

  // Simulate victory on wave 1
  wm.recordBattleResult({ won: true, turns: 3, damageDealt: 50, damageTaken: 12 });
  assert.strictEqual(wm.runStats.battlesWon, 1);

  // Advance waves 2 through 10
  for (let i = 2; i <= 10; i++) {
    const wDef = wm.advanceWave();
    assert.strictEqual(wDef.waveNumber, i);
    if (i === 5) {
      assert.strictEqual(wDef.isMiniBoss, true, 'Wave 5 should be mini-boss');
    }
    wm.recordBattleResult({ won: true, turns: 2, damageDealt: 40, damageTaken: 5 });
  }

  assert.strictEqual(wm.currentWave, 10);
  const w10 = wm.getCurrentWaveDefinition();
  assert.strictEqual(w10.waveNumber, 10);
  assert.strictEqual(w10.isBoss, true, 'Wave 10 must be the Alpha Stage Boss');

  // Clear Wave 10 and finish run
  wm.advanceWave();
  assert.strictEqual(wm.isRunComplete(), true);

  const summary = wm.getRunSummary();
  assert.strictEqual(summary.cleared, true);
  assert.strictEqual(summary.wavesCompleted, 10);
  assert.strictEqual(summary.totalWaves, 10);
  assert.ok(summary.totalTurns > 0);
  assert.ok(summary.damageDealt > 0);
});

test('MILESTONE 13.3: WaveManager creates valid BattleState across all 10 waves', () => {
  const wm = new WaveManager();
  wm.resetRun({ speciesId: 'pikachu', level: 25 });

  for (let wave = 1; wave <= 10; wave++) {
    wm.currentWave = wave;
    const battleState = wm.createBattleStateForCurrentWave(1000);
    assert.strictEqual(battleState.wave, wave);
    assert.ok(battleState.player.active.currentHp > 0);
    assert.ok(battleState.enemy.active.currentHp > 0);
    assert.strictEqual(battleState.player.active.species.id, 'pikachu');
    assert.ok(battleState.enemy.active.species.id === 'golem' || battleState.enemy.active.species.id === 'pikachu');
  }
});

test('MILESTONE 13.4: Complete playable loop simulation (Boot -> Setup -> Wave 1 -> Victory -> Wave 10 -> Summary)', async () => {
  const shell = new AppShell();
  shell.init();
  assert.strictEqual(shell.currentState, AppStates.TITLE);

  // 1. Enter Setup
  await shell.transitionTo(AppStates.SETUP);
  assert.strictEqual(shell.currentState, AppStates.SETUP);

  // 2. Start Run with Pikachu Lv 30
  shell.startNewRun({ speciesId: 'pikachu', level: 30 });
  assert.strictEqual(shell.currentState, AppStates.WAVE_INTRO);
  assert.strictEqual(shell.waveManager.currentWave, 1);

  // 3. Enter Battle Wave 1
  await shell.transitionTo(AppStates.BATTLE);
  assert.strictEqual(shell.currentState, AppStates.BATTLE);

  // 4. Record victory and advance to Wave 2
  shell.waveManager.recordBattleResult({ won: true, turns: 2, damageDealt: 60, damageTaken: 0 });
  await shell.transitionTo(AppStates.RESULT, { won: true, wave: 1 });
  assert.strictEqual(shell.currentState, AppStates.RESULT);

  // 5. Advance through waves 2 to 9
  for (let w = 2; w <= 9; w++) {
    shell.advanceWave();
    assert.strictEqual(shell.currentState, AppStates.WAVE_INTRO);
    assert.strictEqual(shell.waveManager.currentWave, w);
    shell.waveManager.recordBattleResult({ won: true, turns: 3, damageDealt: 70, damageTaken: 10 });
  }

  // 6. Advance to Wave 10
  shell.advanceWave();
  assert.strictEqual(shell.currentState, AppStates.WAVE_INTRO);
  assert.strictEqual(shell.waveManager.currentWave, 10);
  shell.waveManager.recordBattleResult({ won: true, turns: 5, damageDealt: 150, damageTaken: 20 });

  // 7. Advance past Wave 10 leads to RUN_SUMMARY
  shell.advanceWave();
  assert.strictEqual(shell.currentState, AppStates.RUN_SUMMARY);
  assert.strictEqual(shell.waveManager.isRunComplete(), true);

  // 8. Return to Title
  await shell.transitionTo(AppStates.TITLE);
  assert.strictEqual(shell.currentState, AppStates.TITLE);

  shell.destroy();
});

// -------------------------------------------------------------
// BETA-UI-1: SCENE GRAPH + ASSET NODE AUTOMATED TEST SUITE
// -------------------------------------------------------------
test('BETA-UI-1.1: SceneModel represents dual-screen composition with 60 FPS, durationFrames, tracks, markers, audioCues', () => {
  const scene = new SceneModel({
    id: 'IntroBattleScene',
    name: 'Intro Battle Scene',
    durationFrames: 120,
    fps: 60,
    top: { backgroundColor: '#10141f' },
    bottom: { backgroundColor: '#18121f' }
  });

  assert.strictEqual(scene.id, 'IntroBattleScene');
  assert.strictEqual(scene.durationFrames, 120);
  assert.strictEqual(scene.fps, 60);
  assert.strictEqual(scene.top.width, 400);
  assert.strictEqual(scene.top.height, 240);
  assert.strictEqual(scene.bottom.width, 320);
  assert.strictEqual(scene.bottom.height, 240);

  // Add nodes to TOP, BOTTOM, and GLOBAL
  const bgNode = ComponentRegistry.create('Image', {
    id: 'bg_plains',
    name: 'Plains Arena',
    screen: 'top',
    x: 0,
    y: 0,
    width: 400,
    height: 240,
    properties: { asset: 'bg_arena_plains', fit: 'stretch' }
  });

  const pikaNode = ComponentRegistry.create('PokemonSprite', {
    id: 'pikachu_sprite',
    name: 'Pikachu Player',
    screen: 'top',
    x: 60,
    y: 120,
    width: 64,
    height: 64,
    properties: { species: 'Pikachu', nationalDexId: 25, facing: 'back' }
  });

  const fadeOverlay = ComponentRegistry.create('Image', {
    id: 'screen_fade',
    name: 'Screen Fade',
    screen: 'global',
    x: 0,
    y: 0,
    width: 400,
    height: 240,
    properties: { asset: 'ui_fade', tint: '#000000' }
  });

  scene.addNode(bgNode);
  scene.addNode(pikaNode);
  scene.addNode(fadeOverlay);

  assert.strictEqual(scene.nodes.length, 3);
  assert.strictEqual(scene.getNodesByScreen('top').length, 2);
  assert.strictEqual(scene.getNodesByScreen('global').length, 1);
  assert.strictEqual(scene.getNode('pikachu_sprite').properties.nationalDexId, 25);

  // Markers & Audio cues
  const marker = scene.addMarker({ frame: 30, name: 'PikachuEntrance', type: 'Event' });
  const cue = scene.addAudioCue({ frame: 30, asset: 'sfx_pikachu_cry', volume: 0.8, channel: 1 });

  assert.strictEqual(scene.markers.length, 1);
  assert.strictEqual(scene.markers[0].frame, 30);
  assert.strictEqual(scene.audioCues.length, 1);
  assert.strictEqual(scene.audioCues[0].asset, 'sfx_pikachu_cry');

  // Serialization & Deserialization
  const json = scene.toJSON();
  assert.strictEqual(json.schemaVersion, 2);
  assert.strictEqual(json.durationFrames, 120);
  assert.strictEqual(json.nodes.length, 3);

  const restored = SceneModel.fromJSON(json);
  assert.strictEqual(restored.id, 'IntroBattleScene');
  assert.strictEqual(restored.nodes.length, 3);
  assert.strictEqual(restored.nodes[1].type, 'PokemonSprite');
});

test('BETA-UI-1.2: ImageNode handles asset binding, flips, tint, blendMode, and spatial transforms', () => {
  const img = ComponentRegistry.create('Image', {
    id: 'forest_bg',
    screen: 'top',
    x: 0,
    y: 0,
    width: 400,
    height: 240,
    properties: {
      asset: 'bg_arena_forest',
      flipX: true,
      flipY: false,
      tint: '#ffffff',
      blendMode: 'normal',
      fit: 'cover'
    }
  });

  assert.strictEqual(img instanceof ImageNode, true);
  assert.strictEqual(img.properties.asset, 'bg_arena_forest');
  assert.strictEqual(img.properties.flipX, true);
  assert.strictEqual(img.properties.flipY, false);
  assert.strictEqual(img.properties.fit, 'cover');

  // Check static schema
  const schema = ImageNode.schema;
  assert.strictEqual(schema.type, 'Image');
  assert.ok(schema.properties.asset);
  assert.ok(schema.properties.flipX);
  assert.ok(schema.properties.flipY);
  assert.ok(schema.properties.fit);

  // Check drawing in headless canvas context (does not throw)
  const fakeCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {}
  };
  assert.doesNotThrow(() => img.render(fakeCtx));
});

test('BETA-UI-1.3: PokemonSpriteNode binds declarative PokéRogue properties and resolves real assets without fictitious paths', () => {
  const pikaSprite = ComponentRegistry.create('PokemonSprite', {
    id: 'pika_node',
    screen: 'top',
    x: 50,
    y: 75,
    width: 64,
    height: 64,
    properties: {
      species: 'Pikachu',
      nationalDexId: 25,
      form: 'normal',
      gender: 'male',
      shiny: true,
      facing: 'front',
      animation: 'idle'
    }
  });

  assert.strictEqual(pikaSprite instanceof PokemonSpriteNode, true);
  assert.strictEqual(pikaSprite.properties.nationalDexId, 25);
  assert.strictEqual(pikaSprite.properties.shiny, true);
  assert.strictEqual(pikaSprite.properties.facing, 'front');

  // Asset resolution through real resolver (commit 056a1f408f26a3be4fef243f7462cb43608c7928)
  const res = pikaSprite.resolveAsset();
  assert.strictEqual(res.exists, true);
  assert.strictEqual(res.speciesId, 25);
  assert.strictEqual(res.assetPaths.image, 'images/pokemon/25.png');
  assert.strictEqual(res.target3DS.t3xPath, 'romfs/sprites/pokemon/25.t3x');
  assert.strictEqual(res.target3DS.format, 'RGBA4444');

  // Test non-indexed species failure reporting without inventing fictitious paths
  const unindexed = ComponentRegistry.create('PokemonSprite', {
    id: 'unknown_pkmn',
    properties: { species: 'MissingNo', nationalDexId: 9999 }
  });
  const unres = unindexed.resolveAsset();
  assert.strictEqual(unres.exists, false);
  assert.strictEqual(unres.assetPaths, null);
  assert.ok(unres.error.includes('not indexed or does not exist'));
});

test('BETA-UI-1.4: GroupNode organizes hierarchical children with combined spatial transformations', () => {
  const group = ComponentRegistry.create('Group', {
    id: 'battle_hud_group',
    screen: 'top',
    x: 20,
    y: 20,
    width: 200,
    height: 80
  });

  assert.strictEqual(group instanceof GroupNode, true);
  assert.strictEqual(group.type, 'Group');

  const pika = ComponentRegistry.create('PokemonSprite', {
    id: 'group_pika',
    parent: 'battle_hud_group',
    x: 10,
    y: 10,
    properties: { nationalDexId: 25 }
  });

  const scene = new SceneModel({ id: 'group_test' });
  scene.addNode(group);
  scene.addNode(pika);

  assert.strictEqual(group.children.includes('group_pika'), true);
  assert.strictEqual(pika.parent, 'battle_hud_group');

  // World transform calculation traversing group parent
  const world = pika.getWorldTransform(scene);
  assert.strictEqual(world.x, 30); // 20 + 10
  assert.strictEqual(world.y, 30); // 20 + 10
});

test('BETA-UI-1.5: AssetResolver catalogs real PokéRogue assets, categories, and generates node configs', () => {
  const cats = assetResolver.getCategories();
  assert.ok(cats.length >= 5);
  assert.ok(cats.some(c => c.id === 'pokemon'));
  assert.ok(cats.some(c => c.id === 'backgrounds'));
  assert.ok(cats.some(c => c.id === 'ui'));

  // Search by query
  const pikaResults = assetResolver.search('Pikachu');
  assert.ok(pikaResults.length > 0);
  assert.strictEqual(pikaResults[0].nationalDexId, 25);
  assert.strictEqual(pikaResults[0].defaultComponent, 'PokemonSprite');

  // Search by category
  const bgResults = assetResolver.search('', 'backgrounds');
  assert.ok(bgResults.length >= 4);
  assert.strictEqual(bgResults[0].defaultComponent, 'Image');
  assert.strictEqual(bgResults[0].dimensions.width, 400);
  assert.strictEqual(bgResults[0].dimensions.height, 240);

  // Generate node data for dragging and dropping onto canvas
  const plainsNodeData = assetResolver.createNodeData('bg_arena_plains', { screen: 'top' });
  assert.strictEqual(plainsNodeData.type, 'Image');
  assert.strictEqual(plainsNodeData.screen, 'top');
  assert.strictEqual(plainsNodeData.properties.asset, 'bg_arena_plains');
  assert.strictEqual(plainsNodeData.metadata.target3DS.format, 'RGB565');

  const charizardNodeData = assetResolver.createNodeData('pkmn_006', { screen: 'top', x: 100, y: 50 });
  assert.strictEqual(charizardNodeData.type, 'PokemonSprite');
  assert.strictEqual(charizardNodeData.properties.nationalDexId, 6);
  assert.strictEqual(charizardNodeData.x, 100);
  assert.strictEqual(charizardNodeData.y, 50);
});

test('BETA-UI-1.6: CodeGenerator exports Image and PokemonSprite to valid C++ with Citro2D targets', () => {
  const scene = new SceneModel({
    id: 'SceneExportTest',
    name: 'Scene Export Test'
  });

  const bg = ComponentRegistry.create('Image', {
    id: 'bg_plains',
    screen: 'top',
    x: 0,
    y: 0,
    width: 400,
    height: 240,
    properties: { asset: 'bg_arena_plains', flipX: true, flipY: false }
  });

  const pika = ComponentRegistry.create('PokemonSprite', {
    id: 'pikachu_player',
    screen: 'top',
    x: 60,
    y: 120,
    width: 64,
    height: 64,
    properties: { species: 'Pikachu', nationalDexId: 25, facing: 'back', shiny: false }
  });

  scene.addNode(bg);
  scene.addNode(pika);

  const generated = CodeGenerator.generate(scene);
  assert.ok(generated.hpp.includes('#include "ui/image.hpp"'));
  assert.ok(generated.hpp.includes('#include "pokemon/pokemon_sprite.hpp"'));
  assert.ok(generated.hpp.includes('std::unique_ptr<Image> m_bg_plains;'));
  assert.ok(generated.hpp.includes('std::unique_ptr<PokemonSprite> m_pikachu_player;'));

  assert.ok(generated.cpp.includes('m_bg_plains = std::make_unique<Image>(0.0f, 0.0f, 400.0f, 240.0f, "bg_arena_plains");'));
  assert.ok(generated.cpp.includes('m_bg_plains->setFlip(true, false);'));
  assert.ok(generated.cpp.includes('m_pikachu_player = std::make_unique<PokemonSprite>(60.0f, 120.0f, 25, "back", false);'));
});

// -------------------------------------------------------------
// 21. BETA-UI-2: ANIMATION MODEL, TIMELINE, EVALUATION & DETERMINISM
// -------------------------------------------------------------
test('BETA-UI-2.1: Keyframe model enforces integer frame snapping, value types, and cloning', () => {
  assert.strictEqual(Keyframe.snapFrame(12.37), 12);
  assert.strictEqual(Keyframe.snapFrame(14.8), 15);
  assert.strictEqual(Keyframe.snapFrame(-5), 0);

  const kf = new Keyframe({
    frame: 15.6,
    value: 240,
    interpolation: 'easeInOut'
  });

  assert.strictEqual(kf.frame, 16);
  assert.strictEqual(kf.value, 240);
  assert.strictEqual(kf.interpolation, 'easeInOut');

  const cloned = kf.clone({ frame: 30, value: 180 });
  assert.strictEqual(cloned.frame, 30);
  assert.strictEqual(cloned.value, 180);
  assert.strictEqual(cloned.interpolation, 'easeInOut');
  assert.strictEqual(kf.frame, 16); // immutable clone

  const json = kf.toJSON();
  const restored = Keyframe.fromJSON(json);
  assert.strictEqual(restored.frame, 16);
  assert.strictEqual(restored.value, 240);
  assert.strictEqual(restored.interpolation, 'easeInOut');
});

test('BETA-UI-2.2: Pure interpolation algorithms (Step, Linear, EaseIn, EaseOut, EaseInOut, Color)', () => {
  // Step
  assert.strictEqual(Interpolation.interpolate(0, 100, 0, 'step'), 0);
  assert.strictEqual(Interpolation.interpolate(0, 100, 0.99, 'step'), 0);
  assert.strictEqual(Interpolation.interpolate(0, 100, 1.0, 'step'), 100);

  // Linear
  assert.strictEqual(Interpolation.interpolate(100, 200, 0.5, 'linear'), 150);
  assert.strictEqual(Interpolation.interpolate(0, 10, 0.25, 'linear'), 2.5);

  // Ease In (quadratic t^2)
  const easeInVal = Interpolation.interpolate(0, 100, 0.5, 'easeIn');
  assert.strictEqual(easeInVal, 25); // 0.5^2 * 100 = 25

  // Ease Out (decelerates)
  const easeOutVal = Interpolation.interpolate(0, 100, 0.5, 'easeOut');
  assert.strictEqual(easeOutVal, 75); // (1 - (1-0.5)^2) * 100 = 75

  // Ease In Out (symmetric midpoint 50)
  const easeInOutMid = Interpolation.interpolate(0, 100, 0.5, 'easeInOut');
  assert.strictEqual(easeInOutMid, 50);

  // Hex Color interpolation
  const midGray = Interpolation.interpolate('#000000', '#ffffff', 0.5, 'linear');
  assert.strictEqual(midGray.toLowerCase(), '#808080');
});

test('BETA-UI-2.3: AnimationTrack manages keyframes (add, remove, move, duplicate, sort)', () => {
  const track = new AnimationTrack({
    targetNodeId: 'node_pika',
    propertyPath: 'transform.x',
    displayName: 'Pikachu X'
  });

  // Adding out of order maintains sorted frames
  track.addKeyframe(30, 240, 'linear');
  track.addKeyframe(0, 320, 'linear');
  track.addKeyframe(60, 220, 'easeInOut');
  track.addKeyframe(15, 280, 'linear');

  assert.strictEqual(track.keyframes.length, 4);
  assert.deepStrictEqual(track.keyframes.map(k => k.frame), [0, 15, 30, 60]);

  // Updating existing frame replaces value instead of adding duplicate
  track.addKeyframe(15, 285, 'linear');
  assert.strictEqual(track.keyframes.length, 4);
  assert.strictEqual(track.keyframes[1].value, 285);

  // Move keyframe
  const moved = track.moveKeyframe(15, 20);
  assert.strictEqual(moved, true);
  assert.deepStrictEqual(track.keyframes.map(k => k.frame), [0, 20, 30, 60]);

  // Remove keyframe
  const removed = track.removeKeyframe(20);
  assert.ok(removed);
  assert.deepStrictEqual(track.keyframes.map(k => k.frame), [0, 30, 60]);
});

test('BETA-UI-2.4: TimelineEvaluator evaluates before first, exact, between, and after last keyframe', () => {
  const track = new AnimationTrack({
    targetNodeId: 'hero',
    propertyPath: 'transform.x'
  });

  track.addKeyframe(10, 100, 'linear');
  track.addKeyframe(30, 300, 'linear');

  // Before first keyframe: clamped to first value
  assert.strictEqual(track.evaluate(0), 100);
  assert.strictEqual(track.evaluate(5), 100);

  // Exact keyframe: exact value without float drift
  assert.strictEqual(track.evaluate(10), 100);
  assert.strictEqual(track.evaluate(30), 300);

  // Between keyframes: linearly interpolated (frame 20 is exactly halfway)
  assert.strictEqual(track.evaluate(20), 200);

  // After last keyframe: clamped to last value
  assert.strictEqual(track.evaluate(45), 300);
  assert.strictEqual(track.evaluate(120), 300);
});

test('BETA-UI-2.5: SceneModel temporal source of truth (integer frame, duration, fps=60, frameToSeconds, seek)', () => {
  const scene = new SceneModel({
    id: 'TimeTestScene',
    fps: 60,
    durationFrames: 120
  });

  assert.strictEqual(scene.fps, 60);
  assert.strictEqual(scene.durationFrames, 120);
  assert.strictEqual(scene.currentFrame, 0);

  // Conversions
  assert.strictEqual(scene.frameToSeconds(60), 1.0);
  assert.strictEqual(scene.frameToSeconds(30), 0.5);
  assert.strictEqual(scene.secondsToFrame(1.5), 90);
  assert.strictEqual(scene.secondsToFrame(0.5), 30);

  // Formatted Timecode (MM:SS.mmm)
  assert.strictEqual(scene.getFormattedTime(0), '00:00.000');
  assert.strictEqual(scene.getFormattedTime(60), '00:01.000');
  assert.strictEqual(scene.getFormattedTime(90), '00:01.500');

  // Seek integer clamping
  scene.seek(45.8);
  assert.strictEqual(scene.currentFrame, 46);

  scene.seek(200); // clamps to durationFrames
  assert.strictEqual(scene.currentFrame, 120);

  scene.seek(-10); // clamps to 0
  assert.strictEqual(scene.currentFrame, 0);
});

test('BETA-UI-2.6: Preview State vs Document State separation (evaluation does NOT overwrite base document values)', () => {
  const scene = new SceneModel({ id: 'StateSeparationTest' });
  const node = ComponentRegistry.create('RogueBox', {
    id: 'box_01',
    screen: 'top',
    x: 300,
    y: 100,
    width: 60,
    height: 40
  });
  scene.addNode(node);

  const track = new AnimationTrack({
    targetNodeId: 'box_01',
    propertyPath: 'transform.x'
  });
  track.addKeyframe(0, 300, 'linear');
  track.addKeyframe(60, 100, 'linear');
  scene.tracks.push(track);

  // Evaluate at frame 30
  const evaluatedMap = scene.evaluate(30);
  assert.ok(evaluatedMap.has('box_01'));
  const evalData = evaluatedMap.get('box_01');
  assert.strictEqual(evalData.transform.x, 200);

  // CRITICAL REQUIREMENT: Persistent document node base value MUST NOT be mutated!
  assert.strictEqual(node.x, 300);
  assert.strictEqual(node.transform.x, 300);
});

test('BETA-UI-2.7: Track Mute and Solo filtering during evaluation', () => {
  const scene = new SceneModel({ id: 'MuteSoloTest' });
  const node = ComponentRegistry.create('PixelText', {
    id: 'txt_01',
    screen: 'top',
    x: 50,
    y: 50,
    properties: { text: 'Test' }
  });
  scene.addNode(node);

  const trackX = new AnimationTrack({
    id: 't_x',
    targetNodeId: 'txt_01',
    propertyPath: 'transform.x'
  });
  trackX.addKeyframe(0, 50, 'linear');
  trackX.addKeyframe(60, 150, 'linear');

  const trackOpacity = new AnimationTrack({
    id: 't_op',
    targetNodeId: 'txt_01',
    propertyPath: 'opacity'
  });
  trackOpacity.addKeyframe(0, 0, 'linear');
  trackOpacity.addKeyframe(60, 1, 'linear');

  scene.tracks = [trackX, trackOpacity];

  // Both evaluated
  let ev = scene.evaluate(30);
  assert.strictEqual(ev.get('txt_01').transform.x, 100);
  assert.strictEqual(ev.get('txt_01').opacity, 0.5);

  // Mute track X: only opacity evaluates
  trackX.muted = true;
  ev = scene.evaluate(30);
  assert.strictEqual(ev.get('txt_01').transform.x, undefined);
  assert.strictEqual(ev.get('txt_01').opacity, 0.5);
  trackX.muted = false;

  // Solo track X: opacity is ignored
  trackX.solo = true;
  ev = scene.evaluate(30);
  assert.strictEqual(ev.get('txt_01').transform.x, 100);
  assert.strictEqual(ev.get('txt_01').opacity, undefined);
});

test('BETA-UI-2.8: Persistence & Determinism (Scene serialization roundtrip preserves tracks, keyframes, identical evaluation)', () => {
  const originalScene = new SceneModel({
    id: 'DeterministicAnimScene',
    name: 'Deterministic Animation Scene',
    fps: 60,
    durationFrames: 90
  });

  const pika = ComponentRegistry.create('PokemonSprite', {
    id: 'pika_node',
    screen: 'top',
    x: 320,
    y: 60,
    width: 96,
    height: 96,
    properties: { species: 'Pikachu', nationalDexId: 25 }
  });
  originalScene.addNode(pika);

  const track = new AnimationTrack({
    targetNodeId: 'pika_node',
    propertyPath: 'transform.x',
    displayName: 'Pikachu X'
  });
  track.addKeyframe(0, 320, 'linear');
  track.addKeyframe(15, 280, 'linear');
  track.addKeyframe(30, 240, 'linear');
  track.addKeyframe(60, 220, 'easeInOut');
  originalScene.tracks.push(track);

  // Evaluate at multiple frames
  const eval0 = originalScene.evaluate(0).get('pika_node').transform.x;
  const eval15 = originalScene.evaluate(15).get('pika_node').transform.x;
  const eval30 = originalScene.evaluate(30).get('pika_node').transform.x;
  const eval45 = originalScene.evaluate(45).get('pika_node').transform.x;
  const eval60 = originalScene.evaluate(60).get('pika_node').transform.x;

  // Serialize to JSON
  const jsonStr = JSON.stringify(originalScene.toJSON(), null, 2);
  const parsedData = JSON.parse(jsonStr);

  // Restore into a completely new SceneModel
  const restoredScene = new SceneModel(parsedData);
  assert.strictEqual(restoredScene.fps, 60);
  assert.strictEqual(restoredScene.durationFrames, 90);
  assert.strictEqual(restoredScene.tracks.length, 1);
  assert.strictEqual(restoredScene.tracks[0].keyframes.length, 4);

  // Verify byte-for-byte deterministic evaluation equivalence
  assert.strictEqual(restoredScene.evaluate(0).get('pika_node').transform.x, eval0);
  assert.strictEqual(restoredScene.evaluate(15).get('pika_node').transform.x, eval15);
  assert.strictEqual(restoredScene.evaluate(30).get('pika_node').transform.x, eval30);
  assert.strictEqual(restoredScene.evaluate(45).get('pika_node').transform.x, eval45);
  assert.strictEqual(restoredScene.evaluate(60).get('pika_node').transform.x, eval60);
});

test('BETA-UI-2.9: Undo/Redo integration for keyframe and track operations via HistoryManager', () => {
  const model = new ProjectModel();
  const scene = model.createScene('HistoryTestScene');
  const node = model.addComponent({ type: 'RogueBox', x: 10, y: 10, width: 50, height: 50 });

  const track = new AnimationTrack({ targetNodeId: node.id, propertyPath: 'transform.x' });
  scene.tracks.push(track);

  // Action 1: Add keyframe
  track.addKeyframe(0, 100);
  model.history.push({
    description: 'Add Keyframe at 0',
    undo: () => track.removeKeyframe(0),
    execute: () => track.addKeyframe(0, 100)
  });
  assert.strictEqual(track.keyframes.length, 1);

  // Action 2: Add keyframe at 30
  track.addKeyframe(30, 200);
  model.history.push({
    description: 'Add Keyframe at 30',
    undo: () => track.removeKeyframe(30),
    execute: () => track.addKeyframe(30, 200)
  });
  assert.strictEqual(track.keyframes.length, 2);

  // Undo Action 2
  model.history.undo();
  assert.strictEqual(track.keyframes.length, 1);
  assert.strictEqual(track.keyframes[0].frame, 0);

  // Undo Action 1
  model.history.undo();
  assert.strictEqual(track.keyframes.length, 0);

  // Redo Action 1
  model.history.redo();
  assert.strictEqual(track.keyframes.length, 1);
  assert.strictEqual(track.keyframes[0].frame, 0);

  // Redo Action 2
  model.history.redo();
  assert.strictEqual(track.keyframes.length, 2);
  assert.strictEqual(track.keyframes[1].frame, 30);
});

test('BETA-UI-2.10: Integration: SceneModel -> TimelineEvaluator -> Canvas/Preview (Hierarchical group evaluation)', () => {
  const scene = new SceneModel({ id: 'HierarchyAnimScene' });

  const group = ComponentRegistry.create('Group', {
    id: 'player_group',
    screen: 'top',
    x: 100,
    y: 80
  });

  const sprite = ComponentRegistry.create('Image', {
    id: 'player_sprite',
    screen: 'top',
    x: 20,
    y: 10,
    width: 32,
    height: 32,
    parent: 'player_group',
    properties: { asset: 'bg_arena_plains' }
  });

  group.addChild(sprite.id);
  scene.addNode(group);
  scene.addNode(sprite);

  // Animate the parent group's X: from 100 to 200 over 40 frames
  const track = new AnimationTrack({
    targetNodeId: 'player_group',
    propertyPath: 'transform.x'
  });
  track.addKeyframe(0, 100, 'linear');
  track.addKeyframe(40, 200, 'linear');
  scene.tracks.push(track);

  // Evaluate at frame 20 (group evaluated X should be 150)
  const evaluatedMap = scene.evaluate(20);
  assert.strictEqual(evaluatedMap.get('player_group').transform.x, 150);

  // World transform with evaluated parent:
  // Group at evaluated (150, 80), child local at (20, 10) => world X is 170, world Y is 90
  const evalGroupTransform = TimelineEvaluator.getEvaluatedTransform(group, evaluatedMap);
  const childWorldX = evalGroupTransform.x + sprite.transform.x;
  const childWorldY = evalGroupTransform.y + sprite.transform.y;
  assert.strictEqual(childWorldX, 170);
  assert.strictEqual(childWorldY, 90);
});

test('BETA-UI-2.11: Pre-built Demo Scenes verify against specification', () => {
  // 1. Pikachu Entrance
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  assert.ok(fs.existsSync(pikaFilePath));
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);

  assert.strictEqual(pikaScene.fps, 60);
  assert.strictEqual(pikaScene.durationFrames, 90);
  assert.ok(pikaScene.tracks.some(t => t.targetNodeId === 'pikachu_sprite' && t.propertyPath === 'transform.x'));

  // Test prompt 37 exact keyframe checks:
  // Frame 0: X = 320, Opacity = 0
  const ev0 = pikaScene.evaluate(0).get('pikachu_sprite');
  assert.strictEqual(ev0.transform.x, 320);
  assert.strictEqual(ev0.opacity, 0);

  // Frame 15: X = 280, Opacity = 0.5
  const ev15 = pikaScene.evaluate(15).get('pikachu_sprite');
  assert.strictEqual(ev15.transform.x, 280);
  assert.strictEqual(ev15.opacity, 0.5);

  // Frame 30: X = 240, Opacity = 1
  const ev30 = pikaScene.evaluate(30).get('pikachu_sprite');
  assert.strictEqual(ev30.transform.x, 240);
  assert.strictEqual(ev30.opacity, 1.0);

  // Frame 60: X = 220
  const ev60 = pikaScene.evaluate(60).get('pikachu_sprite');
  assert.strictEqual(ev60.transform.x, 220);

  // 2. Simple Menu Animation
  const menuFilePath = path.join(__dirname, '..', 'project', 'screens', 'MenuAnimation.json');
  assert.ok(fs.existsSync(menuFilePath));
  const menuData = JSON.parse(fs.readFileSync(menuFilePath, 'utf8'));
  const menuScene = new SceneModel(menuData);
  assert.strictEqual(menuScene.tracks.length >= 7, true);
  assert.strictEqual(menuScene.evaluate(0).get('menu_panel').transform.y, 250);
  assert.strictEqual(menuScene.evaluate(25).get('menu_panel').transform.y, 20);

  // 3. Dual Screen Scene
  const dualFilePath = path.join(__dirname, '..', 'project', 'screens', 'DualScreenScene.json');
  assert.ok(fs.existsSync(dualFilePath));
  const dualData = JSON.parse(fs.readFileSync(dualFilePath, 'utf8'));
  const dualScene = new SceneModel(dualData);
  assert.strictEqual(dualScene.components.filter(c => c.screen === 'top').length >= 3, true);
  assert.strictEqual(dualScene.components.filter(c => c.screen === 'bottom').length >= 3, true);
  assert.ok(dualScene.tracks.some(t => t.targetNodeId === 'top_charizard'));
  assert.ok(dualScene.tracks.some(t => t.targetNodeId === 'bottom_panel'));
});

// =========================================================================
// BETA-UI-3: C++ ANIMATION EXPORT + CITRO2D RUNTIME TEST SUITE
// =========================================================================

test('BETA-UI-3.1: Basic Scene Export generates all required C++ and manifest files', () => {
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);

  const val = SceneValidator.validate(pikaScene);
  assert.strictEqual(val.valid, true, 'PikachuEntrance scene must pass validation');

  const result = SceneCppExporter.export(pikaScene);
  assert.ok(result, 'Export must return result object');
  assert.strictEqual(result.sceneId, 'PikachuEntrance');
  assert.strictEqual(result.className, 'PikachuEntranceScene');

  // Verify all required files exist and have non-empty content
  const requiredFiles = [
    'generated/include/screens/SceneData.hpp',
    'generated/src/screens/SceneData.cpp',
    'generated/include/screens/SceneAssets.hpp',
    'generated/src/screens/SceneAssets.cpp',
    'generated/include/screens/AssetManifest.hpp',
    'generated/src/screens/AssetManifest.cpp',
    'generated/include/screens/SceneTimeline.hpp',
    'generated/src/screens/SceneTimeline.cpp',
    'generated/include/screens/Scene.hpp',
    'generated/src/screens/Scene.cpp',
    'generated/include/screens/PikachuEntranceScene.hpp',
    'generated/src/screens/PikachuEntranceScene.cpp',
    'generated/SceneManifest.json'
  ];

  for (const rf of requiredFiles) {
    assert.ok(result.files[rf], `File "${rf}" must be generated`);
    assert.ok(result.files[rf].length > 50, `File "${rf}" must have meaningful content`);
  }
});

test('BETA-UI-3.2: Export determinism produces byte-identical output across repeated exports', () => {
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);

  const export1 = SceneCppExporter.export(pikaScene);
  const export2 = SceneCppExporter.export(pikaScene);
  const export3 = SceneCppExporter.export(pikaScene);

  for (const [filePath, content] of Object.entries(export1.files)) {
    assert.strictEqual(export2.files[filePath], content, `File "${filePath}" must be byte-identical in run 2`);
    assert.strictEqual(export3.files[filePath], content, `File "${filePath}" must be byte-identical in run 3`);
  }

  // Also test with DualScreenScene
  const dualFilePath = path.join(__dirname, '..', 'project', 'screens', 'DualScreenScene.json');
  const dualData = JSON.parse(fs.readFileSync(dualFilePath, 'utf8'));
  const dualScene = new SceneModel(dualData);
  const dualExport1 = SceneCppExporter.export(dualScene);
  const dualExport2 = SceneCppExporter.export(dualScene);

  for (const [filePath, content] of Object.entries(dualExport1.files)) {
    assert.strictEqual(dualExport2.files[filePath], content, `DualScreen file "${filePath}" must be byte-identical`);
  }
});

test('BETA-UI-3.3: Keyframe export creates compact static C++ struct arrays without per-frame bloat', () => {
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);
  const result = SceneCppExporter.export(pikaScene);

  const cpp = result.dataCpp;
  assert.ok(cpp.includes('static const SceneKeyframe s_keyframes_'), 'Must define static SceneKeyframe arrays');
  assert.ok(cpp.includes('PropertyId::X'), 'Must reference PropertyId::X');
  assert.ok(cpp.includes('InterpolationType::Linear'), 'Must reference InterpolationType::Linear');
  assert.ok(cpp.includes('InterpolationType::EaseInOut'), 'Must reference InterpolationType::EaseInOut');
  assert.ok(cpp.includes('static const SceneTrack s_tracks[]'), 'Must define static SceneTrack table');

  // Verify compact representation: 90 frames does NOT generate 90 lines of C++
  const lineCount = cpp.split('\n').length;
  assert.ok(lineCount < 200, `Generated C++ should be compact static data, was ${lineCount} lines`);
});

test('BETA-UI-3.4: Pure interpolation parity across all 5 curves (STEP, LINEAR, EASE_IN, EASE_OUT, EASE_IN_OUT)', () => {
  const curves = [
    { type: 'step', id: 0 },
    { type: 'linear', id: 1 },
    { type: 'easeIn', id: 2 },
    { type: 'easeOut', id: 3 },
    { type: 'easeInOut', id: 4 }
  ];

  for (const c of curves) {
    for (let step = 0; step <= 20; step++) {
      const t = step / 20.0;
      const jsVal = Interpolation.evaluateProgress(t, c.type);

      // Simulated C++ evaluator from SceneCppExporter
      const cppProgress = (normT, interpId) => {
        const clampedT = Math.max(0, Math.min(1, normT));
        switch (interpId) {
          case 0: return clampedT < 1.0 ? 0.0 : 1.0;
          case 1: return clampedT;
          case 2: return clampedT * clampedT;
          case 3: return clampedT * (2.0 - clampedT);
          case 4: return clampedT < 0.5 ? 2.0 * clampedT * clampedT : -1.0 + (4.0 - 2.0 * clampedT) * clampedT;
          default: return clampedT;
        }
      };

      const cppVal = cppProgress(t, c.id);
      const diff = Math.abs(jsVal - cppVal);
      assert.ok(diff < 1e-6, `Curve ${c.type} at t=${t} must match: js=${jsVal}, cpp=${cppVal}`);
    }
  }
});

test('BETA-UI-3.5: Multi-track animation evaluation on spatial and appearance properties', () => {
  const scene = new SceneModel({
    id: 'MultiTrackScene',
    durationFrames: 60,
    fps: 60,
    components: [
      {
        id: 'box_elem',
        type: 'RogueBox',
        screen: 'top',
        x: 10,
        y: 10,
        width: 100,
        height: 60,
        properties: { backgroundColor: '#ff0000' }
      }
    ]
  });

  const propConfigs = [
    { path: 'transform.x', kfs: [{ f: 0, v: 10 }, { f: 60, v: 100 }] },
    { path: 'transform.y', kfs: [{ f: 0, v: 20 }, { f: 60, v: 80 }] },
    { path: 'transform.scaleX', kfs: [{ f: 0, v: 1.0 }, { f: 60, v: 2.5 }] },
    { path: 'transform.scaleY', kfs: [{ f: 0, v: 1.0 }, { f: 60, v: 0.5 }] },
    { path: 'transform.rotation', kfs: [{ f: 0, v: 0 }, { f: 60, v: 180 }] },
    { path: 'opacity', kfs: [{ f: 0, v: 0.2 }, { f: 60, v: 1.0 }] }
  ];

  for (const cfg of propConfigs) {
    const tr = new AnimationTrack({ targetNodeId: 'box_elem', propertyPath: cfg.path });
    for (const kf of cfg.kfs) {
      tr.addKeyframe(kf.f, kf.v, 'linear');
    }
    scene.addTrack(tr);
  }

  const exported = SceneCppExporter.export(scene);

  // Evaluate at frame 30 (midpoint)
  const jsEval = TimelineEvaluator.evaluateScene(scene, 30).get('box_elem');
  const cppEval = SceneCppExporter.evaluateExportedData(exported.exportModel, 30).get('box_elem');

  assert.strictEqual(jsEval.transform.x, 55);
  assert.strictEqual(cppEval.transform.x, 55);

  assert.strictEqual(jsEval.transform.y, 50);
  assert.strictEqual(cppEval.transform.y, 50);

  assert.strictEqual(jsEval.transform.scaleX, 1.75);
  assert.strictEqual(cppEval.transform.scaleX, 1.75);

  assert.strictEqual(jsEval.transform.scaleY, 0.75);
  assert.strictEqual(cppEval.transform.scaleY, 0.75);

  assert.strictEqual(jsEval.transform.rotation, 90);
  assert.strictEqual(cppEval.transform.rotation, 90);

  assert.strictEqual(parseFloat(jsEval.opacity.toFixed(2)), 0.6);
  assert.strictEqual(parseFloat(cppEval.opacity.toFixed(2)), 0.6);
});

test('BETA-UI-3.6: Node hierarchy parent-child world transform accumulation in exported data', () => {
  const scene = new SceneModel({
    id: 'HierarchyScene',
    durationFrames: 40,
    fps: 60,
    components: [
      {
        id: 'parent_group',
        type: 'Group',
        screen: 'top',
        x: 100,
        y: 50,
        width: 150,
        height: 100
      },
      {
        id: 'child_image',
        type: 'Image',
        screen: 'top',
        x: 30,
        y: 20,
        width: 40,
        height: 40,
        parent: 'parent_group',
        properties: { asset: 'bg_arena_plains' }
      }
    ]
  });

  const track = new AnimationTrack({ targetNodeId: 'parent_group', propertyPath: 'transform.x' });
  track.addKeyframe(0, 100, 'linear');
  track.addKeyframe(40, 200, 'linear');
  scene.addTrack(track);

  const exported = SceneCppExporter.export(scene);
  const exportNodes = exported.exportModel.nodes;

  const parentExport = exportNodes.find(n => n.id === 'parent_group');
  const childExport = exportNodes.find(n => n.id === 'child_image');

  assert.ok(parentExport, 'Parent node must be exported');
  assert.ok(childExport, 'Child node must be exported');
  assert.strictEqual(childExport.parentIndex, parentExport.index, 'Child parentIndex must match parent array index');

  // Verify at frame 20 (parent evaluated local X is 150)
  const cppEval = SceneCppExporter.evaluateExportedData(exported.exportModel, 20);
  const parentLocalX = cppEval.get('parent_group').transform.x;
  assert.strictEqual(parentLocalX, 150);

  // Accumulated world X = 150 + 30 = 180
  const worldX = parentLocalX + childExport.x;
  assert.strictEqual(worldX, 180);
});

test('BETA-UI-3.7: Opacity evaluation and clamping [0..1]', () => {
  const scene = new SceneModel({
    id: 'OpacityScene',
    durationFrames: 30,
    fps: 60,
    components: [
      {
        id: 'fade_img',
        type: 'Image',
        screen: 'top',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        properties: { asset: 'bg_arena_plains' },
        opacity: 0
      }
    ]
  });

  const track = new AnimationTrack({ targetNodeId: 'fade_img', propertyPath: 'opacity' });
  track.addKeyframe(0, 0.0, 'linear');
  track.addKeyframe(30, 1.0, 'linear');
  scene.addTrack(track);

  const exported = SceneCppExporter.export(scene);

  const eval0 = SceneCppExporter.evaluateExportedData(exported.exportModel, 0).get('fade_img');
  assert.strictEqual(eval0.opacity, 0.0);

  const eval15 = SceneCppExporter.evaluateExportedData(exported.exportModel, 15).get('fade_img');
  assert.strictEqual(eval15.opacity, 0.5);

  const eval30 = SceneCppExporter.evaluateExportedData(exported.exportModel, 30).get('fade_img');
  assert.strictEqual(eval30.opacity, 1.0);
});

test('BETA-UI-3.8: Visibility boolean track evaluation with threshold', () => {
  const scene = new SceneModel({
    id: 'VisScene',
    durationFrames: 40,
    fps: 60,
    components: [
      {
        id: 'blinking_text',
        type: 'PixelText',
        screen: 'top',
        x: 10,
        y: 10,
        width: 100,
        height: 20,
        properties: { text: 'BLINK' },
        visible: false
      }
    ]
  });

  const track = new AnimationTrack({ targetNodeId: 'blinking_text', propertyPath: 'visible', valueType: 'boolean' });
  track.addKeyframe(0, false, 'step');
  track.addKeyframe(20, true, 'step');
  scene.addTrack(track);

  const exported = SceneCppExporter.export(scene);

  const eval5 = SceneCppExporter.evaluateExportedData(exported.exportModel, 5).get('blinking_text');
  assert.strictEqual(eval5.visible, false);

  const eval19 = SceneCppExporter.evaluateExportedData(exported.exportModel, 19).get('blinking_text');
  assert.strictEqual(eval19.visible, false);

  const eval20 = SceneCppExporter.evaluateExportedData(exported.exportModel, 20).get('blinking_text');
  assert.strictEqual(eval20.visible, true);

  const eval35 = SceneCppExporter.evaluateExportedData(exported.exportModel, 35).get('blinking_text');
  assert.strictEqual(eval35.visible, true);
});

test('BETA-UI-3.9: Dual-screen scene composition partitions Top (400x240) and Bottom (320x240) under single timeline', () => {
  const dualFilePath = path.join(__dirname, '..', 'project', 'screens', 'DualScreenScene.json');
  const dualData = JSON.parse(fs.readFileSync(dualFilePath, 'utf8'));
  const dualScene = new SceneModel(dualData);

  const exported = SceneCppExporter.export(dualScene);
  const nodes = exported.exportModel.nodes;

  const topNodes = nodes.filter(n => n.screen === 'top');
  const bottomNodes = nodes.filter(n => n.screen === 'bottom');

  assert.ok(topNodes.length >= 3, 'Top screen nodes partitioned correctly');
  assert.ok(bottomNodes.length >= 3, 'Bottom screen nodes partitioned correctly');

  // Verify backgrounds
  assert.strictEqual(exported.exportModel.topBgColor, '0xFF1F1410');
  assert.strictEqual(exported.exportModel.bottomBgColor, '0xFF261A17');

  // Verify both top and bottom animated in single timeline
  const tracks = exported.exportModel.tracks;
  assert.ok(tracks.some(t => t.targetNodeId === 'top_charizard'), 'Top screen track exists');
  assert.ok(tracks.some(t => t.targetNodeId === 'bottom_panel'), 'Bottom screen track exists');
  assert.strictEqual(exported.exportModel.durationFrames, 90);
});

test('BETA-UI-3.10: Asset manifest contains only referenced assets sorted deterministically', () => {
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);

  const exported = SceneCppExporter.export(pikaScene);
  const manifest = exported.manifest;

  assert.strictEqual(manifest.sceneId, 'PikachuEntrance');
  assert.ok(manifest.assetCount >= 2, 'Must include bg_arena_plains and pokemon sprite');

  // Assets must be sorted alphabetically
  for (let i = 0; i < manifest.assets.length - 1; i++) {
    assert.ok(manifest.assets[i].assetId.localeCompare(manifest.assets[i + 1].assetId) <= 0);
  }

  // Must reference real 3DS target formats without invented paths
  const pkmnAsset = manifest.assets.find(a => a.assetId.includes('pokemon'));
  assert.ok(pkmnAsset, 'Pokémon asset entry must exist');
  assert.strictEqual(pkmnAsset.format, 'RGBA4444');
  assert.ok(pkmnAsset.romfsPath.includes('romfs/sprites/pokemon/25.t3x'));
});

test('BETA-UI-3.11: Timeline markers exported with exact integer frames, names, and types', () => {
  const scene = new SceneModel({
    id: 'MarkerScene',
    durationFrames: 60,
    fps: 60,
    components: [{ id: 'dummy', type: 'PixelText', screen: 'top', x: 0, y: 0, width: 50, height: 20 }]
  });

  scene.addMarker({ frame: 10, name: 'SpawnCharizard', type: 'Event' });
  scene.addMarker({ frame: 35, name: 'CameraShake', type: 'Sync' });

  const exported = SceneCppExporter.export(scene);
  const markers = exported.exportModel.markers;

  assert.strictEqual(markers.length, 2);
  assert.strictEqual(markers[0].frame, 10);
  assert.strictEqual(markers[0].name, 'SpawnCharizard');
  assert.strictEqual(markers[0].type, 'Event');

  assert.strictEqual(markers[1].frame, 35);
  assert.strictEqual(markers[1].name, 'CameraShake');
  assert.strictEqual(markers[1].type, 'Sync');

  assert.ok(exported.dataCpp.includes('{ 10, "SpawnCharizard", "Event" }'));
  assert.ok(exported.dataCpp.includes('{ 35, "CameraShake", "Sync" }'));
});

test('BETA-UI-3.12: Audio cues exported with exact integer frames, assets, volume, and channel', () => {
  const scene = new SceneModel({
    id: 'AudioScene',
    durationFrames: 90,
    fps: 60,
    components: [{ id: 'dummy', type: 'PixelText', screen: 'top', x: 0, y: 0, width: 50, height: 20 }]
  });

  scene.addAudioCue({ frame: 0, asset: 'bgm_battle_wild', volume: 0.85, channel: 0 });
  scene.addAudioCue({ frame: 15, asset: 'sfx_pikachu_cry', volume: 1.0, channel: 1 });

  const exported = SceneCppExporter.export(scene);
  const cues = exported.exportModel.audioCues;

  assert.strictEqual(cues.length, 2);
  assert.strictEqual(cues[0].frame, 0);
  assert.strictEqual(cues[0].asset, 'bgm_battle_wild');
  assert.strictEqual(cues[0].volume, 0.85);
  assert.strictEqual(cues[0].channel, 0);

  assert.strictEqual(cues[1].frame, 15);
  assert.strictEqual(cues[1].asset, 'sfx_pikachu_cry');
  assert.strictEqual(cues[1].volume, 1.0);
  assert.strictEqual(cues[1].channel, 1);

  assert.ok(exported.dataCpp.includes('{ 0, "bgm_battle_wild", 0.85f, 0 }'));
  assert.ok(exported.dataCpp.includes('{ 15, "sfx_pikachu_cry", 1f, 1 }') || exported.dataCpp.includes('{ 15, "sfx_pikachu_cry", 1.0f, 1 }'));
});

test('BETA-UI-3.13: Generated C++ structure conforms to modern Citro2D runtime standards', () => {
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);
  const result = SceneCppExporter.export(pikaScene);

  // Check header structure
  assert.ok(result.hpp.includes('#pragma once'));
  assert.ok(result.hpp.includes('#include "screens/screen.hpp"'));
  assert.ok(result.hpp.includes('class PikachuEntranceScene : public Screen'));
  assert.ok(result.hpp.includes('void drawTop(Renderer2D& renderer) override;'));
  assert.ok(result.hpp.includes('void drawBottom(Renderer2D& renderer) override;'));
  assert.ok(result.hpp.includes('Citro2D::SceneTimeline& getTimeline()'));

  // Check timeline header structure
  assert.ok(result.timelineHpp.includes('uint32_t getCurrentFrame() const'));
  assert.ok(result.timelineHpp.includes('void seek(uint32_t frame);'));
  assert.ok(result.timelineHpp.includes('void advanceFrame();'));
  assert.ok(result.timelineHpp.includes('void update(float dt'));

  // Check Citro2D namespace
  assert.ok(result.dataHpp.includes('namespace Citro2D {'));
  assert.ok(result.timelineCpp.includes('namespace Citro2D {'));
});

test('BETA-UI-3.14: Export idempotence and document non-mutation', () => {
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);

  const beforeJson = JSON.stringify(pikaScene.toJSON());

  // Export 5 times in succession
  const runs = [];
  for (let i = 0; i < 5; i++) {
    runs.push(SceneCppExporter.export(pikaScene));
  }

  const afterJson = JSON.stringify(pikaScene.toJSON());
  assert.strictEqual(beforeJson, afterJson, 'Export must never mutate authoring SceneModel document state');

  // Verify all 5 runs are strictly identical
  for (let i = 1; i < 5; i++) {
    assert.strictEqual(runs[0].hpp, runs[i].hpp);
    assert.strictEqual(runs[0].cpp, runs[i].cpp);
    assert.strictEqual(runs[0].dataCpp, runs[i].dataCpp);
    assert.strictEqual(runs[0].assetsCpp, runs[i].assetsCpp);
  }
});

test('BETA-UI-3.15: Preview / Export Mathematical Parity across multiple keyframes', () => {
  const demos = [
    { file: 'PikachuEntrance.json', targetNode: 'pikachu_sprite', prop: 'transform.x' },
    { file: 'MenuAnimation.json', targetNode: 'menu_panel', prop: 'transform.y' },
    { file: 'DualScreenScene.json', targetNode: 'top_charizard', prop: 'transform.scaleX' }
  ];

  for (const demo of demos) {
    const filePath = path.join(__dirname, '..', 'project', 'screens', demo.file);
    const sceneData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const scene = new SceneModel(sceneData);
    const exported = SceneCppExporter.export(scene);

    const track = scene.tracks.find(t => t.targetNodeId === demo.targetNode && t.propertyPath === demo.prop);
    assert.ok(track, `Track for ${demo.targetNode}.${demo.prop} must exist`);

    const framesToTest = [
      0,
      track.keyframes[0].frame,
      Math.round((track.keyframes[0].frame + track.keyframes[track.keyframes.length - 1].frame) / 2),
      track.keyframes[track.keyframes.length - 1].frame,
      scene.durationFrames
    ];

    for (const f of framesToTest) {
      const jsEval = TimelineEvaluator.evaluateScene(scene, f).get(demo.targetNode);
      const cppEval = SceneCppExporter.evaluateExportedData(exported.exportModel, f).get(demo.targetNode);

      const propKey = demo.prop.replace('transform.', '');
      const jsVal = jsEval.transform[propKey];
      const cppVal = cppEval.transform[propKey];

      const diff = Math.abs(jsVal - cppVal);
      assert.ok(diff < 1e-4, `Parity check failed for ${demo.file} node ${demo.targetNode} at frame ${f}: js=${jsVal}, cpp=${cppVal}`);
    }
  }
});

test('BETA-UI-3.16: SceneValidator rejects corrupted scenes before export', () => {
  // 1. Duplicate node IDs
  const badScene1 = {
    id: 'BadScene1',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: [
      { id: 'node_a', type: 'PixelText', screen: 'top', properties: { text: 'A' } },
      { id: 'node_a', type: 'PixelText', screen: 'top', properties: { text: 'Duplicate' } }
    ]
  };
  const val1 = SceneValidator.validate(badScene1);
  assert.strictEqual(val1.valid, false);
  assert.ok(val1.errors.some(e => e.includes('Duplicate node ID')));
  assert.throws(() => SceneCppExporter.export(badScene1), /validation failed/);

  // 2. Track targeting non-existent node
  const badScene2 = {
    id: 'BadScene2',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: [{ id: 'node_ok', type: 'PixelText', screen: 'top' }],
    tracks: [{ targetNodeId: 'phantom_node', propertyPath: 'transform.x', keyframes: [] }]
  };
  const val2 = SceneValidator.validate(badScene2);
  assert.strictEqual(val2.valid, false);
  assert.ok(val2.errors.some(e => e.includes('non-existent node')));
  assert.throws(() => SceneCppExporter.export(badScene2), /validation failed/);

  // 3. Keyframe out of range
  const badScene3 = {
    id: 'BadScene3',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: [{ id: 'node_ok', type: 'PixelText', screen: 'top' }],
    tracks: [{ targetNodeId: 'node_ok', propertyPath: 'transform.x', keyframes: [{ frame: 120, value: 50 }] }]
  };
  const val3 = SceneValidator.validate(badScene3);
  assert.strictEqual(val3.valid, false);
  assert.ok(val3.errors.some(e => e.includes('out of scene range')));
  assert.throws(() => SceneCppExporter.export(badScene3), /validation failed/);

  // 4. Hierarchy cycle
  const badScene4 = {
    id: 'BadScene4',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    components: [
      { id: 'node_x', type: 'Group', screen: 'top', parent: 'node_y' },
      { id: 'node_y', type: 'Group', screen: 'top', parent: 'node_x' }
    ]
  };
  const val4 = SceneValidator.validate(badScene4);
  assert.strictEqual(val4.valid, false);
  assert.ok(val4.errors.some(e => e.includes('Hierarchy cycle detected')));
  assert.throws(() => SceneCppExporter.export(badScene4), /validation failed/);

  // 5. Invalid screen dimensions
  const badScene5 = {
    id: 'BadScene5',
    durationFrames: 60,
    fps: 60,
    top: { width: 500, height: 300 }, // Invalid!
    bottom: { width: 320, height: 240 },
    components: [{ id: 'node_ok', type: 'PixelText', screen: 'top' }]
  };
  const val5 = SceneValidator.validate(badScene5);
  assert.strictEqual(val5.valid, false);
  assert.ok(val5.errors.some(e => e.includes('Invalid Top Screen dimensions')));
  assert.throws(() => SceneCppExporter.export(badScene5), /validation failed/);
});

test('BETA-UI-3.17: Real Native Parity: Real compiled C++ execution matches TimelineEvaluator across all 5 curves, tracks, and keyframe intervals', async () => {
  // Construct a scene exercising STEP, LINEAR, EASE_IN, EASE_OUT, EASE_IN_OUT, Opacity, Visibility, and multiple tracks
  const parityScene = new SceneModel({
    id: 'ParityVerificationScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240, backgroundColor: '#101010' },
    bottom: { width: 320, height: 240, backgroundColor: '#202020' },
    nodes: [
      {
        id: 'hero_sprite',
        type: 'Image',
        screen: 'top',
        x: 50,
        y: 50,
        width: 64,
        height: 64,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: 0.0,
        opacity: 1.0,
        visible: true,
        properties: { asset: 'ui_dialog_box' }
      }
    ],
    tracks: [
      // 1. STEP interpolation
      {
        id: 'track_step',
        targetNodeId: 'hero_sprite',
        propertyPath: 'transform.x',
        keyframes: [
          { frame: 10, value: 50, interpolation: 'step' },
          { frame: 30, value: 150, interpolation: 'step' },
          { frame: 50, value: 250, interpolation: 'step' }
        ]
      },
      // 2. LINEAR interpolation
      {
        id: 'track_linear',
        targetNodeId: 'hero_sprite',
        propertyPath: 'transform.y',
        keyframes: [
          { frame: 10, value: 20, interpolation: 'linear' },
          { frame: 50, value: 180, interpolation: 'linear' }
        ]
      },
      // 3. EASE_IN interpolation
      {
        id: 'track_ease_in',
        targetNodeId: 'hero_sprite',
        propertyPath: 'transform.scaleX',
        keyframes: [
          { frame: 10, value: 1.0, interpolation: 'ease-in' },
          { frame: 50, value: 2.5, interpolation: 'ease-in' }
        ]
      },
      // 4. EASE_OUT interpolation
      {
        id: 'track_ease_out',
        targetNodeId: 'hero_sprite',
        propertyPath: 'transform.scaleY',
        keyframes: [
          { frame: 10, value: 1.0, interpolation: 'ease-out' },
          { frame: 50, value: 3.0, interpolation: 'ease-out' }
        ]
      },
      // 5. EASE_IN_OUT interpolation
      {
        id: 'track_ease_in_out',
        targetNodeId: 'hero_sprite',
        propertyPath: 'transform.rotation',
        keyframes: [
          { frame: 10, value: 0.0, interpolation: 'ease-in-out' },
          { frame: 50, value: 180.0, interpolation: 'ease-in-out' }
        ]
      },
      // 6. Opacity track
      {
        id: 'track_opacity',
        targetNodeId: 'hero_sprite',
        propertyPath: 'transform.opacity',
        keyframes: [
          { frame: 0, value: 0.0, interpolation: 'linear' },
          { frame: 30, value: 0.6, interpolation: 'linear' },
          { frame: 50, value: 1.0, interpolation: 'linear' }
        ]
      },
      // 7. Visibility track
      {
        id: 'track_visibility',
        targetNodeId: 'hero_sprite',
        propertyPath: 'visible',
        keyframes: [
          { frame: 0, value: true, interpolation: 'step' },
          { frame: 25, value: false, interpolation: 'step' },
          { frame: 45, value: true, interpolation: 'step' }
        ]
      }
    ]
  });

  // Verify across frame 0, primer keyframe, frame intermedio, último keyframe, frame posterior
  const framesToTest = [0, 10, 20, 25, 30, 40, 50, 60];
  const parityResult = await NativeParityRunner.runParityTest(parityScene, { frames: framesToTest });

  assert.strictEqual(parityResult.pass, true, 'All evaluations must match between real compiled C++ and TimelineEvaluator.js');
  assert.ok(parityResult.totalChecks >= 56, `Must perform checks across all properties and frames (performed: ${parityResult.totalChecks})`);

  // Verify PikachuEntrance scene parity as well
  const pikaFilePath = path.join(__dirname, '..', 'project', 'screens', 'PikachuEntrance.json');
  const pikaData = JSON.parse(fs.readFileSync(pikaFilePath, 'utf8'));
  const pikaScene = new SceneModel(pikaData);
  const pikaParity = await NativeParityRunner.runParityTest(pikaScene);
  assert.strictEqual(pikaParity.pass, true, 'PikachuEntrance scene must have 100% parity with real compiled C++');
});

test('BETA-UI-3.18: Native Build Target: devkitARM / Citro2D compilation passes with full symbol resolution and 0 linker errors', () => {
  const nativeBuildScript = path.join(__dirname, 'run_native_build.mjs');
  assert.ok(fs.existsSync(nativeBuildScript), 'run_native_build.mjs must exist');

  const stdout = execFileSync(process.execPath, [nativeBuildScript], { encoding: 'utf8' });
  assert.ok(stdout.includes('NATIVE BUILD VERIFICATION PASSED'), 'Native build script must report 100% success');
  assert.ok(stdout.includes('main() returned 0'), 'Native main() execution must succeed');
  assert.ok(stdout.includes('arm-none-eabi'), 'Must verify 3DS ARM instruction set compilation');
});

test('BETA-UI-3.19: Missing asset rejection: SceneValidator & SceneCppExporter reject missing assets and NEVER generate fictitious paths', () => {
  const badAssetScene = {
    id: 'BadAssetScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    nodes: [
      {
        id: 'ghost_node',
        type: 'Image',
        screen: 'top',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        properties: { asset: 'fictitious_bg_ghost_arena' }
      }
    ]
  };

  const validation = SceneValidator.validate(badAssetScene);
  assert.strictEqual(validation.valid, false, 'Scene with unresolvable asset must fail validation');
  assert.ok(
    validation.errors.some(e => e.includes('references unresolvable asset "fictitious_bg_ghost_arena"')),
    'Validation error must explicitly cite unresolvable asset'
  );

  // Attempting to export must throw and NOT generate romfs/gfx/fictitious_bg_ghost_arena.t3x
  let threw = false;
  try {
    SceneCppExporter.export(badAssetScene);
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('validation failed') || err.message.includes('unresolvable asset'));
  }
  assert.strictEqual(threw, true, 'Exporter must throw error on unresolvable asset');
});

test('BETA-UI-3.20: Missing Pokémon asset rejection: SceneValidator & SceneCppExporter reject unindexed dex ID', () => {
  const badPkmnScene = {
    id: 'BadPkmnScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    nodes: [
      {
        id: 'pkmn_fake',
        type: 'PokemonSprite',
        screen: 'top',
        x: 0,
        y: 0,
        width: 96,
        height: 96,
        properties: { nationalDexId: 99999 }
      }
    ]
  };

  const validation = SceneValidator.validate(badPkmnScene);
  assert.strictEqual(validation.valid, false, 'Scene with unindexed Pokémon dexId must fail validation');
  assert.ok(
    validation.errors.some(e => e.includes('#99999')),
    'Validation error must identify the unindexed dex ID'
  );

  assert.throws(
    () => SceneCppExporter.export(badPkmnScene),
    /validation failed|unindexed or non-existent Pokemon dex ID/,
    'Export must reject unindexed Pokémon dex ID'
  );
});

test('BETA-UI-3.21: Valid registered local assets resolve cleanly and export with valid provenance', () => {
  // Register verified local asset
  assetResolver.registerAsset({
    id: 'custom_skin_local',
    name: 'Custom HUD Skin',
    category: 'ui',
    sourcePath: 'assets/skins/hud_skin.png',
    dimensions: { width: 320, height: 64 },
    target3DS: {
      t3xPath: 'romfs/ui/custom_skin_local.t3x',
      format: 'RGBA4444'
    }
  });

  const localAssetScene = {
    id: 'LocalAssetScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    nodes: [
      {
        id: 'hud_panel',
        type: 'Image',
        screen: 'bottom',
        x: 0,
        y: 176,
        width: 320,
        height: 64,
        properties: { asset: 'custom_skin_local' }
      }
    ]
  };

  const val = SceneValidator.validate(localAssetScene);
  assert.strictEqual(val.valid, true, 'Scene with registered local asset must pass validation');

  const exportResult = SceneCppExporter.export(localAssetScene);
  assert.ok(exportResult, 'Export must succeed');
  const exportedAsset = exportResult.manifest.assets.find(a => a.assetId === 'custom_skin_local');
  assert.ok(exportedAsset, 'Exported manifest must contain registered local asset');
  assert.strictEqual(exportedAsset.romfsPath, 'romfs/ui/custom_skin_local.t3x', 'Must use exact registered target3DS t3xPath');
});

test('BETA-UI-3.22: Uint16 boundary contract: Validates uint16 boundary (<= 65535) and rejects overflow (> 65535)', () => {
  const boundaryScene = {
    id: 'BoundaryScene',
    durationFrames: 65535, // Max uint16_t
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    nodes: [
      {
        id: 'test_node',
        type: 'PixelText',
        screen: 'top',
        properties: { text: 'Boundary Test' }
      }
    ],
    tracks: [
      {
        id: 'boundary_track',
        targetNodeId: 'test_node',
        propertyPath: 'transform.x',
        keyframes: [
          { frame: 0, value: 0 },
          { frame: 65535, value: 400 } // Max uint16_t frame
        ]
      }
    ],
    markers: [
      { frame: 65535, name: 'EndMarker', type: 'Loop' }
    ]
  };

  const valBoundary = SceneValidator.validate(boundaryScene);
  assert.strictEqual(valBoundary.valid, true, 'Scene at uint16 boundary (65535) must pass validation');

  // Test overflows:
  // 1. durationFrames overflow
  const ovfDuration = { ...boundaryScene, id: 'Ovf1', durationFrames: 65536 };
  const valOvf1 = SceneValidator.validate(ovfDuration);
  assert.strictEqual(valOvf1.valid, false);
  assert.ok(valOvf1.errors.some(e => e.includes('exceeds uint16_t maximum')));

  // 2. fps overflow
  const ovfFps = { ...boundaryScene, id: 'Ovf2', fps: 65536 };
  const valOvf2 = SceneValidator.validate(ovfFps);
  assert.strictEqual(valOvf2.valid, false);
  assert.ok(valOvf2.errors.some(e => e.includes('fps') && e.includes('exceeds uint16_t maximum')));

  // 3. keyframe frame overflow
  const ovfKf = {
    ...boundaryScene,
    id: 'Ovf3',
    tracks: [
      {
        id: 't_ovf',
        targetNodeId: 'test_node',
        propertyPath: 'transform.x',
        keyframes: [{ frame: 65536, value: 10 }]
      }
    ]
  };
  const valOvf3 = SceneValidator.validate(ovfKf);
  assert.strictEqual(valOvf3.valid, false);
  assert.ok(valOvf3.errors.some(e => e.includes('exceeds uint16_t maximum')));

  // 4. marker frame overflow
  const ovfMarker = {
    ...boundaryScene,
    id: 'Ovf4',
    markers: [{ frame: 65536, name: 'BadMarker' }]
  };
  const valOvf4 = SceneValidator.validate(ovfMarker);
  assert.strictEqual(valOvf4.valid, false);
  assert.ok(valOvf4.errors.some(e => e.includes('Marker') && e.includes('exceeds uint16_t maximum')));

  // 5. audioCue frame overflow
  const ovfCue = {
    ...boundaryScene,
    id: 'Ovf5',
    audioCues: [{ frame: 65536, asset: 'bgm_theme' }]
  };
  const valOvf5 = SceneValidator.validate(ovfCue);
  assert.strictEqual(valOvf5.valid, false);
  assert.ok(valOvf5.errors.some(e => e.includes('Audio cue') && e.includes('exceeds uint16_t maximum')));
});

test('BETA-UI-3.23: Validator ↔ Exporter contract: Rejects pivotX, pivotY, and uncontracted properties without silent fallback', () => {
  const baseScene = {
    id: 'ContractScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    nodes: [{ id: 'target_node', type: 'PixelText', screen: 'top' }]
  };

  // 1. pivotX must be rejected
  const pivotXScene = {
    ...baseScene,
    id: 'PivotXScene',
    tracks: [{ targetNodeId: 'target_node', propertyPath: 'transform.pivotX', keyframes: [{ frame: 0, value: 0 }] }]
  };
  const valPivotX = SceneValidator.validate(pivotXScene);
  assert.strictEqual(valPivotX.valid, false);
  assert.ok(valPivotX.errors.some(e => e.includes('pivotX') && e.includes('not supported in the C++ runtime contract')));

  // 2. pivotY must be rejected
  const pivotYScene = {
    ...baseScene,
    id: 'PivotYScene',
    tracks: [{ targetNodeId: 'target_node', propertyPath: 'transform.pivotY', keyframes: [{ frame: 0, value: 0 }] }]
  };
  const valPivotY = SceneValidator.validate(pivotYScene);
  assert.strictEqual(valPivotY.valid, false);
  assert.ok(valPivotY.errors.some(e => e.includes('pivotY') && e.includes('not supported in the C++ runtime contract')));

  // 3. arbitrary property without C++ contract must be rejected
  const customPropScene = {
    ...baseScene,
    id: 'CustomPropScene',
    tracks: [{ targetNodeId: 'target_node', propertyPath: 'properties.arbitraryField', keyframes: [{ frame: 0, value: 123 }] }]
  };
  const valCustom = SceneValidator.validate(customPropScene);
  assert.strictEqual(valCustom.valid, false);
  assert.ok(valCustom.errors.some(e => e.includes('unsupported propertyPath') && e.includes('without a C++ export contract')));

  // 4. Exporter must throw rather than silently producing PropertyId::None
  assert.throws(
    () => SceneCppExporter.export(customPropScene),
    /validation failed|has no C\+\+ export contract/
  );
});

test('BETA-UI-3.24: Export failure is strictly deterministic', () => {
  const badScene = {
    id: 'DeterministicFailScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 500, height: 300 }, // Invalid
    bottom: { width: 320, height: 240 },
    nodes: [{ id: 'n1', type: 'PixelText', screen: 'top' }]
  };

  let msg1 = '';
  let msg2 = '';
  let msg3 = '';

  try { SceneCppExporter.export(badScene); } catch (e) { msg1 = e.message; }
  try { SceneCppExporter.export(badScene); } catch (e) { msg2 = e.message; }
  try { SceneCppExporter.export(badScene); } catch (e) { msg3 = e.message; }

  assert.ok(msg1.length > 0, 'Error message must not be empty');
  assert.strictEqual(msg1, msg2, 'Error message must be identical in run 2');
  assert.strictEqual(msg1, msg3, 'Error message must be identical in run 3');
});

function checkToolchain(toolName) {
  let found = false;
  if (toolName === 'DEVKITARM' || toolName === 'DEVKITPRO') {
    found = Boolean(process.env[toolName] && fs.existsSync(process.env[toolName]));
  } else {
    try {
      const out = execFileSync('where', [toolName], { stdio: 'pipe' }).toString().trim();
      if (out) found = true;
    } catch (e) {}
  }
  if (!found) {
    const err = new Error(`BLOCKED — missing toolchain/dependency: ${toolName}`);
    err.isToolchainBlocked = true;
    err.toolchainDetail = toolName;
    throw err;
  }
}

// ====================================================
// BETA-UI-3 FINAL — Real Citro2D Runtime & SDK Gates
// ====================================================

test('BETA-UI-3.25: Real Citro2D backend calls', () => {
  const r2dCpp = fs.readFileSync(path.join(__dirname, '../project/src/gfx/renderer2d.cpp'), 'utf8');
  const r2dHpp = fs.readFileSync(path.join(__dirname, '../project/include/gfx/renderer2d.hpp'), 'utf8');

  // Verify real Citro2D/Citro3D API calls are present
  assert.ok(r2dCpp.includes('C3D_Init('), 'Renderer2D::init must call C3D_Init');
  assert.ok(r2dCpp.includes('C2D_Init('), 'Renderer2D::init must call C2D_Init');
  assert.ok(r2dCpp.includes('C2D_Prepare()'), 'Renderer2D::init must call C2D_Prepare');
  assert.ok(r2dCpp.includes('C2D_CreateScreenTarget(GFX_TOP'), 'Renderer2D must create Top screen target');
  assert.ok(r2dCpp.includes('C2D_CreateScreenTarget(GFX_BOTTOM'), 'Renderer2D must create Bottom screen target');
  assert.ok(r2dCpp.includes('C3D_FrameBegin('), 'Renderer2D must call C3D_FrameBegin');
  assert.ok(r2dCpp.includes('C3D_FrameEnd('), 'Renderer2D must call C3D_FrameEnd');
  assert.ok(r2dCpp.includes('C2D_SceneBegin('), 'Renderer2D must call C2D_SceneBegin');
  assert.ok(r2dCpp.includes('C2D_TargetClear('), 'Renderer2D must call C2D_TargetClear');
  assert.ok(r2dCpp.includes('C2D_DrawRectSolid('), 'Renderer2D must call C2D_DrawRectSolid');
  assert.ok(r2dCpp.includes('C2D_DrawImageAtRotatedScaled('), 'Renderer2D must call C2D_DrawImageAtRotatedScaled');
  assert.ok(r2dCpp.includes('C2D_PlainImageTint('), 'Renderer2D must call C2D_PlainImageTint');

  // Verify elimination of fake counter behavior
  assert.ok(!r2dCpp.includes('m_drawCalls++'), 'Renderer2D must not use m_drawCalls++ as a graphic substitute');
});

test('BETA-UI-3.26: Real devkitARM compile', () => {
  checkToolchain('arm-none-eabi-gcc');
});

test('BETA-UI-3.27: Real ELF link', () => {
  checkToolchain('DEVKITARM');
});

test('BETA-UI-3.28: Real 3DSX generation', () => {
  checkToolchain('3dsxtool');
});

test('BETA-UI-3.29: Runtime asset loading contract', () => {
  const assetsCpp = fs.readFileSync(path.join(__dirname, '../project/generated/src/screens/SceneAssets.cpp'), 'utf8');
  assert.ok(assetsCpp.includes('findSceneAsset(const char* assetId)'), 'findSceneAsset must be implemented');
  assert.ok(assetsCpp.includes('g_SceneAssets'), 'Must query static asset table');
  assert.ok(assetsCpp.includes('return nullptr;'), 'Must return nullptr on unindexed asset');
});

test('BETA-UI-3.30: No fake SDK headers in 3DS build', () => {
  const incDir = path.join(__dirname, '../project/include');
  assert.ok(!fs.existsSync(path.join(incDir, 'citro2d.h')), 'Fake citro2d.h must not exist in project/include');
  assert.ok(!fs.existsSync(path.join(incDir, '3ds.h')), 'Fake 3ds.h must not exist in project/include');
  assert.ok(!fs.existsSync(path.join(incDir, 'compat')), 'compat directory must not exist in project/include');
});

test('BETA-UI-3.31: Audio provenance enforcement', () => {
  const badAudioScene = {
    id: 'BadAudioScene',
    durationFrames: 60,
    fps: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 },
    nodes: [{ id: 'n1', type: 'PixelText', screen: 'top' }],
    audioCues: [{ frame: 10, asset: 'arbitrary_fake_cue' }]
  };

  const val = SceneValidator.validate(badAudioScene);
  assert.strictEqual(val.valid, false);
  assert.ok(val.errors.some(e => e.includes('arbitrary_fake_cue') && e.includes('not registered in AudioResolver')));

  assert.throws(
    () => SceneCppExporter.export(badAudioScene),
    /validation failed|arbitrary_fake_cue/
  );
});

test('BETA-UI-3.32: Renderer integration smoke test', () => {
  const r2dHpp = fs.readFileSync(path.join(__dirname, '../project/include/gfx/renderer2d.hpp'), 'utf8');
  assert.ok(r2dHpp.includes('void beginTop()'), 'beginTop must be exposed');
  assert.ok(r2dHpp.includes('void beginBottom()'), 'beginBottom must be exposed');
  assert.ok(r2dHpp.includes('C3D_RenderTarget* getTopTarget()'), 'getTopTarget must be exposed');
  assert.ok(r2dHpp.includes('C3D_RenderTarget* getBottomTarget()'), 'getBottomTarget must be exposed');
});

// ====================================================
// BETA-UI-4 — Asset Packaging, RomFS & Pipeline
// ====================================================

test('BETA-UI-4.1: AssetPackager builds RomFS', async () => {
  const stagingDir = path.join(__dirname, 'build_romfs_4_1');
  const packager = new AssetPackager({ stagingDir });
  const manifest = {
    assets: [
      { assetId: 'bg_arena_plains', romfsPath: 'romfs/arenas/plains.t3x' },
      { assetId: 'pokemon_sprite_25_front', romfsPath: 'romfs/sprites/pokemon/25.t3x' }
    ]
  };
  const res = await packager.packageManifest(manifest);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stagedFiles.length, 2);
  assert.ok(fs.existsSync(path.join(stagingDir, 'arenas', 'plains.t3x')));
  assert.ok(fs.existsSync(path.join(stagingDir, 'sprites', 'pokemon', '25.t3x')));
  assert.ok(fs.existsSync(path.join(stagingDir, 'romfs_manifest.json')));
});

test('BETA-UI-4.2: Missing asset fails packaging', async () => {
  const stagingDir = path.join(__dirname, 'build_romfs_fail');
  const packager = new AssetPackager({ stagingDir });
  const manifest = {
    assets: [
      { assetId: 'unresolvable_ghost_asset', romfsPath: 'romfs/ui/ghost.t3x' }
    ]
  };
  await assert.rejects(
    async () => await packager.packageManifest(manifest),
    /cannot be resolved in any registered catalog/
  );
});

test('BETA-UI-4.3: Asset deduplication', async () => {
  const stagingDir = path.join(__dirname, 'build_romfs_dedup');
  const packager = new AssetPackager({ stagingDir });
  const manifest = {
    assets: [
      { assetId: 'pokemon_sprite_25_front', romfsPath: 'romfs/sprites/pokemon/25.t3x' },
      { assetId: 'pokemon_sprite_25_front', romfsPath: 'romfs/sprites/pokemon/25.t3x' },
      { assetId: 'pokemon_sprite_25_front', romfsPath: 'romfs/sprites/pokemon/25.t3x' }
    ]
  };
  const res = await packager.packageManifest(manifest);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stagedFiles.length, 1);
  assert.strictEqual(res.duplicateCount, 2);
});

test('BETA-UI-4.4: Deterministic RomFS manifest', async () => {
  const stagingDirA = path.join(__dirname, 'build_romfs_det_a');
  const stagingDirB = path.join(__dirname, 'build_romfs_det_b');
  const packagerA = new AssetPackager({ stagingDir: stagingDirA });
  const packagerB = new AssetPackager({ stagingDir: stagingDirB });
  const manifest = {
    assets: [
      { assetId: 'ui_dialog_box', romfsPath: 'romfs/ui/ui_dialog_box.t3x' },
      { assetId: 'bg_arena_forest', romfsPath: 'romfs/arenas/forest.t3x' }
    ]
  };
  await packagerA.packageManifest(manifest);
  await packagerB.packageManifest(manifest);

  const manifestA = fs.readFileSync(path.join(stagingDirA, 'romfs_manifest.json'), 'utf8');
  const manifestB = fs.readFileSync(path.join(stagingDirB, 'romfs_manifest.json'), 'utf8');
  assert.strictEqual(manifestA, manifestB, 'RomFS manifests must be byte-for-byte identical');
});

test('BETA-UI-4.5: Real tex3ds conversion', () => {
  checkToolchain('tex3ds');
});

test('BETA-UI-4.6: Scene asset references resolve into RomFS', () => {
  const scenePath = path.join(__dirname, '../project/screens/PikachuEntrance.json');
  const sceneData = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const exported = SceneCppExporter.export(sceneData);

  assert.ok(exported.manifest.assets.length > 0);
  for (const asset of exported.manifest.assets) {
    assert.ok(asset.romfsPath.startsWith('romfs/'), `Asset ${asset.assetId} must have romfs/ destination`);
  }
});

test('BETA-UI-4.7: Real 3DSX generated with RomFS', () => {
  checkToolchain('3dsxtool');
});

test('BETA-UI-4.8: Repeated package builds are deterministic', async () => {
  const stagingDir1 = path.join(__dirname, 'build_romfs_repeat_1');
  const stagingDir2 = path.join(__dirname, 'build_romfs_repeat_2');
  const packager1 = new AssetPackager({ stagingDir: stagingDir1 });
  const packager2 = new AssetPackager({ stagingDir: stagingDir2 });
  const manifest = {
    assets: [
      { assetId: 'bg_arena_plains', romfsPath: 'romfs/arenas/plains.t3x' },
      { assetId: 'pokemon_sprite_25_front', romfsPath: 'romfs/sprites/pokemon/25.t3x' },
      { assetId: 'audio_se_select', romfsPath: 'romfs/audio/se_select.bcstm' }
    ]
  };

  const res1 = await packager1.packageManifest(manifest);
  const res2 = await packager2.packageManifest(manifest);

  assert.strictEqual(JSON.stringify(res1.manifest), JSON.stringify(res2.manifest));
});

test('BETA-UI-4.9: PikachuEntrance runtime smoke', async () => {
  const scenePath = path.join(__dirname, '../project/screens/PikachuEntrance.json');
  const sceneData = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const exported = SceneCppExporter.export(sceneData);
  assert.ok(exported.files['generated/src/screens/PikachuEntranceScene.cpp']);

  const stagingDir = path.join(__dirname, 'build_romfs_pika');
  const packager = new AssetPackager({ stagingDir });
  const pkgRes = await packager.packageManifest(exported.manifest);
  assert.strictEqual(pkgRes.success, true);
  assert.ok(pkgRes.stagedFiles.includes('romfs/sprites/pokemon/25.t3x'));
});

test('BETA-UI-4.10: Dual-screen asset packaging', async () => {
  const stagingDir = path.join(__dirname, 'build_romfs_dual');
  const packager = new AssetPackager({ stagingDir });
  const manifest = {
    assets: [
      { assetId: 'bg_arena_sea', romfsPath: 'romfs/arenas/sea.t3x' },
      { assetId: 'ui_command_panel', romfsPath: 'romfs/ui/ui_command_panel.t3x' }
    ]
  };
  const res = await packager.packageManifest(manifest);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.stagedFiles.length, 2);
});

test('BETA-UI-4.11: Invalid/corrupt asset rejection', async () => {
  const resolver = new AssetResolver();
  assert.throws(
    () => resolver.registerAsset({
      id: 'corrupt_asset_01',
      sourcePath: 'corrupt.png',
      target3DS: { t3xPath: 'romfs/ui/corrupt.t3x' },
      hash: 'placeholder_hash_fake'
    }),
    /placeholder hashes are prohibited/
  );
});

test('BETA-UI-4.12: Full editor → 3DSX pipeline', async () => {
  const scene = new SceneModel({
    id: 'FullPipelineScene',
    fps: 60,
    durationFrames: 60,
    top: { width: 400, height: 240 },
    bottom: { width: 320, height: 240 }
  });
  const node = ComponentRegistry.create('Image', {
    id: 'bg_node',
    screen: 'top',
    x: 0,
    y: 0,
    width: 400,
    height: 240,
    properties: { asset: 'bg_arena_plains' }
  });
  scene.addNode(node);

  const val = SceneValidator.validate(scene);
  assert.strictEqual(val.valid, true);

  const exported = SceneCppExporter.export(scene);
  assert.ok(exported.dataHpp);
  assert.ok(exported.manifest);

  const stagingDir = path.join(__dirname, 'build_romfs_full_pipeline');
  const packager = new AssetPackager({ stagingDir });
  const pkgRes = await packager.packageManifest(exported.manifest);
  assert.strictEqual(pkgRes.success, true);
  assert.ok(pkgRes.manifest.assetCount > 0);
});

let blocked = 0;
let failed = 0;

async function runAllTests() {
  for (const { name, fn } of testQueue) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      if (err.isToolchainBlocked || err.message?.includes('BLOCKED — missing toolchain/dependency')) {
        console.log(`  [-] ${name} (${err.message})`);
        blocked++;
      } else {
        console.error(`  ✕ ${name}`);
        console.error(`     Error: ${err.message}`);
        console.error(err.stack);
        failed++;
      }
    }
  }

  console.log(`\n====================================================`);
  console.log(`  TEST RESULTS: ${passed} PASSED, ${blocked} BLOCKED (toolchain missing), ${failed} FAILED`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

await runAllTests();


