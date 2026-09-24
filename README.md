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

## 8. Flujo de Validación y Exportación

1. **Validación:** Haz clic en **`🔍 Validate`**. El sistema verificará:
   - Coordenadas enteras (pixel snapping).
   - Bounds: detecta si algún elemento excede los 400px en Top o 320px en Bottom.
   - Unicidad estricta de IDs.
   - Referencias circulares o padres inexistentes.
2. **Previsualización:** Haz clic en **`🎮 Preview`** para abrir el simulador 3DS interactivo. Prueba la navegación con la cruceta (D-Pad), botones físicos A/B/X/Y y toques en la pantalla inferior.
3. **Generar C++:** Haz clic en **`⚡ Generate C++`**. El código generado se guardará directamente en `project/generated/` y se mostrará en pantalla listo para copiar o descargar.
