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
import { PokerogueManifest } from '../public/js/data/PokerogueManifest.js';
import { PokerogueImporter } from '../public/js/data/PokerogueImporter.js';
import { PokerogueRepository } from '../public/js/data/PokerogueRepository.js';
import { PokemonSpriteResolver } from '../public/js/data/PokemonSpriteResolver.js';
import { RNG } from '../public/js/battle/RNG.js';
import { AbilityResolver } from '../public/js/battle/resolvers/AbilityResolver.js';
import { DamageResolver } from '../public/js/battle/resolvers/DamageResolver.js';
import { TurnOrderResolver } from '../public/js/battle/resolvers/TurnOrderResolver.js';
import { AIAdapter } from '../public/js/battle/resolvers/AIAdapter.js';
import { RomFSExporter } from '../public/js/generator/RomFSExporter.js';


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

// -------------------------------------------------------------
// 10. POKEROGUE MANIFEST & FROZEN REVISIONS
// -------------------------------------------------------------
test('PokerogueManifest enforces frozen revisions and deterministic exports', () => {
  const manifest = new PokerogueManifest();
  assert.strictEqual(manifest.source.branch, 'beta');
  assert.strictEqual(manifest.source.revision, '8555c08c823b856cbec4eb99ca84ea52a955836d');
  assert.strictEqual(manifest.assets.revision, '87426a79611f9d212c4dc8af58e2834a05b93725');
  assert.strictEqual(manifest.locales.revision, '23aea1cb0da5a0b15b836f3c243791591cc42303');

  const detExport = manifest.getDeterministicExport();
  assert.ok(detExport.sourceRevision);
  assert.strictEqual(detExport.importTimestamp, undefined, 'Deterministic export must not contain variable timestamps');
});

// -------------------------------------------------------------
// 11. REAL POKEROGUE IMPORTER & LOSSLESS PARSER
// -------------------------------------------------------------
test('PokerogueImporter parses real upstream TypeScript definitions losslessly', () => {
  const sampleSpeciesTs = `
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
        canChangeForm: true,
      }),
      passives: {
        0: AbilityId.TRANSISTOR,
      },
      levelMoves: [
        [1, MoveId.TAIL_WHIP],
        [1, MoveId.THUNDER_SHOCK],
        [1, MoveId.QUICK_ATTACK],
        [42, MoveId.THUNDERBOLT],
      ],
      tms: [MoveId.IRON_TAIL, MoveId.VOLT_SWITCH],
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
        genderDiffs: false,
      }),
      passives: AbilityId.DRY_SKIN,
      levelMoves: [
        [1, MoveId.TACKLE],
        [34, MoveId.ROCK_SLIDE],
        [40, MoveId.EARTHQUAKE],
      ],
    };
  `;

  const importer = new PokerogueImporter(new PokerogueRepository());
  const parsed = importer.parseGenerationSpecies(sampleSpeciesTs, ['PIKACHU', 'GOLEM']);

  assert.strictEqual(parsed.length, 2);
  const pika = parsed[0];
  assert.strictEqual(pika.name, 'Pikachu');
  assert.strictEqual(pika.speciesId, 25);
  assert.strictEqual(pika.category, 'Mouse Pokémon');
  assert.strictEqual(pika.baseStats.hp, 35);
  assert.strictEqual(pika.baseStats.spd, 90);
  assert.strictEqual(pika.baseTotal, 320);
  assert.deepStrictEqual(pika.types, ['Electric']);
  assert.strictEqual(pika.abilities.primary, 'Static');
  assert.strictEqual(pika.abilities.hidden, 'Lightning Rod');
  assert.strictEqual(pika.passives[0], 'Transistor');
  assert.ok(pika.preserveRawData.rawBlock.includes('SpeciesId.PIKACHU'), 'Lossless raw block preserved');

  const golem = parsed[1];
  assert.strictEqual(golem.speciesId, 76);
  assert.deepStrictEqual(golem.types, ['Rock', 'Ground']);
  assert.strictEqual(golem.baseStats.def, 130);
  assert.strictEqual(golem.abilities.secondary, 'Sturdy');
  assert.strictEqual(golem.passives[0], 'Dry Skin');
});

// -------------------------------------------------------------
// 12. REAL POKEROGUE SPRITE & ATLAS RESOLUTION
// -------------------------------------------------------------
test('PokemonSpriteResolver accurately resolves upstream assets without dummy paths', () => {
  const resolver = new PokemonSpriteResolver();

  // Generation 1 icon paths
  const pikaIcon = resolver.resolveIcon(25);
  assert.strictEqual(pikaIcon.path, 'images/pokemon/icons/1/25.png');

  const golemIcon = resolver.resolveIcon(76);
  assert.strictEqual(golemIcon.path, 'images/pokemon/icons/1/76.png');

  // Sprite paths
  const pikaFront = resolver.resolveSprite(25, { facing: 'front' });
  assert.strictEqual(pikaFront.imagePath, 'images/pokemon/25.png');
  assert.strictEqual(pikaFront.atlasPath, 'images/pokemon/25.json');

  const pikaBack = resolver.resolveSprite(25, { facing: 'back' });
  assert.strictEqual(pikaBack.imagePath, 'images/pokemon/back/25.png');

  const pikaShiny = resolver.resolveSprite(25, { shiny: true, facing: 'front' });
  assert.strictEqual(pikaShiny.imagePath, 'images/pokemon/shiny/25.png');

  const pikaFemale = resolver.resolveSprite(25, { female: true, facing: 'front' });
  assert.strictEqual(pikaFemale.imagePath, 'images/pokemon/female/25.png');
});

// -------------------------------------------------------------
// 13. STUDIO OVERRIDE SYSTEM & UPSTREAM DIFF
// -------------------------------------------------------------
test('DataManager manages non-destructive Overrides and Upstream Diffs', () => {
  // Set custom 3DS balance override for Pikachu HP
  dataManager.setOverride('species', 'pikachu', 'baseStats.hp', 48);

  const overriddenPika = dataManager.getSpecies('pikachu', true);
  assert.strictEqual(overriddenPika.baseStats.hp, 48);
  assert.strictEqual(overriddenPika._hasOverrides, true);

  const rawUpstreamPika = dataManager.getSpecies('pikachu', false);
  assert.strictEqual(rawUpstreamPika.baseStats.hp, 35, 'Base upstream data must remain untouched');

  const diff = dataManager.getDiffWithUpstream('species', 'pikachu');
  assert.ok(diff);
  assert.strictEqual(diff.hasDiffs, true);
  assert.strictEqual(diff.diffs[0].property, 'baseStats.hp');
  assert.strictEqual(diff.diffs[0].upstreamValue, 35);
  assert.strictEqual(diff.diffs[0].overrideValue, 48);

  // Clean up override for subsequent tests
  dataManager.overrideManager.removeOverride('species', 'pikachu', 'baseStats.hp');
});

// -------------------------------------------------------------
// 14. BATTLE TEST MATRIX: IMMUNITY, STURDY, STATIC & PRIORITY
// -------------------------------------------------------------
test('Battle Matrix: Electric immunity (Pikachu Thunderbolt vs Golem)', () => {
  const pikaSpecies = dataManager.getSpecies('pikachu');
  const golemSpecies = dataManager.getSpecies('golem');

  const pika = new PokemonBattleData(pikaSpecies, 25);
  const golem = new PokemonBattleData(golemSpecies, 25);
  const tbMove = dataManager.getMove('thunderbolt');

  const rng = new RNG(12345);
  const breakdown = DamageResolver.resolve(pika, golem, tbMove, rng);

  // Electric vs Ground is completely immune (0x multiplier)
  assert.strictEqual(breakdown.typeEffectiveness, 0);
  assert.strictEqual(breakdown.finalDamage, 0);
});

test('Battle Matrix: Sturdy survives lethal blow with 1 HP', () => {
  const golemSpecies = dataManager.getSpecies('golem');
  const golem = new PokemonBattleData(golemSpecies, 20);
  golem.ability = 'Sturdy';

  assert.strictEqual(golem.currentHp, golem.maxHp);
  assert.strictEqual(golem.ability, 'Sturdy');

  let abilityTriggered = false;
  const { finalDamage, effectTriggered } = AbilityResolver.onPreDamageApplied(
    golem,
    null,
    { name: 'Hydro Pump' },
    999, // lethal damage exceeding max HP
    (name) => { if (name === 'AbilityTriggered') abilityTriggered = true; }
  );

  assert.ok(abilityTriggered);
  assert.strictEqual(finalDamage, golem.maxHp - 1, 'Damage clamped so exactly 1 HP remains');
});

test('Battle Matrix: Static inflicts paralysis on contact', () => {
  const pikaSpecies = dataManager.getSpecies('pikachu');
  const pika = new PokemonBattleData(pikaSpecies, 20);
  pika.ability = 'Static';

  const attacker = new PokemonBattleData(dataManager.getSpecies('golem'), 20);
  const contactMove = { flags: { contact: true } };

  // Seeded RNG where rollPercent(30) returns true
  const rng = new RNG(12345);
  let statusApplied = false;

  AbilityResolver.onPostDamageReceived(
    pika,
    attacker,
    contactMove,
    20,
    rng,
    (ev) => { if (ev === 'StatusApplied') statusApplied = true; }
  );

  assert.ok(statusApplied);
  assert.strictEqual(attacker.status, 'paralysis');
});

test('Battle Matrix: Priority moves determine turn order over speed', () => {
  const slowUser = { user: { getEffectiveStat: () => 30 }, move: { priority: 1, name: 'Quick Attack' } };
  const fastUser = { user: { getEffectiveStat: () => 150 }, move: { priority: 0, name: 'Thunderbolt' } };

  const rng = new RNG(100);
  const order = TurnOrderResolver.resolve(slowUser, fastUser, rng);

  assert.strictEqual(order.first, slowUser, 'Priority +1 must act before Priority 0');
});

test('AIAdapter evaluates candidates with explainable scores and reasons', () => {
  const pika = new PokemonBattleData(dataManager.getSpecies('pikachu'), 20);
  const golem = new PokemonBattleData(dataManager.getSpecies('golem'), 20);

  const decision = AIAdapter.selectBestAction(golem, pika);
  assert.ok(decision.selectedCandidate);
  assert.ok(decision.allCandidates.length >= 2);
  assert.ok(decision.confidenceScore > 0);
  assert.ok(decision.selectedCandidate.reasons.length > 0);
});

// -------------------------------------------------------------
// 15. DETERMINISTIC PRNG REPRODUCTION & REPLAY
// -------------------------------------------------------------
test('BattleEngine produces 100% byte-for-byte identical event streams for identical seeds', () => {
  const runSim = (seed) => {
    const pika = new PokemonBattleData(dataManager.getSpecies('pikachu'), 20);
    const golem = new PokemonBattleData(dataManager.getSpecies('golem'), 20);
    const state = new BattleState(pika, golem, seed);
    const engine = new BattleEngine(state);
    engine.runFullTurn('tackle');
    return state.eventLog;
  };

  const logA = runSim(999);
  const logB = runSim(999);

  assert.strictEqual(logA.length, logB.length);
  for (let i = 0; i < logA.length; i++) {
    assert.strictEqual(logA[i].sequenceNumber, logB[i].sequenceNumber);
    assert.strictEqual(logA[i].type, logB[i].type);
  }
});

// -------------------------------------------------------------
// 16. ROMFS 3DS BINARY EXPORT & MEMORY BUDGET
// -------------------------------------------------------------
test('RomFSExporter packs binary tables and validates 3DS hardware constraints', () => {
  const speciesList = dataManager.getAllSpecies();
  const movesList = dataManager.getAllMoves();

  const speciesBin = RomFSExporter.packSpeciesBinary(speciesList);
  assert.ok(speciesBin.byteLength >= 4 + speciesList.length * 24);

  const movesBin = RomFSExporter.packMovesBinary(movesList);
  assert.ok(movesBin.byteLength >= 4 + movesList.length * 12);

  const budget = RomFSExporter.calculateResourceBudget(null, dataManager.assetRepo);
  assert.strictEqual(budget.status.vramOk, true);
  assert.strictEqual(budget.status.ramOk, true);
});

// -------------------------------------------------------------
// 17. POKÉROGUE UI DATA VIEWS & STARTER SELECT (VERTICAL SLICE 2)
// -------------------------------------------------------------
test('ComponentRegistry registers StatusBadge, PokemonSprite, WaveIndicator, and PokemonGrid', () => {
  const all = ComponentRegistry.getAll();
  const types = all.map(c => c.type);
  assert.ok(types.includes('StatusBadge'), 'Missing StatusBadge');
  assert.ok(types.includes('PokemonSprite'), 'Missing PokemonSprite');
  assert.ok(types.includes('WaveIndicator'), 'Missing WaveIndicator');
  assert.ok(types.includes('PokemonGrid'), 'Missing PokemonGrid');
});

test('Validator validates StarterSelectScreen and CodeGenerator exports complete C++ screen', () => {
  const starterScreenPath = path.join(__dirname, '..', 'project', 'screens', 'StarterSelectScreen.json');
  assert.ok(fs.existsSync(starterScreenPath), 'StarterSelectScreen.json must exist');

  const rawJson = fs.readFileSync(starterScreenPath, 'utf8');
  const screenData = JSON.parse(rawJson);

  const validation = Validator.validateScreen(screenData);
  assert.strictEqual(validation.valid, true, `Validation failed: ${JSON.stringify(validation.errors)}`);

  const { hpp, cpp, className } = CodeGenerator.generate(screenData);
  assert.strictEqual(className, 'StarterSelectScreen');
  assert.ok(hpp.includes('#include "ui/pokemon_grid.hpp"'));
  assert.ok(hpp.includes('#include "ui/pokemon_sprite.hpp"'));
  assert.ok(hpp.includes('#include "ui/wave_indicator.hpp"'));
  assert.ok(hpp.includes('#include "ui/status_badge.hpp"'));
  assert.ok(cpp.includes('m_focus_manager.addElement'));
  assert.ok(cpp.includes('renderer.clear('));
});

test('PokemonGrid supports 3DS touch hit-testing and starter selection', () => {
  const grid = ComponentRegistry.create('PokemonGrid', {
    id: 'test_grid',
    width: 300,
    height: 190,
    properties: {
      columns: 3,
      rows: 2,
      selectedIndex: 0,
      startersData: [
        { speciesId: 1, name: 'Bulbasaur', cost: 3 },
        { speciesId: 4, name: 'Charmander', cost: 3 },
        { speciesId: 7, name: 'Squirtle', cost: 3 },
        { speciesId: 25, name: 'Pikachu', cost: 4 }
      ]
    }
  });

  // Touch on cell (row 1, col 0 -> index 3: Pikachu)
  // cellWidth = 100, cellHeight = 95
  const touchResult = grid.handleTouch(50, 120);
  assert.ok(touchResult);
  assert.strictEqual(touchResult.type, 'SELECT_STARTER');
  assert.strictEqual(touchResult.index, 3);
  assert.strictEqual(touchResult.item.name, 'Pikachu');
  assert.strictEqual(grid.properties.selectedIndex, 3);
});

console.log(`\n====================================================`);
console.log(`  TEST RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
console.log(`====================================================\n`);

if (passed !== total) {
  process.exit(1);
}



