/**
 * Upstream Enums and Locales Fixtures for Offline Automated Tests.
 * Derived directly from frozen upstream PokéRogue commits:
 * - pokerogue: 8555c08c823b856cbec4eb99ca84ea52a955836d
 * - pokerogue-locales: 23aea1cb0da5a0b15b836f3c243791591cc42303
 *
 * CRITICAL: These are strictly test fixtures for automated testing without network access.
 * IT MUST NEVER BE TREATED AS PRODUCTION DATA.
 * Source tag: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION'
 */

export const UPSTREAM_SPECIES_ENUM_FIXTURE = `
export enum SpeciesId {
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Bulbasaur_(Pokémon) | Source} */
  BULBASAUR = 1,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Ivysaur_(Pokémon) | Source} */
  IVYSAUR,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Venusaur_(Pokémon) | Source} */
  VENUSAUR,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Charmander_(Pokémon) | Source} */
  CHARMANDER,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Charmeleon_(Pokémon) | Source} */
  CHARMELEON,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Charizard_(Pokémon) | Source} */
  CHARIZARD,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Squirtle_(Pokémon) | Source} */
  SQUIRTLE,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Wartortle_(Pokémon) | Source} */
  WARTORTLE,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Blastoise_(Pokémon) | Source} */
  BLASTOISE,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Pikachu_(Pokémon) | Source} */
  PIKACHU = 25,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Raichu_(Pokémon) | Source} */
  RAICHU,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Geodude_(Pokémon) | Source} */
  GEODUDE = 74,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Graveler_(Pokémon) | Source} */
  GRAVELER,
  /**{@link https://bulbapedia.bulbagarden.net/wiki/Golem_(Pokémon) | Source} */
  GOLEM,
  ALOLA_RATTATA = 2019,
  ALOLA_RATICATE = 2020
}
`;

export const UPSTREAM_MOVE_ENUM_FIXTURE = `
export enum MoveId {
  NONE,
  POUND,
  KARATE_CHOP,
  DOUBLE_SLAP,
  COMET_PUNCH,
  MEGA_PUNCH,
  PAY_DAY,
  FIRE_PUNCH,
  ICE_PUNCH,
  THUNDER_PUNCH,
  SCRATCH,
  TACKLE = 33,
  BODY_SLAM,
  TAKE_DOWN,
  DOUBLE_EDGE,
  THUNDERBOLT = 85,
  EARTHQUAKE = 89,
  QUICK_ATTACK = 98,
  ROCK_SLIDE = 157
}
`;

export const UPSTREAM_ABILITY_ENUM_FIXTURE = `
export enum AbilityId {
  NONE,
  STENCH,
  DRIZZLE,
  SPEED_BOOST,
  BATTLE_ARMOR,
  STURDY,
  DAMP,
  LIMBER,
  SAND_VEIL,
  STATIC,
  VOLT_ABSORB,
  WATER_ABSORB,
  OBLIVIOUS,
  CLOUD_NINE,
  COMPOUND_EYES,
  INSOMNIA
}
`;

export const UPSTREAM_TYPE_ENUM_FIXTURE = `
export enum PokemonType {
  UNKNOWN = -1,
  NORMAL = 0,
  FIGHTING,
  FLYING,
  POISON,
  GROUND,
  ROCK,
  BUG,
  GHOST,
  STEEL,
  FIRE,
  WATER,
  GRASS,
  ELECTRIC,
  PSYCHIC,
  ICE,
  DRAGON,
  DARK,
  FAIRY,
  STELLAR
}
`;

export const UPSTREAM_LOCALES_FIXTURE = {
  source: 'TEST_FIXTURE_DO_NOT_USE_IN_PRODUCTION',
  en: {
    move: {
      thunderbolt: {
        name: 'Thunderbolt',
        effect: 'The user attacks the target with a strong electric blast. This move has a 10% chance of paralyzing the target.'
      },
      tackle: {
        name: 'Tackle',
        effect: 'A physical attack in which the user charges and slams into the target with its whole body.'
      },
      quickAttack: {
        name: 'Quick Attack',
        effect: 'The user lunges at the target at a speed that makes it almost invisible. This move always goes first.'
      },
      earthquake: {
        name: 'Earthquake',
        effect: 'The user sets off an earthquake that strikes every Pokémon around it.'
      },
      rockSlide: {
        name: 'Rock Slide',
        effect: 'Large boulders are hurled at opposing Pokémon to inflict damage. This may also make opposing Pokémon flinch.'
      }
    },
    ability: {
      static: {
        name: 'Static',
        description: 'The Pokémon is charged with static electricity and has a 30% chance to paralyze attackers that hit it with a contact move.'
      },
      sturdy: {
        name: 'Sturdy',
        description: 'It cannot be knocked out with one hit if at full HP.'
      }
    },
    pokemon: {
      pikachu: 'Pikachu',
      golem: 'Golem',
      bulbasaur: 'Bulbasaur'
    }
  },
  es: {
    move: {
      thunderbolt: {
        name: 'Rayo',
        effect: 'Ataque eléctrico con una potente descarga eléctrica. Tiene una probabilidad del 10 % de paralizar al objetivo.'
      },
      tackle: {
        name: 'Placaje',
        effect: 'Ataque físico con embestida corporal que causa daño.'
      },
      quickAttack: {
        name: 'Ataque Rápido',
        effect: 'Ataque fulgurante que permite golpear en primer lugar.'
      },
      earthquake: {
        name: 'Terremoto',
        effect: 'Fuerte temblor de tierra que afecta a los Pokémon adyacentes.'
      },
      rockSlide: {
        name: 'Avalancha',
        effect: 'Lanza grandes pedruscos contra el oponente que pueden amedrentarlo.'
      }
    },
    ability: {
      static: {
        name: 'Electricidad Estática',
        description: 'La electricidad estática que lo envuelve puede paralizar al Pokémon que lo ataque con un movimiento de contacto con un 30% de posibilidad.'
      },
      sturdy: {
        name: 'Robustez',
        description: 'Evita caer fulminado de un solo golpe si tiene los PS al máximo.'
      }
    },
    pokemon: {
      pikachu: 'Pikachu',
      golem: 'Golem',
      bulbasaur: 'Bulbasaur'
    }
  }
};
