# 3DS UI Game Creation Studio — PokéRogue 3DS Edition

Visual IDE, authoring environment, deterministic battle engine, and C++/RomFS build pipeline for adapting **PokéRogue** to the **Nintendo 3DS** (devkitARM / Citro2D).

```text
POKÉROGUE UPSTREAM
(pokerogue, pokerogue-assets, pokerogue-locales)
        │
        ▼ [Frozen Git Revisions & Provenance Manifest]
ADAPTER & IMPORT PIPELINE
(PokerogueImporter, PokerogueManifest, ImportCache, ProvenanceReport)
        │
        ▼ [Canonical Lossless Models & Asset Resolvers]
DATA STUDIO & OVERRIDES
(Base Data + Studio Overrides = Final Build Data)
   ┌────┴────────────────────────┐
   ▼                             ▼
UI STUDIO (Dual Screen)     BATTLE LAB (Deterministic Sim)
- Top (400x240)             - Gen 9 Damage Breakdown
- Bottom (320x240)          - Phase Queue & Rule Resolvers
- 9 PokéRogue Components    - Explainable AI Inspector
- Interactive Preview       - Deterministic PRNG & Replay
   └────┬────────────────────────┘
        ▼
C++ & ROMFS BUILD PIPELINE
   ┌────┴────────────────────────┐
   ▼                             ▼
C++ Code Generator           RomFS Binary Exporter
(devkitARM / Citro2D)        (species.bin, moves.bin, VRAM/RAM Budget)
```

---

## 1. Quick Start

### Requisitos Previos
- **Node.js** (v18 o superior). Probado en Node v24.
- Navegador moderno (Chrome, Edge, Firefox).

### Iniciar el Studio IDE
```bash
# Iniciar el servidor local
npm start
# o:
node server.js
```
Abre en tu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

### Ejecutar Pruebas Automatizadas (100% Deterministas)
```bash
npm test
# o:
node test/run_tests.js
```

### Compilar RomFS Binario para Nintendo 3DS
```bash
npm run build:romfs
```

---

## 2. UI Studio (Entorno Visual Dual-Screen)

El UI Studio permite diseñar y previsualizar pantallas para el factor de forma dual de la Nintendo 3DS:
- **Pantalla Superior (Top Screen):** 400 × 240 píxeles.
- **Pantalla Inferior (Bottom Screen):** 320 × 240 píxeles con pantalla táctil resistiva.

### Catálogo de Componentes PokéRogue 3DS
1. **RogueBox:** Marco biselado estilizado con bordes característicos de PokéRogue.
2. **PixelText:** Texto tipográfico bitmap pixel-perfect con soporte para alineación y color.
3. **TouchButton:** Botón táctil para stylus y navegación por D-Pad con `FocusManager`.
4. **HealthBar:** Barra de vida reactiva con transición de colores (verde > 50%, amarillo > 20%, rojo <= 20%) y texto numérico entero.
5. **MoveButton:** Botón de movimiento en combate con tipo elemental, categoría (Físico/Especial/Estado) y PP restantes.
6. **StatusBadge:** Placa de condición de estado (`PAR`, `BRN`, `PSN`, `TOX`, `SLP`, `FRZ`, `FNT`).
7. **PokemonSprite:** Renderizador de sprites y mini-iconos reales de PokéRogue con variantes (front, back, shiny, female). Detecta recursos faltantes con banner **`MISSING ASSET`** (sin emojis falsos en producción).
8. **WaveIndicator:** Barra de progreso de oleadas (1 a 200), bioma actual y alerta visual en oleadas de jefes (múltiplos de 10).
9. **PokemonGrid:** Rejilla de selección de starters para la pantalla táctil inferior (coste en puntos, marca de variocolor, estadísticas base y navegación táctil/cruceta).

### Navegación y Atajos
- **`Ctrl+P`:** Búsqueda global instantánea en Especies, Movimientos, Habilidades, Pantallas y Recursos.
- **`Ctrl+Z` / `Ctrl+Y`:** Pila completa de Deshacer / Rehacer.
- **`🎮 Preview`:** Simulador interactivo 3DS con D-Pad, botones A/B/X/Y y pantalla táctil inferior.
- **`⚡ Generate C++`:** Generación de código fuente nativo C++ listo para devkitARM/Citro2D.

---

## 3. Data Studio (Datos Reales de PokéRogue)

El Data Studio sustituye cualquier simulación o mock hardcodeado por la ingestión directa de las fuentes oficiales de PokéRogue:

- **12 Categorías Completas:** Species, Forms, Moves, Abilities, Items, Natures, Types, Statuses, Biomes, Trainers, Encounters, Starters y Modifiers.
- **Lossless-First Import:** Toda propiedad no interpretable por el editor visual en una fase preliminar se conserva íntegra mediante `preserveRawData` y se audita en `unsupportedFeatures`.
- **Previsualización de Assets Reales:** Resolución de iconos generacionales (`images/pokemon/icons/<gen>/<id>.png`) y sprites mediante `PokemonSpriteResolver`.
- **Árbol de Dependencias:** Inspección interactiva bidireccional ("¿Qué se rompe si modifico esta especie o movimiento?").
- **Upstream Diff:** Comparador visual entre la versión congelada upstream de PokéRogue y las modificaciones activas.

---

## 4. Battle Lab (Motor de Combate Determinista 3DS)

El Battle Lab proporciona una simulación determinista exacta de combate Pokémon adaptada a las restricciones de la 3DS:

- **RNG Determinista:** Eliminación total de `Math.random()` y `Date.now()`. Generador LCG semillado (`RNG.js`) con numeración secuencial monotónica (`sequenceNumber`).
- **Desglose de Daño Gen 9:** Inspección paso a paso de cada variable:
  $$\text{Damage} = \left(\frac{2 \times \text{Level} / 5 + 2}{50} \times \text{Power} \times \frac{\text{Atk}}{\text{Def}} + 2\right) \times \text{STAB} \times \text{Type} \times \text{Crit} \times \text{Random}$$
- **Módulos Resolutores Independientes:**
  - `TurnOrderResolver`: Prioridad de movimientos y empates de velocidad deterministas.
  - `AccuracyResolver`: Precisión y evasión según etapas.
  - `DamageResolver`: Fórmulas Gen 9 con efectividad de tipos y STAB.
  - `AbilityResolver`: Habilidades complejas (`Static` inflige parálisis por contacto con 30% de probabilidad; `Sturdy` sobrevive golpes letales con 100% de salud).
  - `StatusResolver`: Restricción de movimiento por parálisis/sueño y daño residual por quemadura/veneno.
  - `AIAdapter`: Inteligencia artificial explicable con puntuación detallada por candidato y lista de motivos.
- **Pila de Fases:** Procesamiento atómico en cola (`SpeedOrderPhase`, `ActionPhase`, `TurnEndPhase`).
- **Replay y Snapshots:** Pausa, avance paso a paso y rebobinado completo a cualquier turno del combate.

---

## 5. Pipeline de Importación y Proveniencia

### Configuración de Fuentes Congeladas (`project/external/pokerogue.json`)
Las fuentes se gestionan como dependencias externas versionadas con hashes de commit congelados:
```json
{
  "source": {
    "repository": "https://github.com/pagefaultgames/pokerogue",
    "branch": "beta",
    "revision": "8555c08c823b856cbec4eb99ca84ea52a955836d"
  },
  "assets": {
    "repository": "https://github.com/pagefaultgames/pokerogue-assets",
    "branch": "beta",
    "revision": "87426a79611f9d212c4dc8af58e2834a05b93725"
  },
  "locales": {
    "repository": "https://github.com/pagefaultgames/pokerogue-locales",
    "branch": "main",
    "revision": "23aea1cb0da5a0b15b836f3c243791591cc42303"
  }
}
```

### Cumplimiento de Licencias (`provenance-report.json`)
- El código original de PokéRogue está bajo licencia **AGPL-v3.0-only**. Nuestro importador lee, normaliza y transforma la información en modelos canónicos en lugar de duplicar clases TypeScript directamente.
- Los assets siguen el estándar **REUSE**.
- Cada entidad importada almacena su repositorio de origen, ruta, revisión congelada y referencia de licencia.

---

## 6. Sistema de Overrides (No Destructivo)

Para adaptar PokéRogue a las limitaciones de memoria y balance específico de la 3DS, el Studio implementa una arquitectura en tres capas:

$$\text{PokéRogue Upstream (Base Data)} \;\;+\;\; \text{Studio Override} \;\;=\;\; \text{Final Build Data}$$

- Los archivos upstream nunca se modifican directamente.
- Las sobreescrituras se guardan en `project/external/overrides.json`.
- La pantalla de diff permite auditar qué parámetros de una especie (PS base, ataques aprendidos, coste de starter) han sido ajustados localmente para 3DS.

---

## 7. Pipeline de Compilación RomFS y Generación C++

### Formato Binario Compacto para Citro2D (`RomFS/data/`)
En lugar de procesar TypeScript en runtime en la 3DS, el Studio empaqueta tablas binarias ultra-compactas con acceso $O(1)$:
- **`species.bin`:** Registros binarios de 24 bytes (ID, tipos, estadísticas base PS/Ataque/Defensa/At.Esp/Def.Esp/Velocidad, IDs de habilidades).
- **`moves.bin`:** Registros binarios de 12 bytes (ID, tipo, categoría, potencia, precisión, PP, prioridad, máscaras de flags de contacto y código de efecto secundario).
- **`manifest.json`:** Manifiesto determinista exportado sin timestamps para garantizar builds reproducibles (Git diff limpio).

### Presupuesto de Hardware 3DS (`Resource Budget`)
El sistema calcula en tiempo real las restricciones del hardware:
- **VRAM (PICA200):** Límite máximo de 6 MB para texturas y atlas.
- **RAM Lineal:** Límite de 96 MB de memoria de aplicación en consolas Old 3DS.
- **Draw Calls:** Conteo estimado de llamadas de dibujado simultáneas en pantalla superior e inferior.

### Generador C++ Determinista
Genera clases C++ (`.hpp` y `.cpp`) para `devkitARM` y la librería gráfica `Citro2D`:
- Salida determinista ordenada por `zIndex` y alfabéticamente por `id`.
- Conversión de colores al formato nativo Citro2D `0xAABBGGRR`.
- Vinculación automática de widgets con `FocusManager` y bucle de dibujado dual (`drawTop` / `drawBottom`).

---

## 8. Arquitectura de Directorios

```text
3ds_GUI/
├── package.json                         # Dependencias, scripts (start, test, build:romfs)
├── server.js                            # Servidor local con API REST, proxy de assets y exportación
├── README.md                            # Esta documentación completa
│
├── project/
│   ├── external/                        # Integración con repositorios de PokéRogue
│   │   ├── pokerogue.json               # Configuración de repositorios y revisiones congeladas
│   │   ├── manifest.json                # Manifiesto de proveniencia determinista
│   │   ├── provenance-report.json       # Auditoría de licencias AGPL-3.0 / REUSE
│   │   ├── overrides.json               # Sobreescrituras de balance locales 3DS
│   │   └── cache/                       # Caché de assets descargados
│   ├── screens/                         # Definiciones de pantallas en formato JSON
│   │   ├── ExampleScreen.json           # Pantalla de menú inicial
│   │   └── StarterSelectScreen.json     # Pantalla de selección de Starters (Vertical Slice 2)
│   └── generated/                       # Salida generada por el Studio
│       ├── include/screens/             # Cabeceras C++ (.hpp)
│       ├── src/screens/                 # Fuentes C++ (.cpp)
│       └── romfs/data/                  # Tablas binarias empaquetadas (species.bin, moves.bin)
│
├── public/                              # Frontend del Game Creation Studio
│   ├── index.html                       # Shell del IDE (Header, Canvas dual, Paneles, Modales)
│   ├── css/main.css                     # Estilos tema Game Studio (Data Studio, Battle Lab, Inspector)
│   └── js/
│       ├── core/                        # Núcleo del editor (ProjectModel, Transform, PropertySystem)
│       ├── components/                  # Catálogo de 9 componentes UI para 3DS
│       ├── editor/                      # Renderizado en canvas, selección y jerarquía
│       ├── preview/                     # Simulador 3DS interactivo
│       ├── data/                        # Modelos canónicos, importador, proveniencia y Data Studio
│       ├── battle/                      # Motor de combate determinista, Battle Lab y resolutores
│       └── generator/                   # Generador C++ (CodeGenerator) y empaquetador binario (RomFSExporter)
│
├── scripts/
│   └── build_romfs.js                   # Script CLI para empaquetado de RomFS y cálculo de memoria
│
└── test/
    └── run_tests.js                     # Suite de pruebas automatizadas (30/30 tests)
```
