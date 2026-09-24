# Plan Maestro — 3DS UI Game Creation Studio

## 1. Objetivo del proyecto

Construir un IDE visual local para diseñar, animar, probar y exportar interfaces de Nintendo 3DS destinadas a PokéRogue, evitando recompilar el proyecto completo después de cada cambio visual.

El Studio debe permitir:

**Diseñar → previsualizar → animar → validar → generar C++ → empaquetar assets → compilar → probar en Azahar/3DS**

El objetivo principal no es crear un editor gráfico genérico, sino un **entorno especializado para UI de PokéRogue 3DS**, con componentes reutilizables y generación determinista de código.

El sistema debe trabajar con:

- Pantalla superior: 400×240.
- Pantalla inferior: 320×240.
- Coordenadas enteras.
- Assets optimizados para RomFS.
- Renderizado compatible con Renderer2D/Citro2D.
- Navegación por cruceta, botones físicos y táctil.
- Animaciones calculadas de forma eficiente en ARM11.

La arquitectura debe mantener una separación estricta entre:

**Editor → Proyecto UI → Preview Runtime → Code Generator → Asset Pipeline → Build System**

---

# 2. Arquitectura general

```text
┌─────────────────────────────────────────────────────────┐
│              3DS UI GAME CREATION STUDIO               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  UI Editor                                              │
│  ├── Dual Canvas                                        │
│  ├── Component Toolbox                                  │
│  ├── Inspector                                           │
│  ├── Layers / Hierarchy                                 │
│  ├── Timeline                                           │
│  └── Figma Overlay                                      │
│                                                         │
│  Project Model                                          │
│  ├── Screens                                             │
│  ├── Components                                          │
│  ├── Styles                                              │
│  ├── Animations                                          │
│  ├── Input / Focus                                       │
│  └── Assets                                              │
│                                                         │
│  Preview Runtime                                        │
│  ├── 2D Renderer                                         │
│  ├── Touch Simulation                                   │
│  ├── Controller Simulation                               │
│  └── Animation Runtime                                   │
│                                                         │
│  Export Pipeline                                        │
│  ├── C++ Generator                                      │
│  ├── Texture Atlas Generator                            │
│  ├── Index Generator                                    │
│  ├── Audio Definitions                                  │
│  └── Build Integration                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
                 Nintendo 3DS Project
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        C++ / devkitARM          RomFS
        Screen.hpp/.cpp          .t3x / audio
              │                     │
              └──────────┬──────────┘
                         ▼
                    Azahar / 3DS
```

---

# 3. Principio fundamental: el editor no debe almacenar código

El usuario diseña una pantalla mediante objetos visuales.

El Studio guarda un **modelo declarativo**, no C++ generado.

Ejemplo conceptual:

```json
{
  "screen": "BattleScreen",
  "size": {
    "top": [400, 240],
    "bottom": [320, 240]
  },
  "components": [
    {
      "id": "enemy_hp",
      "type": "HealthBar",
      "screen": "top",
      "x": 220,
      "y": 32,
      "width": 150,
      "height": 12
    }
  ]
}
```

Esto permite modificar una pantalla cientos de veces sin convertir el proyecto en una colección de archivos C++ difíciles de sincronizar.

El C++ debe ser simplemente un **artefacto generado**.

---

# 4. Estructura del proyecto

Cada proyecto del Studio deberá tener una estructura similar a:

```text
project/
├── screens/
│   ├── battle.json
│   ├── starter_select.json
│   ├── settings.json
│   └── rewards.json
│
├── components/
│   └── presets/
│
├── assets/
│   ├── images/
│   └── audio/
│
├── animations/
│   └── presets/
│
├── styles/
│   ├── pokemon.json
│   └── rogue.json
│
├── generated/
│   ├── include/screens/
│   ├── src/screens/
│   └── generated_indices.hpp
│
└── project.json
```

El usuario nunca debería necesitar editar manualmente los archivos generados.

---

# 5. Sistema de pantallas

Cada Screen tendrá:

- nombre único;
- pantalla objetivo: Top / Bottom / Dual;
- dimensiones;
- componentes;
- jerarquía;
- capas;
- variables;
- eventos;
- estados;
- animaciones;
- navegación;
- hitboxes;
- sonidos;
- assets asociados.

Ejemplo:

```text
BattleScreen
│
├── Background
├── EnemyArea
│   ├── EnemySprite
│   ├── HealthBar
│   └── StatusBadge
│
├── PlayerArea
│   ├── PlayerSprite
│   ├── HealthBar
│   └── ExpBar
│
├── BattleMessageBox
│
└── BottomMenu
    ├── MoveButton 1
    ├── MoveButton 2
    ├── MoveButton 3
    └── MoveButton 4
```

La jerarquía será editable visualmente mediante un panel tipo árbol.

---

# 6. Toolbox especializada de PokéRogue

La biblioteca propuesta originalmente debe mantenerse, pero cada componente deberá tener tres capas:

### A. Apariencia

Define:

- posición;
- tamaño;
- fuente;
- textura;
- colores;
- bordes;
- escalado;
- alineación.

### B. Comportamiento

Define:

- eventos;
- interacción;
- animaciones;
- focus;
- touch;
- estados.

### C. Datos

Define los valores dinámicos.

Por ejemplo:

```text
HealthBar
├── maxHP
├── currentHP
├── animationSpeed
├── colorThresholds
├── style
└── sourceVariable
```

De esta manera una HealthBar puede reutilizarse en múltiples pantallas sin duplicar código.

---

# 7. Componentes principales

## Combate

- HealthBar
- ExpBar
- StatusBadge
- TypeBadge
- MoveButton
- BattleMessageBox
- PokemonSprite
- DamageNumber
- BattleMenu
- TurnIndicator
- TargetSelector

## Starter Select

- PokemonGrid
- PokemonSlot
- GenerationTabs
- StatRadar
- IVBarList
- CostMeter
- ShinyIndicator
- LockedIndicator

## Roguelike / Rewards

- WaveIndicator
- RewardCard
- InventorySlot
- ItemGrid
- CurrencyDisplay
- RarityBadge

## Menús

- RogueBox
- PixelText
- TouchButton
- ScrollView
- SelectorFrame
- Toggle
- Slider
- Tab
- Modal
- Tooltip

Los componentes existentes del documento, como HealthBar, MoveButton, PokemonGrid, RewardCard, RogueBox y SelectorFrame, pasan a formar parte de esta biblioteca reutilizable.

---

# 8. Dual Canvas

El editor debe representar simultáneamente:

```text
       TOP — 400 × 240

┌──────────────────────────────────────┐
│                                      │
│                                      │
│                                      │
└──────────────────────────────────────┘

               ║ BISAGRA ║

          BOTTOM — 320 × 240

        ┌──────────────────────┐
        │                      │
        │                      │
        │                      │
        └──────────────────────┘
```

Debe existir un selector:

- Top
- Bottom
- Dual View

Y un zoom:

- 1×
- 2×
- 3×
- 4×
- Fit

El documento original ya establece el canvas dual y el renderizado píxel-perfecto como una capacidad central.

---

# 9. Reglas de layout específicas de 3DS

El editor debe impedir o advertir automáticamente:

- coordenadas fraccionarias;
- tamaños no enteros;
- elementos fuera de pantalla;
- texturas excesivamente grandes;
- hitboxes fuera de la pantalla táctil;
- solapamientos accidentales;
- escalado no entero cuando pueda producir pérdida de nitidez.

Agregar un **3DS Validation Panel**:

```text
✓ Resolución válida
✓ Coordenadas enteras
✓ Hitboxes dentro del display
✓ Assets encontrados
✓ Atlas generado
✓ IDs únicos
⚠ Elemento parcialmente fuera de pantalla
✕ Asset no encontrado
✕ ID duplicado
```

Esto evita descubrir errores después de generar el C++.

---

# 10. Inspector de propiedades

Al seleccionar un componente:

```text
┌ Inspector ───────────────────────┐
│ HealthBar                        │
│                                  │
│ Position                         │
│ X        [220]                   │
│ Y        [ 32]                   │
│                                  │
│ Size                             │
│ W        [150]                   │
│ H        [ 12]                   │
│                                  │
│ Style                            │
│ Background [dark_panel]          │
│ Foreground [hp_green]            │
│ Border     [rogue_border]        │
│                                  │
│ Animation                        │
│ Speed    [120]                   │
│                                  │
│ Interaction                      │
│ Touch    [✓]                     │
│ Focus    [✓]                     │
└──────────────────────────────────┘
```

Todas las propiedades deben poder modificarse mediante:

- campo numérico;
- slider;
- selector;
- color picker;
- dropdown;
- checkbox;
- edición directa en canvas.

---

# 11. Sistema de Layers / Hierarchy

El sistema de capas debe ser independiente del Z-index numérico.

Ejemplo:

```text
CURSOR
UI_OVERLAY
UI_TEXT
UI_PANEL
SPRITE_FRONT
SPRITE_BACK
BACKGROUND
```

El usuario podrá arrastrar componentes dentro del árbol para modificar su profundidad.

La exportación resolverá posteriormente los valores de `RenderDepth`.

---

# 12. Sistema de estilos reutilizables

Agregar **Style Presets**.

Ejemplo:

```text
RogueBox
├── Rogue Default
├── Settings Blue
├── Reward Gold
└── Battle Dark
```

Un estilo podrá controlar:

- colores;
- bordes;
- radios;
- sombras;
- fuentes;
- padding;
- alineación.

Así, cambiar el estilo de 50 botones no requiere editarlos individualmente.

---

# 13. Drag & Drop de assets

Mantener el pipeline propuesto de PNG/WAV, pero añadir una capa de validación antes de copiar el archivo.

Flujo:

```text
DROP FILE
   ↓
Detectar tipo
   ↓
Validar formato
   ↓
Detectar categoría
   ↓
Mostrar preview
   ↓
Solicitar/confirmar ubicación
   ↓
Copiar a assets
   ↓
Actualizar atlas
   ↓
Actualizar índices
```

Para imágenes:

```text
PNG
 ↓
metadata
 ↓
categoría
 ↓
atlas
 ↓
índice C++
```

Para audio:

```text
WAV / DSPADPCM / MP3
 ↓
validación
 ↓
romfs/audio/sfx
 ↓
SoundEffect enum
 ↓
event binding
```

El documento ya contempla clasificación automática, empaquetado en atlas y generación de constantes C++.

---

# 14. Asset Manager

Agregar una ventana específica:

```text
ASSET MANAGER

Images       842
Audio        126
Atlases       14
Unused        23
Missing        2
```

Funciones:

- buscar;
- filtrar;
- preview;
- detectar assets sin uso;
- detectar referencias rotas;
- reemplazar asset;
- localizar dónde se usa;
- regenerar atlas.

Esto evita que el proyecto acumule archivos obsoletos.

---

# 15. Editor de animaciones

El Timeline debe soportar:

```text
Position
Scale
Rotation
Opacity
Color
Progress
Custom Property
```

Y curvas:

- Linear
- Ease In
- Ease Out
- Ease In/Out
- Sine
- Quadratic
- Cubic
- Exponential

Además de los presets originales:

- Slide
- Pulse
- Damage Shake
- HP Drain

Estas animaciones ya aparecen definidas en el plan original mediante funciones matemáticas ligeras como `sin`, `exp` y `cos`.

---

# 16. Animation Presets

Crear una biblioteca reutilizable:

```text
Animations
├── slide_in_left
├── slide_in_right
├── fade_in
├── pulse
├── damage_shake
├── hp_drain
├── cursor_blink
└── menu_pop
```

Una animación debe poder guardarse y aplicarse a múltiples componentes.

---

# 17. Sistema de eventos

Agregar un Event Graph sencillo:

```text
OnEnter
   ↓
PlayAnimation("slide_in")
   ↓
PlaySound("menu_open")
```

Otro ejemplo:

```text
OnButtonPress
   ↓
PlaySound("select")
   ↓
SetState("CONFIRM")
   ↓
TransitionTo("RewardScreen")
```

Eventos mínimos:

- OnEnter
- OnExit
- OnPress
- OnRelease
- OnFocus
- OnBlur
- OnSelectionChange
- OnTouch
- OnAnimationComplete
- OnStateChange

Esto conecta el diseño visual con el comportamiento sin obligar al diseñador a escribir lógica manual.

---

# 18. FocusManager visual

El usuario debe poder definir gráficamente las relaciones:

```text
      [Move 1]
          ↓
[Move 4] ←→ [Move 2]
          ↑
      [Move 3]
```

Cada componente interactivo tendrá:

```text
Focus Up
Focus Down
Focus Left
Focus Right
```

El Studio podrá generar automáticamente la navegación para grids y listas, pero siempre deberá permitir sobrescribirla manualmente.

---

# 19. Preview Runtime

Este punto debe ser central.

El preview no debería limitarse a dibujar cajas. Debe ejecutar una versión ligera del runtime de UI.

El usuario podrá probar:

- navegación;
- botones;
- touch;
- animaciones;
- focus;
- timers;
- cambios de estado;
- sonidos;
- scrolling.

Controles de simulación:

```text
[D-PAD]
[A] [B] [X] [Y]
[L] [R]
[TOUCH AREA]
```

También debe existir:

**Play / Pause / Restart**

para las animaciones.

---

# 20. Debug Overlay

Agregar un modo de diagnóstico:

```text
FPS: 60
Draw Calls: 34
Sprites: 71
Textures: 9
Memory Estimate: ...
Current State: MENU
Focused ID: move_02
Touch: 143, 88
```

Además:

- mostrar bounding boxes;
- mostrar anchors;
- mostrar hitboxes;
- mostrar nombres de componentes;
- mostrar Z-order;
- mostrar puntos de origen.

Este modo será especialmente útil para depurar rápidamente sin recompilar el proyecto completo.

---

# 21. Generador C++

El generador debe convertir el modelo declarativo en:

```text
include/screens/BattleScreen.hpp
src/screens/BattleScreen.cpp
```

con una estructura consistente:

```cpp
class BattleScreen : public Screen
{
public:
    void init() override;
    void enter() override;
    void handleInput(const InputManager& input) override;
    void update(float dt) override;
    void drawTop(Renderer2D& renderer) override;
    void drawBottom(Renderer2D& renderer) override;
};
```

El documento original ya define esta división entre header/source y los métodos principales `init`, `enter`, `handleInput`, `update`, `drawTop` y `drawBottom`.

---

# 22. Generación determinista

El mismo proyecto debe producir siempre el mismo resultado.

Reglas:

- IDs estables;
- orden estable de componentes;
- generación reproducible;
- imports deterministas;
- nombres de variables deterministas.

Ejemplo:

```text
HealthBar enemyHP
MoveButton moveButton01
MoveButton moveButton02
MoveButton moveButton03
```

Nunca generar nombres aleatorios.

Esto simplifica Git, debugging y comparación de cambios.

---

# 23. Integración con Git

El proyecto debe ser completamente versionable.

Guardar:

- `.json` de pantallas;
- presets;
- estilos;
- configuraciones;
- metadata.

Evitar versionar archivos temporales del editor.

También sería útil un modo:

```text
Generate All
Generate Current Screen
Generate Assets
Generate Everything
```

---

# 24. Exportación incremental

No regenerar todo ante cada modificación.

Ejemplo:

```text
Cambio BattleScreen
        ↓
Regenerar BattleScreen.cpp
        ↓
¿Cambió algún asset?
        ↓
No
        ↓
No reconstruir atlas
```

Solo deben ejecutarse las tareas afectadas.

Esto ataca directamente uno de los problemas iniciales del proyecto: el tiempo perdido compilando pequeños cambios visuales.

---

# 25. Build Pipeline

Crear un Build Manager dentro del Studio:

```text
[Generate]
[Build]
[Launch Azahar]
[Build + Launch]
```

Pipeline:

```text
Validate
   ↓
Generate C++
   ↓
Generate indices
   ↓
Build atlases
   ↓
Build project
   ↓
Launch emulator
```

Si una etapa falla:

```text
Build failed

Screen: BattleScreen
File: BattleScreen.cpp
Line: 143
Reason: Asset "status_par" not found
```

---

# 26. Integración con Azahar

Agregar botón:

**Run in Azahar**

Opcionalmente:

**Build + Launch**

El objetivo será conseguir este ciclo:

```text
Modificar UI
↓
Guardar
↓
Generate
↓
Build
↓
Launch
```

con la menor intervención manual posible.

---

# 27. Sistema Undo / Redo

Debe incorporarse desde la primera versión.

Acciones:

- mover;
- redimensionar;
- borrar;
- duplicar;
- cambiar propiedad;
- cambiar layer;
- modificar estilo;
- aplicar animación.

Atajos:

```text
Ctrl+Z
Ctrl+Shift+Z
Ctrl+C
Ctrl+V
Ctrl+D
Delete
```

No conviene dejar Undo/Redo para una fase posterior porque afecta directamente la arquitectura del editor.

---

# 28. Copiar / pegar componentes

Permitir:

```text
Copy Component
Paste Component
Duplicate
Copy Style
Paste Style
Copy Animation
Paste Animation
```

Esto acelerará mucho la construcción de pantallas repetitivas.

---

# 29. Plantillas de pantallas

Agregar templates:

```text
Battle
Starter Select
Settings
Reward Shop
Inventory
Pause Menu
Pokemon Info
Evolution
Results
```

Cada template contendrá:

- layout inicial;
- componentes;
- estilos;
- focus;
- animaciones básicas.

Esto convierte el Studio en una herramienta de producción, no solo de prototipado.

---

# 30. Sistema de datos dinámicos

El diseñador no debe hardcodear valores como:

```text
125 / 125
15 / 15
Wave 14
Cost 8 / 10
```

Debe poder utilizar bindings:

```text
{pokemon.current_hp}
{pokemon.max_hp}
{move.pp}
{run.wave}
{run.cost}
{pokemon.name}
```

Ejemplo:

```text
HealthBar.current = pokemon.current_hp
HealthBar.max = pokemon.max_hp
```

La UI queda visualmente diseñada mientras los datos reales llegan desde el juego.

---

# 31. Estados de UI

Cada componente interactivo podrá tener:

```text
Normal
Focused
Pressed
Disabled
Hidden
Selected
```

Y los botones podrán definir apariencia independiente para cada estado.

Esto será especialmente importante para TouchButton y SelectorFrame.

---

# 32. Validación antes de exportar

Antes de generar código:

```text
PROJECT VALIDATION

✓ Todas las pantallas tienen IDs únicos
✓ Todos los assets existen
✓ Todas las animaciones son válidas
✓ Todas las referencias están resueltas
✓ Todos los componentes tienen posición válida
✓ Focus graph válido
✓ Touch hitboxes válidas
✓ No existen nombres duplicados

[EXPORT]
```

Si existe un error, el botón de exportación deberá indicar exactamente dónde está.

---

# 33. Testing

Crear pruebas para tres niveles:

### Editor

- cargar proyecto;
- guardar;
- mover componente;
- undo/redo;
- duplicar componente.

### Generator

- validar C++ generado;
- comprobar nombres;
- comprobar coordenadas;
- comprobar índices;
- comprobar referencias.

### Runtime

- navegación;
- touch;
- animaciones;
- cambios de estado.

Debe existir al menos una pantalla pequeña usada como **Golden Test** para detectar regresiones en el generador.

---

# 34. Fases reales de implementación

## Fase 0 — Fundación

Objetivo: construir la base técnica.

Entregables:

- estructura del proyecto;
- formato `.json`;
- cargar/guardar;
- sistema de componentes;
- canvas dual básico;
- selección de objetos;
- Undo/Redo.

**Resultado:** se puede crear y guardar una pantalla sencilla.

---

## Fase 1 — Editor visual MVP

Entregables:

- Drag & Drop;
- resize;
- pixel snapping;
- Inspector;
- Layers;
- RogueBox;
- PixelText;
- TouchButton;
- SelectorFrame.

**Resultado:** se puede reconstruir visualmente un menú real.

---

## Fase 2 — Componentes PokéRogue

Agregar:

- HealthBar;
- ExpBar;
- StatusBadge;
- TypeBadge;
- MoveButton;
- BattleMessageBox;
- PokemonGrid;
- RewardCard;
- InventorySlot;
- WaveIndicator.

**Resultado:** se puede construir una pantalla completa de juego sin primitivas genéricas.

---

## Fase 3 — Assets

Entregables:

- Drag & Drop PNG/WAV;
- Asset Manager;
- generación de atlas;
- índices;
- validación;
- detección de referencias rotas.

**Resultado:** los assets pasan automáticamente del editor al proyecto 3DS.

---

## Fase 4 — Animaciones

Entregables:

- Timeline;
- keyframes;
- easing;
- presets;
- preview;
- exportación matemática C++.

**Resultado:** una pantalla puede animarse completamente desde el Studio.

---

## Fase 5 — Input y comportamiento

Entregables:

- FocusManager;
- D-pad;
- A/B/X/Y;
- L/R;
- touch;
- estados de botones;
- eventos;
- transición entre pantallas.

**Resultado:** el prototipo deja de ser solo visual y pasa a ser interactivo.

---

## Fase 6 — Generador C++

Entregables:

- `.hpp`;
- `.cpp`;
- bindings;
- FocusManager;
- estados;
- animaciones;
- draw calls;
- `AppState`;
- integración con `main.cpp`.

**Resultado:** una pantalla creada en el editor se convierte en una implementación nativa.

---

## Fase 7 — Build + Azahar

Entregables:

- Generate;
- Build;
- Build + Launch;
- detección de errores;
- logs;
- ejecución automática en Azahar.

**Resultado:** ciclo completo:

```text
Diseñar → Generar → Compilar → Ejecutar
```

---

## Fase 8 — Producción

Agregar:

- templates;
- Style Presets;
- Animation Presets;
- Asset Manager avanzado;
- estadísticas de rendimiento;
- Golden Tests;
- soporte de múltiples proyectos;
- integración Git;
- optimización incremental.

---

# 35. MVP real

El primer MVP NO debe intentar incluir todo.

El MVP mínimo debería ser:

```text
[✓] Crear proyecto
[✓] Canvas Top/Bottom
[✓] Drag & Drop
[✓] Pixel Snapping
[✓] Inspector
[✓] Layers
[✓] RogueBox
[✓] PixelText
[✓] TouchButton
[✓] Guardar JSON
[✓] Preview
[✓] Generar .hpp/.cpp
[✓] Compilar una Screen
[✓] Ejecutar en Azahar
```

Después se incorporan combate, rewards, animaciones avanzadas y el resto de componentes.

---

# 36. Orden recomendado de prioridad

La prioridad técnica debería ser:

```text
1. Modelo de proyecto
2. Canvas
3. Component system
4. Inspector
5. Save/Load
6. Undo/Redo
7. Preview runtime
8. C++ Generator
9. Asset pipeline
10. Input/Focus
11. Animation Timeline
12. Templates
13. Debug/Profiling
14. Automatización Build + Azahar
```

La razón es que casi todos los sistemas posteriores dependen del modelo de componentes y del modelo de proyecto.

---

# 37. Resultado final esperado

El flujo ideal para crear una pantalla nueva será:

```text
1. New Screen
        ↓
2. Elegir template
        ↓
3. Arrastrar componentes
        ↓
4. Ajustar propiedades
        ↓
5. Vincular datos
        ↓
6. Configurar Focus / Touch
        ↓
7. Añadir animaciones
        ↓
8. Añadir sonidos
        ↓
9. Preview
        ↓
10. Validate
        ↓
11. Generate C++
        ↓
12. Build
        ↓
13. Launch Azahar
        ↓
14. Probar en emulador / hardware
```

El objetivo de producción es que **crear una nueva pantalla deje de ser un trabajo principalmente de programación y pase a ser un proceso de diseño visual con exportación automática a C++ nativo**.

---

# 38. Criterios de éxito

El proyecto se considerará funcional cuando sea posible:

### Caso 1 — Menú

Crear un menú completo sin escribir código manual.

### Caso 2 — Combate

Construir una pantalla de batalla con:

- Pokémon;
- HP;
- estados;
- movimientos;
- diálogo;
- focus;
- touch;
- animaciones.

### Caso 3 — Starter Select

Construir la selección de iniciales con:

- grid;
- tabs;
- coste;
- shiny;
- estadísticas;
- navegación;
- touch.

### Caso 4 — Exportación

Generar los archivos necesarios y ejecutar la pantalla en Azahar.

---

# 39. Métrica principal del proyecto

La métrica más importante no debe ser la cantidad de componentes implementados.

Debe ser:

**“¿Cuánto tiempo tarda crear y probar una nueva pantalla?”**

Meta conceptual:

```text
Sin Studio:
Diseño → C++ manual → assets → compile → debug
                    ↓
               mucho trabajo

Con Studio:
Diseño visual → Validate → Generate → Build → Test
```

El éxito del Studio consiste en reducir drásticamente el número de pasos manuales y mantener el resultado final compatible con la arquitectura nativa de Nintendo 3DS.