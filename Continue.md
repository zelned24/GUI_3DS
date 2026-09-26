# Continue.md — Estado de BETA-UI-5 y Hoja de Ruta Pendiente

**Repositorio:** `zelned24/GUI_3DS`  
**Milestone:** BETA-UI-5 (Production Asset System + Runtime Resource Cache + Scene Playback)  
**Estado Actual:** 119 tests PASS, 0 FAIL, 15 BLOCKED (toolchains externos de devkitARM/tex3ds reservados para CI en GitHub Actions).

---

## 1. Lo que ya está implementado y verificado en BETA-UI-5

### A. Asset Provenance & Real Content Integrity
- **Physical Content SHA-256**: Eliminados los hashes simulados o rutas fijadas con cadena. El cálculo de integridad se realiza leyendo los bytes físicos del archivo (`AssetIndex.computeContentSha256`), garantizando que cualquier cambio de 1 solo byte genere un hash distinto y falle el packaging (verificado en `BETA-UI-5.1` y `BETA-UI-5.19`).
- **Contrato de Provenance Completo**: Cada asset exportable responde con los 10 atributos obligatorios (`id`, `type`, `sourcePath`, `sourceRepository`, `sourceRevision`, `contentSha256`, `dimensions`, `format`, `target3DS`, `romfsPath`).
- **Estados de Disponibilidad Claros**: Los assets se clasifican con estados explícitos: `AVAILABLE`, `MISSING`, `INVALID`, `UNSUPPORTED`. Si el archivo no existe en disco o está corrupto, nunca se marca como disponible.

### B. Asset Index V2 & Asset Browser V2
- **Índice Determinista**: Generación de `project/data/assets/asset-index.json` ordenado alfabéticamente por `assetId`, reproducible byte a byte, sin timestamps ni identificadores aleatorios.
- **Reportes de Integridad Automatizados**:
  - `asset-integrity-report.json`: Registra conteo total, verificados, faltantes, inválidos y bytes físicos.
  - `runtime-metrics.json`: Establece presupuestos de rendimiento y telemetría baseline.
- **Búsqueda y Filtros Multicriterio**: El `AssetBrowser` filtra por categoría (`pokemon`, `backgrounds`, `ui`, `items`, `effects`, `audio`), tipo, pantalla, dimensiones y atributos específicos de Pokémon (`nationalDexId`, `species`, `facing`, `shiny`).

### C. Runtime Resource Cache (`RuntimeAssetManager` en C++)
- **Carga Única y Deduplicación**: Lookup en manifiesto `SceneAssets` y caché C2D. Si 20 nodos referencian el mismo asset (ej. `pokemon_sprite_25_front`), se realiza **1 sola carga física** y los 20 nodos comparten la textura con conteo de referencias (`refCount == 20`, 19 cache hits).
- **Eliminación de Load/Free por Frame**: Se eliminaron las llamadas a `C2D_SpriteSheetLoad` y `C2D_SpriteSheetFree` dentro del bucle de renderizado. Además, `Renderer2D` prealoca y reutiliza `m_textBuf`, eliminando las alocaciones dinámicas por frame.
- **Gestión de Ciclo de Vida**: Métodos `init()`, `preload(assetId)`, `get(assetId)`, `release(assetId)`, `releaseAll()`, `fini()`. Al llegar el `refCount` a 0 se libera el recurso.
- **Diagnóstico y Telemetría**: Registro de errores específicos (`AssetNotFound`, `AssetManifestInvalid`, `AssetFileMissing`, `AssetLoadFailed`, `UnsupportedFormat`) y contadores de rendimiento (`loadedAssetCount`, `cacheHitCount`, `cacheMissCount`, `physicalLoadCount`, `drawCallCount`, `activeNodeCount`, `activeTrackCount`).

### D. Scene Playback Controller (`ScenePlayer` en C++)
- **Ciclo de Vida Completo**: `load()`, `enter()`, `play()`, `pause()`, `stop()`, `seek(frame)`, `update(dt)`, `renderTop()`, `renderBottom()`, `exit()`.
- **Preload en Scene Enter**: Al invocar `enter()`, `ScenePlayer` recolecta todos los assets necesarios de la escena y los precarga en el `RuntimeAssetManager` antes de renderizar el primer frame.
- **Autoridad Temporal Entera**: El progreso temporal se basa estrictamente en `uint32_t currentFrame` a 60 FPS fijos sin deriva de punto flotante.
- **Contrato de Escala de Texturas (Section 35)**: Conversión normalizada mediante `calculateTextureScale` para que el tamaño de los nodos en píxeles coincida con los factores de escala de Citro2D (comprobado en escalas 1.0, 0.5, 2.0 y volteo flipX/flipY).
- **Paridad C++ / JS**: El evaluador nativo y el preview JS coinciden al 100% en todas las curvas de interpolación (`linear`, `step`, `easeIn`, `easeOut`, `easeInOut`).

---

## 2. Lo que falta implementar o extender para la Fase Final de Build 5

1. **Ingestión Masiva de Assets Upstream (CI / Local Cache)**:
   - Actualmente el índice cuenta con los assets canónicos del core y vertical slice (Pikachu, Bulbasaur, Charizard, Golem, Gengar, Lucario, escenarios, UI y audio).
   - Falta el script/worker para clonar o descargar bajo demanda el catálogo completo de ~1000 especies desde el repositorio fijado `pokerogue-assets` (commit `056a1f408f26a3be4fef243f7462cb43608c7928`) a un cache local de artefactos, sin saturar el tamaño del repositorio git.

2. **Pipeline de Conversión de Audio Hardware (WAV -> BCSTM)**:
   - La integridad de audio y su resolución en `romfs/audio/*.bcstm` están validadas lógicamente.
   - En el pipeline de empaquetado de assets de RomFS, integrar la herramienta nativa de codificación BCSTM de devkitPro (`soundstat` o convertidor DSP) cuando se ejecute en el contenedor de CI.

3. **Pruebas de Estrés y Medición de VRAM en Hardware Real / Citra**:
   - Instrumentar la medición del límite físico de VRAM (VRAM-A/B en 3DS es de 6MB total).
   - Generar un informe de advertencia en el Studio si la suma de texturas precargadas en una escena excede el presupuesto seguro de VRAM de la consola (ej. > 4MB).

4. **Soporte de Múltiples Variantes de Sprite (Animación Frame-by-Frame)**:
   - Soporte para spritesheets que contengan múltiples frames de animación por especie (idle, attack, faint) dentro del mismo archivo `.t3x`.

---

## 3. Estado de Ejecución Local
- Servidor local activo en `http://localhost:3000`.
- API REST funcional: `/api/project`, `/api/project/save`, `/api/generate-cpp`.
- `npm test`: 119 PASSED, 0 FAILED.
- `npm run native-parity`: 42 checks PASSED (100% de paridad matemática).
