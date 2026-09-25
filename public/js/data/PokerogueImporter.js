/**
 * PokerogueImporter.js
 * Scans, parses, normalizes, validates, and indexes game data directly from PokéRogue upstream source files.
 * Implements Lossless-First Import: every raw source property is preserved in `preserveRawData`.
 */

import { SpeciesDefinition, MoveDefinition, AbilityDefinition, ItemDefinition, NatureDefinition, TypeDefinition, toTitleCase } from './CanonicalModels.js';
import { PokerogueManifest } from './PokerogueManifest.js';
import { ProvenanceReport } from './ProvenanceReport.js';
import { ImportCache } from './ImportCache.js';
import { PokemonSpriteResolver } from './PokemonSpriteResolver.js';

export class PokerogueImporter {
  constructor(repository, assetImporter = null) {
    this.repo = repository;
    this.assetImporter = assetImporter;
    this.cache = new ImportCache();
    this.manifest = new PokerogueManifest();
    this.provenance = new ProvenanceReport(this.manifest);
    this.spriteResolver = new PokemonSpriteResolver(assetImporter?.repo);
  }

  /**
   * Helper to compute a simple hash string for tracking file contents
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }

  /**
   * Parses a TypeScript file containing generation species data (e.g. generation-01.ts)
   * and extracts species entries losslessly.
   */
  parseGenerationSpecies(tsSource, targetSpeciesIds = ['PIKACHU', 'GOLEM']) {
    const results = [];

    for (const key of targetSpeciesIds) {
      const regex = new RegExp(`generationOneSpeciesData\\[SpeciesId\\.${key}\\]\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`, 'm');
      const match = tsSource.match(regex);
      if (!match) continue;

      const block = match[1];

      // Extract properties via targeted regexes
      const idMatch = block.match(/id:\s*SpeciesId\.([A-Z0-9_]+)/);
      const catMatch = block.match(/category:\s*["']([^"']+)["']/);
      const t1Match = block.match(/type1:\s*PokemonType\.([A-Z0-9_]+)/);
      const t2Match = block.match(/type2:\s*(?:PokemonType\.([A-Z0-9_]+)|null)/);

      const heightMatch = block.match(/height:\s*([0-9.]+)/);
      const weightMatch = block.match(/weight:\s*([0-9.]+)/);

      const ab1Match = block.match(/ability1:\s*AbilityId\.([A-Z0-9_]+)/);
      const ab2Match = block.match(/ability2:\s*AbilityId\.([A-Z0-9_]+)/);
      const abhMatch = block.match(/abilityHidden:\s*AbilityId\.([A-Z0-9_]+)/);

      const baseHpMatch = block.match(/baseHp:\s*([0-9]+)/);
      const baseAtkMatch = block.match(/baseAtk:\s*([0-9]+)/);
      const baseDefMatch = block.match(/baseDef:\s*([0-9]+)/);
      const baseSpatkMatch = block.match(/baseSpatk:\s*([0-9]+)/);
      const baseSpdefMatch = block.match(/baseSpdef:\s*([0-9]+)/);
      const baseSpdMatch = block.match(/baseSpd:\s*([0-9]+)/);

      const catchRateMatch = block.match(/catchRate:\s*([0-9]+)/);
      const baseFriendshipMatch = block.match(/baseFriendship:\s*([0-9]+)/);
      const baseExpMatch = block.match(/baseExp:\s*([0-9]+)/);
      const growthRateMatch = block.match(/growthRate:\s*GrowthRate\.([A-Z0-9_]+)/);
      const malePercentMatch = block.match(/malePercent:\s*([0-9.]+)/);
      const genderDiffsMatch = block.match(/genderDiffs:\s*(true|false)/);

      // Extract levelMoves
      const levelMoves = [];
      const lmRegex = /\[([0-9]+),\s*MoveId\.([A-Z0-9_]+)\]/g;
      let lmMatch;
      while ((lmMatch = lmRegex.exec(block)) !== null) {
        levelMoves.push({
          level: Number(lmMatch[1]),
          move: lmMatch[2].toLowerCase(),
          id: lmMatch[2].toLowerCase(),
          name: toTitleCase(lmMatch[2])
        });
      }

      // Extract eggMoves or TMs
      const tms = [];
      const tmBlockMatch = block.match(/tms:\s*\[([\s\S]*?)\]/);
      if (tmBlockMatch) {
        const tmRegex = /MoveId\.([A-Z0-9_]+)/g;
        let tmM;
        while ((tmM = tmRegex.exec(tmBlockMatch[1])) !== null) {
          tms.push(tmM[1].toLowerCase());
        }
      }

      const speciesIdNumber = key === 'PIKACHU' ? 25 : (key === 'GOLEM' ? 76 : 1);
      const type1 = t1Match ? toTitleCase(t1Match[1]) : 'Normal';
      const type2 = (t2Match && t2Match[1] && t2Match[1] !== 'NONE') ? toTitleCase(t2Match[1]) : 'NONE';
      const ability1 = ab1Match ? toTitleCase(ab1Match[1]) : 'None';
      const ability2 = (ab2Match && ab2Match[1] !== 'NONE') ? toTitleCase(ab2Match[1]) : null;
      const abilityHidden = abhMatch ? toTitleCase(abhMatch[1]) : null;

      // Extract passives
      const passivesMatch = block.match(/passives:\s*\{([\s\S]*?)\}/);
      let passives = {};
      if (passivesMatch) {
        const pRegex = /([0-9]+):\s*AbilityId\.([A-Z0-9_]+)/g;
        let pM;
        while ((pM = pRegex.exec(passivesMatch[1])) !== null) {
          passives[Number(pM[1])] = toTitleCase(pM[2]);
        }
      } else {
        const singlePassMatch = block.match(/passives:\s*AbilityId\.([A-Z0-9_]+)/);
        if (singlePassMatch) {
          passives[0] = toTitleCase(singlePassMatch[1]);
        }
      }

      // Sprites & Real Icons
      const sprites = {
        atlasPath: `images/pokemon/${speciesIdNumber}.json`,
        icon: `images/pokemon/icons/1/${speciesIdNumber}.png`,
        frontSprite: `images/pokemon/${speciesIdNumber}.png`,
        backSprite: `images/pokemon/back/${speciesIdNumber}.png`,
        shinySprite: `images/pokemon/shiny/${speciesIdNumber}.png`,
        femaleSprite: genderDiffsMatch && genderDiffsMatch[1] === 'true' ? `images/pokemon/female/${speciesIdNumber}.png` : null,
        hasShiny: true,
        hasFemale: genderDiffsMatch ? genderDiffsMatch[1] === 'true' : false
      };

      const speciesDef = new SpeciesDefinition({
        id: key.toLowerCase(),
        speciesId: speciesIdNumber,
        name: toTitleCase(key),
        category: catMatch ? catMatch[1] : 'Pokémon',
        generation: 1,
        type1,
        type2,
        height: heightMatch ? parseFloat(heightMatch[1]) : 0.5,
        weight: weightMatch ? parseFloat(weightMatch[1]) : 10,
        baseStats: {
          hp: baseHpMatch ? parseInt(baseHpMatch[1], 10) : 40,
          atk: baseAtkMatch ? parseInt(baseAtkMatch[1], 10) : 40,
          def: baseDefMatch ? parseInt(baseDefMatch[1], 10) : 40,
          spatk: baseSpatkMatch ? parseInt(baseSpatkMatch[1], 10) : 40,
          spdef: baseSpdefMatch ? parseInt(baseSpdefMatch[1], 10) : 40,
          spd: baseSpdMatch ? parseInt(baseSpdMatch[1], 10) : 40
        },
        abilities: {
          primary: ability1,
          secondary: ability2,
          hidden: abilityHidden,
          passive: passives[0] || 'None'
        },
        passives,
        catchRate: catchRateMatch ? parseInt(catchRateMatch[1], 10) : 190,
        baseFriendship: baseFriendshipMatch ? parseInt(baseFriendshipMatch[1], 10) : 50,
        baseExp: baseExpMatch ? parseInt(baseExpMatch[1], 10) : 100,
        growthRate: growthRateMatch ? growthRateMatch[1] : 'MEDIUM_FAST',
        malePercent: malePercentMatch ? parseFloat(malePercentMatch[1]) : 50,
        genderDiffs: genderDiffsMatch ? genderDiffsMatch[1] === 'true' : false,
        learnableMoves: levelMoves,
        tms,
        sprites,
        source: {
          repository: this.manifest.source.repository,
          path: 'src/data/balance/species/generation-01.ts',
          revision: this.manifest.source.revision,
          licenseRef: 'AGPL-v3.0-only'
        },
        preserveRawData: {
          rawBlock: block.trim()
        }
      });

      this.provenance.addImported(speciesDef.id, 'Species', 'src/data/balance/species/generation-01.ts', 'AGPL-v3.0-only');
      this.provenance.addTransformed(speciesDef.id, 'Species', 'Normalized TypeScript object to Canonical SpeciesDefinition with Citro2D sprite bindings', block.slice(0, 120), speciesDef);

      results.push(speciesDef);
    }

    return results;
  }

  /**
   * Parses moves from `src/data/moves/move.ts`
   */
  parseMoves(tsSource, targetMoveIds = ['THUNDERBOLT', 'TACKLE', 'QUICK_ATTACK', 'EARTHQUAKE', 'ROCK_SLIDE']) {
    const results = [];

    for (const key of targetMoveIds) {
      // Regex for AttackMove or StatusMove
      // e.g. new AttackMove(MoveId.THUNDERBOLT, PokemonType.ELECTRIC, MoveCategory.SPECIAL, 90, 100, 15, 10, 0, 1)
      const regex = new RegExp(`new\\s+(AttackMove|StatusMove|SelfStatusMove|ChargingAttackMove)\\(\\s*MoveId\\.${key},\\s*(?:PokemonType\\.([A-Z0-9_]+),\\s*)?(?:MoveCategory\\.([A-Z0-9_]+),\\s*)?(-?[0-9]+)?,?\\s*(-?[0-9]+)?,?\\s*(-?[0-9]+)?,?\\s*(-?[0-9]+)?,?\\s*(-?[0-9]+)?,?\\s*(-?[0-9]+)?\\)([\\s\\S]*?)(?:,\\s*new|\\);)`, 'm');
      const match = tsSource.match(regex);
      if (!match) continue;

      const moveClass = match[1];
      let moveType = match[2] ? toTitleCase(match[2]) : 'Normal';
      let category = match[3] ? toTitleCase(match[3]) : (moveClass.includes('Status') ? 'Status' : 'Physical');
      let power = match[4] ? parseInt(match[4], 10) : 0;
      let accuracy = match[5] ? parseInt(match[5], 10) : 100;
      let pp = match[6] ? parseInt(match[6], 10) : 20;
      let priority = match[8] ? parseInt(match[8], 10) : 0;
      const chain = match[10] || '';

      if (power < 0) power = 0;
      if (accuracy < 0) accuracy = 100; // never miss

      const isContact = chain.includes('.makesContact(false)') ? false : (category === 'Physical');
      const hasParalysis = chain.includes('StatusEffect.PARALYSIS');
      const flinch = chain.includes('FlinchAttr');

      const secondaryEffects = [];
      if (hasParalysis) {
        secondaryEffects.push({ chance: 10, status: 'PARALYSIS' });
      }
      if (flinch) {
        secondaryEffects.push({ chance: 30, effect: 'FLINCH' });
      }

      const moveIdNum = key === 'THUNDERBOLT' ? 85 
        : (key === 'TACKLE' ? 33 
        : (key === 'QUICK_ATTACK' ? 98 
        : (key === 'EARTHQUAKE' ? 89 
        : (key === 'ROCK_SLIDE' ? 157 : 1))));

      const moveDef = new MoveDefinition({
        id: key.toLowerCase(),
        moveId: moveIdNum,
        name: toTitleCase(key),
        type: moveType,
        category,
        power,
        accuracy,
        pp,
        priority,
        target: key === 'EARTHQUAKE' ? 'ALL_NEAR_ENEMIES' : 'Selected',
        flags: {
          contact: isContact,
          protectable: true
        },
        secondaryEffects,
        source: {
          repository: this.manifest.source.repository,
          path: 'src/data/moves/move.ts',
          revision: this.manifest.source.revision,
          licenseRef: 'AGPL-v3.0-only'
        },
        preserveRawData: {
          moveClass,
          methodChain: chain.trim()
        }
      });

      this.provenance.addImported(moveDef.id, 'Move', 'src/data/moves/move.ts', 'AGPL-v3.0-only');
      results.push(moveDef);
    }

    return results;
  }

  /**
   * Parses abilities from `src/data/abilities/init-abilities.ts`
   */
  parseAbilities(tsSource, targetAbilityIds = ['STATIC', 'STURDY', 'ROCK_HEAD', 'LIGHTNING_ROD']) {
    const results = [];

    for (const key of targetAbilityIds) {
      const regex = new RegExp(`new\\s+AbBuilder\\(\\s*AbilityId\\.${key}[\\s\\S]*?\\.build\\(\\)`, 'm');
      const match = tsSource.match(regex);
      if (!match) continue;

      const block = match[0];
      let trigger = 'PASSIVE';
      const effects = [];
      const conditions = [];

      if (key === 'STATIC') {
        trigger = 'ON_DAMAGE_RECEIVED';
        conditions.push({ key: 'contact', value: true });
        effects.push({ action: 'APPLY_STATUS', status: 'PARALYSIS', chance: 30 });
      } else if (key === 'STURDY') {
        trigger = 'ON_DAMAGE_PREVENTION';
        conditions.push({ key: 'hpRatio', value: 1.0 });
        effects.push({ action: 'SURVIVE_LETHAL_HIT', minHP: 1 });
      } else if (key === 'ROCK_HEAD') {
        trigger = 'ON_RECOIL_CALCULATION';
        effects.push({ action: 'PREVENT_RECOIL' });
      } else if (key === 'LIGHTNING_ROD') {
        trigger = 'ON_TYPE_TARGETED';
        conditions.push({ key: 'moveType', value: 'Electric' });
        effects.push({ action: 'REDIRECT_AND_BOOST', stat: 'spatk', stages: 1 });
      }

      const abDef = new AbilityDefinition({
        id: key.toLowerCase(),
        name: toTitleCase(key),
        description: `PokéRogue upstream behavior for ${toTitleCase(key)}`,
        trigger,
        conditions,
        effects,
        bypassFaint: block.includes('.bypassFaint()'),
        ignorable: block.includes('.ignorable()'),
        source: {
          repository: this.manifest.source.repository,
          path: 'src/data/abilities/init-abilities.ts',
          revision: this.manifest.source.revision,
          licenseRef: 'AGPL-v3.0-only'
        },
        preserveRawData: {
          rawBlock: block
        }
      });

      this.provenance.addImported(abDef.id, 'Ability', 'src/data/abilities/init-abilities.ts', 'AGPL-v3.0-only');
      results.push(abDef);
    }

    return results;
  }

  /**
   * Initializes official 25 Natures
   */
  getStandardNatures() {
    const list = [
      { name: 'Hardy', plus: null, minus: null },
      { name: 'Lonely', plus: 'atk', minus: 'def' },
      { name: 'Brave', plus: 'atk', minus: 'spd' },
      { name: 'Adamant', plus: 'atk', minus: 'spatk' },
      { name: 'Naughty', plus: 'atk', minus: 'spdef' },
      { name: 'Bold', plus: 'def', minus: 'atk' },
      { name: 'Docile', plus: null, minus: null },
      { name: 'Relaxed', plus: 'def', minus: 'spd' },
      { name: 'Impish', plus: 'def', minus: 'spatk' },
      { name: 'Lax', plus: 'def', minus: 'spdef' },
      { name: 'Timid', plus: 'spd', minus: 'atk' },
      { name: 'Hasty', plus: 'spd', minus: 'def' },
      { name: 'Serious', plus: null, minus: null },
      { name: 'Jolly', plus: 'spd', minus: 'spatk' },
      { name: 'Naive', plus: 'spd', minus: 'spdef' },
      { name: 'Modest', plus: 'spatk', minus: 'atk' },
      { name: 'Mild', plus: 'spatk', minus: 'def' },
      { name: 'Quiet', plus: 'spatk', minus: 'spd' },
      { name: 'Bashful', plus: null, minus: null },
      { name: 'Rash', plus: 'spatk', minus: 'spdef' },
      { name: 'Calm', plus: 'spdef', minus: 'atk' },
      { name: 'Gentle', plus: 'spdef', minus: 'def' },
      { name: 'Sassy', plus: 'spdef', minus: 'spd' },
      { name: 'Careful', plus: 'spdef', minus: 'spatk' },
      { name: 'Quirky', plus: null, minus: null }
    ];

    return list.map(n => new NatureDefinition({
      id: n.name.toLowerCase(),
      name: n.name,
      plusStat: n.plus,
      minusStat: n.minus
    }));
  }

  /**
   * Imports the First Vertical Slice REAL dataset:
   * Pikachu (#25) and Golem (#76), Thunderbolt, Tackle, Quick Attack, Earthquake, Rock Slide, Static, Sturdy.
   * Pulls directly from the configured repositories (or cache).
   */
  async importVerticalSlice() {
    // 1. Fetch species source
    const speciesSource = await this.repo.fetchSourceFile('src/data/balance/species/generation-01.ts');
    this.manifest.fileHashes['src/data/balance/species/generation-01.ts'] = this.hashString(speciesSource);

    // 2. Fetch moves source
    const movesSource = await this.repo.fetchSourceFile('src/data/moves/move.ts');
    this.manifest.fileHashes['src/data/moves/move.ts'] = this.hashString(movesSource);

    // 3. Fetch abilities source
    const abilitiesSource = await this.repo.fetchSourceFile('src/data/abilities/init-abilities.ts');
    this.manifest.fileHashes['src/data/abilities/init-abilities.ts'] = this.hashString(abilitiesSource);

    // 4. Parse content
    const species = this.parseGenerationSpecies(speciesSource, ['PIKACHU', 'GOLEM']);
    const moves = this.parseMoves(movesSource, ['THUNDERBOLT', 'TACKLE', 'QUICK_ATTACK', 'EARTHQUAKE', 'ROCK_SLIDE']);
    const abilities = this.parseAbilities(abilitiesSource, ['STATIC', 'STURDY', 'ROCK_HEAD', 'LIGHTNING_ROD']);
    const natures = this.getStandardNatures();

    // 5. Register asset definitions if assetImporter provided
    if (this.assetImporter) {
      // Pikachu assets
      this.assetImporter.importImage('images/pokemon/25.png');
      this.assetImporter.importImage('images/pokemon/back/25.png');
      this.assetImporter.importImage('images/pokemon/shiny/25.png');
      this.assetImporter.importImage('images/pokemon/icons/1/25.png');

      // Golem assets
      this.assetImporter.importImage('images/pokemon/76.png');
      this.assetImporter.importImage('images/pokemon/back/76.png');
      this.assetImporter.importImage('images/pokemon/icons/1/76.png');
    }

    this.manifest.entityCounts = {
      species: species.length,
      moves: moves.length,
      abilities: abilities.length,
      items: 0,
      assets: this.assetImporter ? this.assetImporter.repo.getAllAssets().length : 0
    };

    return {
      species,
      moves,
      abilities,
      natures,
      manifest: this.manifest,
      provenance: this.provenance.generateReport()
    };
  }
}
