/**
 * PokemonSpriteResolver.js
 * Implements real PokéRogue sprite and icon resolution rules.
 * Resolves exact asset paths and TexturePacker atlas frames for Species, Forms, Genders, Shinies, and Facing.
 */

export class PokemonSpriteResolver {
  constructor(assetRepository = null) {
    this.assetRepo = assetRepository;
  }

  getGenerationBySpeciesId(speciesId) {
    const id = Number(speciesId);
    if (id <= 151) return 1;
    if (id <= 251) return 2;
    if (id <= 386) return 3;
    if (id <= 493) return 4;
    if (id <= 649) return 5;
    if (id <= 721) return 6;
    if (id <= 809) return 7;
    if (id <= 905) return 8;
    return 9;
  }

  /**
   * Resolves icon path according to generation and shiny status.
   */
  resolveIcon(speciesId, formKey = '', shiny = false) {
    const gen = this.getGenerationBySpeciesId(speciesId);
    const shinySuffix = shiny ? 's' : '';
    const formSuffix = formKey && formKey !== 'BASE' ? `-${formKey.toLowerCase()}` : '';
    const iconRelativePath = `images/pokemon/icons/${gen}/${speciesId}${formSuffix}${shinySuffix}.png`;

    return {
      speciesId,
      path: iconRelativePath,
      exists: this.assetRepo ? this.assetRepo.hasAsset(iconRelativePath) : true,
      category: 'ICON'
    };
  }

  /**
   * Resolves front/back sprite and atlas path according to species, form, gender, shiny, facing.
   */
  resolveSprite(speciesId, options = {}) {
    const {
      formKey = '',
      shiny = false,
      female = false,
      facing = 'front', // 'front' | 'back'
      variant = 0
    } = options;

    const id = Number(speciesId);
    const formPrefix = formKey && formKey !== 'BASE' ? `-${formKey.toLowerCase()}` : '';
    const baseFilename = `${id}${formPrefix}`;

    let dirParts = ['images', 'pokemon'];
    if (female) dirParts.push('female');
    if (shiny) dirParts.push('shiny');
    if (facing === 'back') dirParts.push('back');

    const imagePath = `${dirParts.join('/')}/${baseFilename}.png`;
    const atlasPath = `${dirParts.join('/')}/${baseFilename}.json`;

    const exists = this.assetRepo ? this.assetRepo.hasAsset(imagePath) : true;
    const atlasExists = this.assetRepo ? this.assetRepo.hasAsset(atlasPath) : true;

    return {
      speciesId: id,
      formKey,
      shiny,
      female,
      facing,
      variant,
      imagePath,
      atlasPath,
      exists,
      atlasExists,
      missing: !exists,
      frame: '0',
      sourceKey: `pokerogue-assets:${imagePath}`,
      targetRomFSGfxPath: `romfs/gfx/pokemon/${id}_${facing}${shiny ? '_shiny' : ''}.t3x`
    };
  }
}
