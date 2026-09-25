import { PokerogueManifest } from './PokerogueManifest.js';
import { POKEROGUE_REPOSITORIES } from './PokerogueSource.js';
import { SourceMetadata } from './CanonicalModels.js';

/**
 * PokerogueEnumCatalog - Canonical bidirectional mapping for a single PokéRogue enum.
 * symbol -> numeric ID
 * numeric ID -> symbol
 */
export class PokerogueEnumCatalog {
  constructor(enumName, repositoryKey = 'pokerogue', sourcePath = '') {
    this.enumName = enumName;
    this.repositoryKey = repositoryKey;
    this.sourcePath = sourcePath;
    this.symbolToId = new Map();
    this.idToSymbol = new Map();
    this.provenance = null;
    this.count = 0;
  }

  /**
   * Registers a bidirectional mapping pair.
   * @param {string} symbol e.g. "PIKACHU"
   * @param {number} id e.g. 25
   */
  set(symbol, id) {
    const cleanSym = String(symbol).trim().toUpperCase();
    const numId = Number(id);
    this.symbolToId.set(cleanSym, numId);
    this.idToSymbol.set(numId, cleanSym);
    this.count = this.symbolToId.size;
  }

  hasSymbol(symbol) {
    return this.symbolToId.has(String(symbol).trim().toUpperCase());
  }

  hasId(id) {
    return this.idToSymbol.has(Number(id));
  }

  getId(symbol) {
    const cleanSym = String(symbol).trim().toUpperCase();
    return this.symbolToId.get(cleanSym);
  }

  getSymbol(id) {
    return this.idToSymbol.get(Number(id));
  }

  entries() {
    return Array.from(this.symbolToId.entries());
  }
}

/**
 * PokerogueEnumParser - Ingests and parses TypeScript enum files directly from PokéRogue upstream.
 * Strictly avoids hardcoding IDs. Understands comments (JSDoc/line), explicit assignments (BULBASAUR = 1),
 * and implicit auto-incrementing sequential values.
 */
export class PokerogueEnumParser {
  constructor() {
    this.manifest = new PokerogueManifest();
  }

  /**
   * Parses an enum from TypeScript content.
   * @param {string} tsContent Upstream file contents
   * @param {string} enumName Name of the enum (e.g. 'SpeciesId', 'MoveId', 'AbilityId', 'PokemonType')
   * @param {string} sourcePath Path in upstream repo (e.g. 'src/enums/species-id.ts')
   * @param {string} [repoKey='pokerogue']
   * @returns {PokerogueEnumCatalog}
   */
  parseEnum(tsContent, enumName, sourcePath = '', repoKey = 'pokerogue') {
    if (!tsContent || typeof tsContent !== 'string') {
      throw new Error(`Invalid TypeScript content provided for enum "${enumName}".`);
    }

    const repoInfo = POKEROGUE_REPOSITORIES[repoKey] || {
      revision: 'unknown',
      license: 'AGPL-v3.0-only'
    };
    const fileHash = PokerogueManifest.computeHash(tsContent);
    this.manifest.recordFile(repoKey, repoInfo.revision, sourcePath, tsContent);

    const catalog = new PokerogueEnumCatalog(enumName, repoKey, sourcePath);
    catalog.provenance = new SourceMetadata({
      source: repoKey,
      sourcePath,
      sourceRevision: repoInfo.revision,
      importedAt: 'CANONICAL_ENUM_IMPORT',
      license: repoInfo.license
    });
    catalog.sourceHash = fileHash;

    // Locate enum block declaration
    const enumHeaderRegex = new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{`, 'm');
    const match = enumHeaderRegex.exec(tsContent);
    if (!match) {
      throw new Error(`Enum "${enumName}" declaration not found in provided content.`);
    }

    // Find balanced closing brace
    const braceOpen = match.index + match[0].length - 1;
    let depth = 0;
    let braceClose = -1;
    for (let i = braceOpen; i < tsContent.length; i++) {
      if (tsContent[i] === '{') depth++;
      else if (tsContent[i] === '}') {
        depth--;
        if (depth === 0) {
          braceClose = i;
          break;
        }
      }
    }

    if (braceClose === -1) {
      throw new Error(`Unterminated enum block for "${enumName}".`);
    }

    const body = tsContent.slice(braceOpen + 1, braceClose);
    // Strip block comments (/* ... */) and line comments (// ...)
    const stripped = body.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const rawTokens = stripped.split(',').map(s => s.trim()).filter(Boolean);

    let nextValue = 0;
    for (const token of rawTokens) {
      if (token.includes('=')) {
        const [symPart, valPart] = token.split('=').map(s => s.trim());
        const parsedVal = Number(valPart);
        if (isNaN(parsedVal)) {
          // If value is a reference or expression, note but do not crash
          continue;
        }
        catalog.set(symPart, parsedVal);
        nextValue = parsedVal + 1;
      } else {
        catalog.set(token, nextValue);
        nextValue++;
      }
    }

    return catalog;
  }
}
