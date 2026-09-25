# 3DS UI Game Creation Studio

Visual IDE and deterministic C++ code generation studio for Nintendo 3DS interfaces, specialized for the **PokéRogue 3DS** project.

```text
┌─────────────────────────────────────────────────────────┐
│              3DS UI GAME CREATION STUDIO               │
│                                                         │
│   Diseñar → Previsualizar → Validar → Generar C++      │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Quick Start

### Requisitos previos
- **Node.js** (v18 o superior). Probado en Node v24.
- Navegador moderno (Chrome, Edge, Firefox).

### Iniciar el Studio
Desde la raíz del proyecto (`c:\DZ\Proyectos\3ds_GUI`):

```bash
# Iniciar el servidor local del Studio
npm start
# o directamente:
node server.js
```

Abre en tu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

### Ejecutar las Pruebas Automatizadas
```bash
npm test
# o:
node test/run_tests.js
```

---

## 2. Arquitectura del Proyecto

El sistema está estructurado bajo una separación estricta de responsabilidades:

```text
Editor UI (HTML / CSS / Vanilla JS)
    ↓
Project Model (project.json, screens/*.json)
    ↓
Preview Runtime (Simulador interactivo 3DS)
    ↓
Validator (Reglas de resolución y límites 3DS)
    ↓
Code Generator (Salida C++ determinista)
    ↓
Target Nintendo 3DS (Citro2D / devkitARM)
```

### Estructura de Directorios

```text
3ds_GUI/
├── package.json                   # Configuración de scripts y metadatos
├── server.js                      # Servidor local Node.js con APIs de persistencia y generación
├── README.md                      # Esta documentación
├── Plan_de_trabajo.md             # Plan maestro del proyecto
│
├── public/                        # Frontend del Studio IDE
│   ├── index.html                 # Shell del IDE (Header, Canvas dual, Sidebar, Inspector)
│   ├── css/
│   │   ├── main.css               # Tema oscuro estilo Figma/Game Studio
│   │   └── preview.css            # Chasis 3DS, bisagra física, D-pad y botones
│   └── js/
│       ├── core/
│       │   ├── ProjectModel.js    # Estado reactivo del proyecto, pantallas y componentes
│       │   ├── HistoryManager.js  # Pila de comandos Undo / Redo (Ctrl+Z, Ctrl+Y)
│       │   └── Validator.js       # Validación de resoluciones 3DS, bounds e IDs únicos
│       ├── components/
│       │   ├── BaseComponent.js   # Clase base abstracta de componentes
│       │   ├── ComponentRegistry.js # Registro y fábrica extensible de componentes
│       │   ├── RogueBox.js        # Panel biselado estilo PokéRogue
│       │   ├── PixelText.js       # Texto pixel-perfect con sombra
│       │   └── TouchButton.js     # Botón táctil e interactivo con FocusManager
│       ├── editor/
│       │   ├── CanvasRenderer.js  # Renderizado dual (Top 400x240, Bottom 320x240)
│       │   ├── SelectionManager.js# Selección simple/múltiple y handles
│       │   ├── DragResizeManager.js# Arrastre y redimensión con pixel snapping
│       │   ├── Inspector.js       # Inspector bidireccional de propiedades
│       │   └── Hierarchy.js       # Árbol de capas, visibilidad y reordenamiento
│       ├── preview/
│       │   └── PreviewRuntime.js  # Simulador interactivo 3DS con D-Pad, A/B/X/Y y táctil
│       ├── generator/
│       │   └── CodeGenerator.js   # Generador determinista C++ (.hpp y .cpp)
│       └── app.js                 # Orquestador del IDE y atajos de teclado
│
├── project/                       # Proyecto activo de interfaces 3DS
│   ├── project.json               # Configuración global del proyecto
│   ├── screens/                   # Pantallas declarativas en JSON
│   │   └── ExampleScreen.json     # Pantalla de prueba con RogueBox, PixelText, TouchButton
│   └── generated/                 # Artefactos C++ generados (NO editar manualmente)
│       ├── include/screens/
│       │   └── ExampleScreen.hpp  # Header Screen de Citro2D / devkitARM
│       └── src/screens/
│           └── ExampleScreen.cpp  # Implementación nativa C++
│
└── test/
    └── run_tests.js               # Suite de tests unitarios y regression golden tests
```

---

## 3. Especificaciones del Canvas Dual 3DS

Nintendo 3DS posee dos pantallas físicas con características diferentes:

| Pantalla | Ancho lógico | Alto lógico | Entrada |
| :--- | :--- | :--- | :--- |
| **Top Screen** | **400 px** | **240 px** | Visual / 3D estereoscópico |
| **Bottom Screen** | **320 px** | **240 px** | Pantalla táctil resistiva (Touch) |

### Reglas de Layout y Pixel Snapping
- **Coordenadas Enteras:** Todas las posiciones `x`, `y`, `width` y `height` son automáticamente redondeadas con `Math.round()` para garantizar nitidez pixel-perfect en la pantalla de la 3DS.
- **Bisagra (Hinge):** El modo dual representa la separación física entre las pantallas con el bisel de la consola.
- **Modos de Visualización:**
  - `Dual`: Ambas pantallas alineadas con bisagra.
  - `Top`: Solo pantalla superior (400×240).
  - `Bottom`: Solo pantalla inferior táctil (320×240).
- **Zoom:** 1×, 2×, 3×, 4× y `Fit` (ajuste a ventana).

---

## 4. Atajos de Teclado del Editor

| Atajo | Acción |
| :--- | :--- |
| `Ctrl + Z` | Deshacer (Undo) |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Rehacer (Redo) |
| `Ctrl + D` | Duplicar componente seleccionado |
| `Delete` / `Backspace` | Eliminar componente seleccionado |
| `Ctrl + S` | Guardar proyecto a disco |
| `Shift + Click` | Selección múltiple |
| `Rueda del ratón` | Zoom dinámico sobre el canvas |
| `Botón central del ratón / Alt + Drag` | Desplazamiento panorámico (Pan) |

---

## 5. Cómo Crear una Nueva Screen

1. En la barra superior, haz clic en el botón **`+ New`** junto al selector de pantallas.
2. Ingresa el nombre de la pantalla (ejemplo: `BattleScreen`, `StarterSelectScreen`).
3. El editor inicializará automáticamente la pantalla con las dimensiones de 3DS y la añadirá al árbol.
4. Arrastra o añade componentes desde la barra de herramientas (**RogueBox**, **PixelText**, **TouchButton**).
5. Ajusta sus propiedades en el **Inspector**.
6. Haz clic en **`💾 Save`** para persistir el archivo en `project/screens/[ScreenName].json`.

---

## 6. Cómo Agregar un Nuevo Componente (Arquitectura Schema-Driven)

Gracias a la arquitectura basada en **`UINode`** y **`PropertySystem`**, agregar un componente **NO requiere modificar el Inspector ni el Canvas**:

### Paso 1: Crear la clase del componente con su Schema
Crea `public/js/components/HealthBar.js` heredando de `BaseComponent`:

```javascript
import { BaseComponent } from './BaseComponent.js';
import { Props } from '../core/PropertySystem.js';

export class HealthBar extends BaseComponent {
  static schema = {
    type: 'HealthBar',
    displayName: 'Health Bar',
    category: 'Combat',
    icon: '💚',
    description: 'Barra de vida dinámica para Pokémon',
    capabilities: ['render'],
    properties: {
      currentHP: Props.integer('Current HP', 100, { min: 0, max: 999, category: 'Data' }),
      maxHP: Props.integer('Max HP', 100, { min: 1, max: 999, category: 'Data' }),
      barColor: Props.color('Bar Color', '#22c55e', { category: 'Style' }),
      backgroundColor: Props.color('Background Color', '#1f2937', { category: 'Style' })
    }
  };

  constructor(data = {}) {
    super({
      ...data,
      type: 'HealthBar',
      width: Math.round(data.width ?? 120),
      height: Math.round(data.height ?? 10)
    });
  }

  draw(ctx, options = {}) {
    const { currentHP, maxHP, barColor, backgroundColor } = this.properties;
    const ratio = Math.max(0, Math.min(1, currentHP / maxHP));
    
    // Fondo de la barra
    ctx.fillStyle = backgroundColor || '#1f2937';
    ctx.fillRect(0, 0, this.width, this.height);

    // Barra de vida
    ctx.fillStyle = barColor || '#22c55e';
    ctx.fillRect(1, 1, Math.round((this.width - 2) * ratio), this.height - 2);
  }
}
```

### Paso 2: Registrarlo en `ComponentRegistry.js`
En `public/js/components/ComponentRegistry.js`:

```javascript
import { HealthBar } from './HealthBar.js';

ComponentRegistry.register('HealthBar', HealthBar);
```

¡El **Inspector** detectará automáticamente el esquema y generará los controles visuales correspondientes sin tocar ningún otro archivo!

---

## 7. Cómo Modificar el Generador C++ (Contrato de Exporters)

El generador determinista se encuentra en `public/js/generator/CodeGenerator.js` y utiliza el patrón **Exporter**:

Para soportar un nuevo componente en C++:
```javascript
class HealthBarExporter {
  getIncludes() {
    return ['#include "ui/health_bar.hpp"'];
  }

  getMember(comp, varName) {
    return `std::unique_ptr<HealthBar> ${varName};`;
  }

  getInitialization(comp, varName) {
    return [
      `    ${varName} = std::make_unique<HealthBar>(${comp.x}.0f, ${comp.y}.0f, ${comp.width}.0f, ${comp.height}.0f);`
    ];
  }

  getDrawCall(comp, varName) {
    return `    if (${varName}) ${varName}->draw(renderer);`;
  }
}

CodeGenerator.registerExporter('HealthBar', new HealthBarExporter());
```

### Determinismo Estricto
El generador garantiza que:
- Los componentes se ordenan siempre por `zIndex` ascendente, luego alfabéticamente por `id`.
- Los colores se exportan en formato nativo Citro2D `0xAABBGGRR`.
- No se generan timestamps, IDs aleatorios ni saltos de línea irregulares, asegurando que Git diff permanezca 100% limpio.

---

## 9. BETA-UI-3: C++ Animation Export & Citro2D Runtime

GUI_3DS convierte composiciones y animaciones visuales en código C++ nativo ejecutable sobre **Nintendo 3DS** mediante **devkitARM** y **Citro2D**.

### Pipeline de Exportación y Evaluación

```text
Editor Scene JSON
       ↓
SceneModel (Nodes, Tracks, Keyframes, Markers, AudioCues)
       ↓
TimelineEvaluator (Evaluación efímera en JS sin mutar estado)
       ↓
SceneValidator (Validación estricta pre-export)
       ↓
Deterministic Export Model (Normalización y orden estable)
       ↓
SceneCppExporter
       ├── SceneData.hpp / SceneData.cpp (Tablas estáticas compactas)
       ├── SceneAssets.hpp / SceneAssets.cpp (Manifiesto de assets)
       ├── SceneTimeline.hpp / SceneTimeline.cpp (Evaluador C++)
       ├── Scene.hpp / Scene.cpp (Runtime Citro2D Dual-Screen)
       └── SceneManifest.json
       ↓
Citro2D Runtime
       ↓
Nintendo 3DS (TOP 400x240, BOTTOM 320x240)
```

### Capas del Sistema de Animación

| Capa | Estructura / Clase | Rol y Responsabilidad |
|---|---|---|
| **Authoring Data** | `SceneModel`, `UINode`, `AnimationTrack`, `Keyframe` | Modelo declarativo de autoría (JSON y JS). Define el grafo de nodos, canales de animación y fotogramas clave. |
| **Exported Data** | `SceneData.hpp/.cpp`, `SceneAssets.hpp/.cpp` | Tablas de datos C++ compactas y estáticas (`SceneKeyframe`, `SceneTrack`, `SceneNodeData`, `SceneMarker`, `SceneAudioCue`). Sin dependencias del DOM ni JSON en runtime. |
| **Runtime State** | `SceneTimeline`, `Scene`, `EvaluatedTransform` | Estado de ejecución y evaluación en la consola (`m_currentFrame`, transformaciones calculadas, renderizado Citro2D). |

### Autoridad Temporal Única

- **Fuente de verdad:** `uint32_t currentFrame` entero.
- **Sin tiempo flotante acumulativo:** El progreso de la animación se gobierna exclusivamente por fotogramas enteros discretos, garantizando reproducibilidad exacta byte a byte y determinismo matemático.
- **Subframe tick:** El acumulador flotante solo se utiliza para sincronizar el paso de tiempo delta (`dt`) con la cadencia de cuadros (`fps`), nunca como autoridad primaria del frame.

### Curvas de Interpolación y Paridad Matemática

El evaluador C++ (`SceneTimeline`) implementa exactamente las mismas curvas matemáticas que `Interpolation.js`:

1. **STEP:** $t < 1.0 \implies 0.0, \; t = 1.0 \implies 1.0$
2. **LINEAR:** $t$
3. **EASE_IN:** $t^2$
4. **EASE_OUT:** $t \cdot (2 - t)$
5. **EASE_IN_OUT:** $t < 0.5 \implies 2t^2, \; t \ge 0.5 \implies -1 + (4 - 2t)t$

La paridad matemática entre Preview JS y Runtime C++ está validada por tests automatizados con error máximo $\Delta < 10^{-6}$.

---

## Development Environments

GUI_3DS implementa una arquitectura desacoplada en tres niveles claramente diferenciados para permitir el desarrollo sin requerir permisos de administrador en estaciones de trabajo corporativas, mientras delega y verifica las compilaciones nativas de hardware en integración continua (CI) oficial.

### 1. Nivel A — Laptop corporativa / Entorno local portátil

Diseñado para ejecutarse en entornos donde el usuario **no posee permisos de administrador** ni tiene instalado el SDK de Nintendo 3DS:

- **Desarrollo:** El Studio visual (`npm start`), la previsualización interactiva dual-screen y la edición de escenas funcionan 100% de manera local.
- **Validación automatizada:**
  ```bash
  npm test
  npm run native-parity
  ```
- **Alcance verificado localmente:**
  - `SceneModel`, `Timeline`, `Keyframes`, `Interpolation`
  - `SceneValidator`, `SceneCppExporter`, serialización y determinismo
  - Paridad matemática C++ ↔ JS (`test/native/run_native_parity.mjs`)
  - Rechazo de assets corruptos o no registrados
- **Ausencia de devkitPro:** La falta de devkitARM/devkitPro en la máquina local **no representa un bug**. Las pruebas dependientes del toolchain de hardware reportan limpiamente `BLOCKED` sin fingir la compilación ni usar placeholders.

### 2. Nivel B — GitHub Actions / Official 3DS CI

El gate oficial y reproducible de integración para Nintendo 3DS se ejecuta en GitHub Actions utilizando el contenedor oficial versionado de devkitPro (`devkitpro/devkitarm:20260610`):

- **Workflows:**
  - `.github/workflows/tests.yml`: Validación rápida de tests JS y paridad matemática (Level A).
  - `.github/workflows/build-3ds.yml`: Build nativo de hardware real 3DS (Level B).
- **Toolchain real verificado:**
  - `devkitARM` (`arm-none-eabi-gcc`, `arm-none-eabi-g++`)
  - `libctru` (`3ds.h`)
  - `Citro2D` (`citro2d.h`, `libcitro2d.a`)
  - `Citro3D` (`citro3d.h`, `libcitro3d.a`)
  - `tex3ds` (conversión real de gráficos a `.t3x`)
  - `3dsxtool` (empaquetado real de ejecutable `.3dsx`)
  - RomFS (sistema de archivos determinista)
- **Artefactos generados:**
  - `build/GUI_3DS.elf` (binario ARM/ELF verificado)
  - `build/GUI_3DS.3dsx` (ejecutable con RomFS incrustado)
  - `project/generated/SceneManifest.json`
  - `build/romfs/romfs_manifest.json`
  - `build-log.txt`

### 3. Nivel C — PC personal / Hardware Nintendo 3DS

Entorno opcional para desarrollo offline, depuración interactiva y pruebas en hardware real de Nintendo 3DS:

- Requiere instalar devkitPro con el payload de 3DS (`dkp-pacman -S 3ds-dev 3ds-citro2d 3ds-citro3d 3ds-tex3ds`).
- Comandos:
  ```bash
  # Verificar el toolchain local
  npm run 3ds-test
  
  # Compilar binarios reales (.elf y .3dsx con RomFS)
  npm run 3ds-build
  # o bien:
  make 3ds
  ```
- El archivo `build/GUI_3DS.3dsx` resultante puede ejecutarse directamente en emulador Citra o transferirse vía Homebrew Launcher a una consola Nintendo 3DS física.


