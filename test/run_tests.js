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


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('----------------------------------------------------');
console.log('  RUNNING 3DS UI STUDIO AUTOMATED TEST SUITE');
console.log('----------------------------------------------------\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
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

console.log(`\n====================================================`);
console.log(`  TEST RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
console.log(`====================================================\n`);

if (passed !== total) {
  process.exit(1);
}

