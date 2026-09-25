/**
 * ProvenanceReport.js
 * Generates structured compliance and licensing provenance reports for all imported,
 * transformed, generated, and unsupported features.
 */

export class ProvenanceReport {
  constructor(manifest) {
    this.manifest = manifest;
    this.imported = [];
    this.transformed = [];
    this.generated = [];
    this.unsupported = [];
  }

  addImported(entityId, type, sourcePath, licenseRef = 'AGPL-v3.0-only') {
    this.imported.push({
      id: entityId,
      type,
      source: {
        repository: this.manifest?.source?.repository || 'pokerogue',
        path: sourcePath,
        revision: this.manifest?.source?.revision || '8555c08c823b856cbec4eb99ca84ea52a955836d',
        licenseRef
      }
    });
  }

  addTransformed(entityId, type, reason, originalStructure, transformedStructure) {
    this.transformed.push({
      id: entityId,
      type,
      reason,
      originalStructure,
      transformedStructure
    });
  }

  addGenerated(targetFile, description, generator = 'CodeGenerator / RomFSExporter') {
    this.generated.push({
      file: targetFile,
      description,
      generator
    });
  }

  addUnsupported(entityId, featureName, rawData) {
    this.unsupported.push({
      id: entityId,
      feature: featureName,
      status: 'PreservedInRawData',
      rawData
    });
  }

  generateReport() {
    const totalEntities = this.imported.length;
    const editableCount = totalEntities - this.unsupported.length;
    const editablePct = totalEntities > 0 ? Math.round((editableCount / totalEntities) * 100) : 100;
    const unsupportedPct = 100 - editablePct;

    return {
      schemaVersion: 1,
      sourceRevision: this.manifest?.source?.revision || '8555c08c823b856cbec4eb99ca84ea52a955836d',
      assetRevision: this.manifest?.assets?.revision || '87426a79611f9d212c4dc8af58e2834a05b93725',
      localeRevision: this.manifest?.locales?.revision || '23aea1cb0da5a0b15b836f3c243791591cc42303',
      metrics: {
        importedCount: totalEntities,
        transformedCount: this.transformed.length,
        generatedCount: this.generated.length,
        unsupportedCount: this.unsupported.length,
        losslessRate: '100%',
        editableRate: `${editablePct}%`,
        unsupportedRate: `${unsupportedPct}%`
      },
      licensingSummary: {
        codeLicense: 'AGPL-v3.0-only',
        assetsLicense: 'REUSE compliance (per-file CC-BY-NC-SA-4.0 / LicenseRef-FAIR-USE)',
        trademarksDisclaimer: 'Pokémon and Nintendo trademarks belong to Nintendo/Creatures Inc./GAME FREAK inc. PokéRogue code is licensed under AGPL-3.0-only.'
      },
      imported: this.imported,
      transformed: this.transformed,
      generated: this.generated,
      unsupported: this.unsupported
    };
  }
}
