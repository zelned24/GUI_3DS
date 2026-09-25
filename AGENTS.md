# AGENTS.md — Contrato Permanente de Agentes para GUI_3DS

Este documento establece las reglas fundamentales, la arquitectura y los estándares de ingeniería de software obligatorios para cualquier agente de inteligencia artificial o desarrollador que trabaje sobre el repositorio **GUI_3DS**.

---

## 1. PROJECT

**GUI_3DS** es un Studio especializado para crear una adaptación de **PokéRogue para Nintendo 3DS** (devkitARM / Citro2D / Libctru).

- El objetivo **no** es crear un editor genérico ni un clon multipropósito.
- Todas las decisiones de diseño de interfaz, flujos y componentes deben estar fundamentadas en las características de la consola Nintendo 3DS (pantalla superior 400×240 sin táctil, pantalla inferior 320×240 táctil resistiva, limitaciones de memoria ARM11 y VRAM, navegación por D-Pad/botones físicos) y en la experiencia de juego de PokéRogue.

---

## 2. ARCHITECTURE

Se debe mantener una separación estricta e unidireccional de capas:

```text
Editor
  └──> Project Model
         ├──> Preview Runtime
         ├──> Gameplay / Data
         ├──> Asset Pipeline
         ├──> Validator
         └──> Code Generator
                └──> 3DS Runtime (Citro2D / C++)
```

- **Regla de oro**: **Nunca mezclar UI con lógica de combate ni con modelos de datos canónicos.**
- La UI solo consume eventos y proyecta estados. El runtime de combate o el motor de datos nunca deben importar ni acoplarse a elementos del DOM ni del editor visual.

---

## 3. POKÉROGUE

[PokéRogue](https://github.com/pagefaultgames/pokerogue) es una fuente externa de datos, assets y referencia de comportamiento.

- **No copiar código indiscriminadamente**.
- No adaptar código TypeScript de Phaser pegándolo directamente en el runtime de 3DS.
- Seguir siempre el pipeline:
  ```text
  Adapter → Importer → Canonical Model → Override → Generated Runtime
  ```
- Preservar información y metadatos upstream que todavía no puedan ser interpretados por el hardware de 3DS, almacenándolos de manera canónica para futuras extensiones.

---

## 4. DATA

**Nunca hardcodear datos reales de PokéRogue dentro de la UI.**

Todos los datos deben fluir siguiendo el pipeline:

```text
Source (Upstream TS/JSON)
  └──> Import
         └──> Canonical Model (Normalized)
                └──> Runtime / Storage
```

- Las especies, movimientos, habilidades, tipos y modificadores deben originarse en estructuras de datos importadas y canónicas.
- Ningún componente de interfaz debe contener listas estáticas de ataques o estadísticas fijas.

---

## 5. MOCK DATA

- Los fixtures de prueba deben residir exclusivamente en `test/fixtures/` o en una ubicación claramente separada del código de producción.
- **Nunca tratar fixtures o vertical slices como datos de producción.**
- Si se requiere un baseline para tests sin dependencias de red, debe identificarse explícitamente como fixture de test y nunca sustituir al `DataManager` de producción.

---

## 6. DETERMINISM

**Queda estrictamente prohibido utilizar:**
- `Math.random()`
- `Date.now()` / `new Date()`
- IDs generados con números aleatorios no reproducibles

...para determinar resultados de simulación, cálculos de combate, generación de IDs de proyecto o generación de código fuente C++.

- **Battle Simulations**: Deben ser 100% reproducibles mediante una semilla inicial (`seed`) y un generador pseudoaleatorio determinista (PRNG / LCG).
- **Generated Files**: Los archivos generados C++ (`.hpp`, `.cpp`) y JSON deben ser deterministas y reproducibles byte a byte. No incluir marcas de tiempo ni identificadores volátiles.

---

## 7. UI

**La UI no debe modificar directamente el estado de batalla (`BattleState`).**

El flujo obligatorio para cualquier interacción del usuario o simulación es:

```text
UI
  └──> Command
         └──> Engine
                └──> Event
                       └──> Binding
                              └──> UI
```

1. La interfaz emite un **Command** (ej: `SelectMoveCommand`, `SwitchPokemonCommand`).
2. El **Engine** procesa el comando aplicando reglas de juego.
3. El motor emite **Events** tipados (`MoveStarted`, `DamageCalculated`, `HPChanged`).
4. Los **Bindings** reciben los eventos y actualizan la presentación visual en la **UI**.

---

## 8. BATTLE ENGINE

El motor de batalla debe ser modular, desacoplado y reactivo.

- **Preferir**:
  ```text
  Phase → Resolver → Effect → Event → Command
  ```
- **Prohibido**: Diseñar managers monolíticos con miles de líneas donde la lógica de estados, fases, animaciones y cálculo matemático esté mezclada en un único archivo.
- Cada fase del turno debe ser un componente aislado y testeable por separado.

---

## 9. ASSETS

**Nunca inventar rutas ficticias de assets.**

- No suponer que existen archivos en rutas como `romfs/sprites/...` o `assets/...` sin que existan físicamente o estén procesados por un pipeline de assets.
- Resolver los assets mediante metadatos e importers formales.
- Conservar siempre la procedencia del asset (*source provenance*): origen, archivo fuente original, resolución nativa y formato de compresión para 3DS (`.t3x` / Citro2D).

---

## 10. IMPORTS

Todos los procesos de importación desde repositorios externos (como `pokerogue` o `pokerogue-assets`) deben registrar explícitamente en sus metadatos:

1. `repository`: URL del repositorio origen.
2. `revision`: Commit hash exacto o tag de procedencia.
3. `sourcePath`: Ruta del archivo en el repositorio upstream.
4. `hash`: Checksum SHA-256 del contenido importado.
5. `schemaVersion`: Versión del esquema canónico al que se normalizó.

---

## 11. OVERRIDES

**Nunca modificar directamente los datos upstream importados.**

Si se requiere ajustar una propiedad de PokéRogue para adaptarla a las capacidades o balance de Nintendo 3DS, se debe aplicar un sistema de sobreescritura local:

```text
Upstream Data
      +
Local Override
      =
Final Canonical Data
```

Esto garantiza que al actualizar los datos upstream de PokéRogue, las modificaciones y balances específicos para 3DS no se pierdan.

---

## 12. TESTS

- Antes de declarar cualquier funcionalidad, tarea o cambio como terminado:
  ```bash
  npm test
  ```
  debe ejecutarse y pasar con 100% de éxito.
- **Obligatorio agregar tests automatizados** para cualquier sistema nuevo, adaptador, normalizador, exporter de código o fase del motor de combate.
- Ninguna regresión en tests unitarios ni en golden tests será aceptada.

---

## 13. REFACTORING

- **No realizar reescrituras masivas sin justificación.**
- Inspeccionar primero el código y sus dependencias antes de proponer cambios estructurales.
- Reutilizar el código existente siempre que sea posible.
- Modificar lo mínimo necesario para alcanzar el objetivo planteado.
- Mantener compatibilidad hacia atrás en los esquemas de pantalla y formatos de proyecto (`project.json`, `screens/*.json`).

---

## 14. GIT

- **No eliminar el historial de git.**
- **No sobrescribir silenciosamente cambios externos.**
- **No borrar archivos** sin comprobar previamente todas las referencias y usos en el resto de la base de código.
- Antes de una refactorización grande, confirmar que la suite de tests existente pasa completamente.

---

## 15. AGENT BEHAVIOR

El ciclo de trabajo obligatorio para cualquier agente en cada intervención es:

1. **Inspeccionar**: Leer el código, dependencias y tests relevantes antes de escribir.
2. **Identificar dependencias**: Mapear qué módulos pueden verse afectados por el cambio.
3. **Formular plan**: Definir los pasos mínimos y ordenados de implementación.
4. **Modificar**: Aplicar los cambios preservando la arquitectura y el estilo del proyecto.
5. **Ejecutar tests**: Comprobar que los tests pasan localmente (`npm test` o `run_tests.js`).
6. **Revisar diff**: Validar que no se introdujeron archivos accidentales, no determinismo ni efectos colaterales.
7. **Documentar**: Explicar con precisión y concisión el trabajo realizado.

### Principio de Integración Real

**Nunca afirmar que una integración existe simplemente porque existe una clase o un método con el nombre correspondiente.**

Una integración solo se considera real y válida cuando existe y se verifica la cadena completa:

```text
SOURCE ──> IMPORT ──> DATA ──> TEST ──> RESULT
```
