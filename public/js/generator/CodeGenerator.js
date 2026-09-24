/**
 * CodeGenerator - Deterministic C++ generator for 3DS / Citro2D / devkitARM screens.
 */
export class CodeGenerator {
  /**
   * Generates both .hpp and .cpp files for a given Screen data model.
   * @param {Object} screenData 
   * @returns {{ hpp: string, cpp: string, headerPath: string, sourcePath: string, className: string }}
   */
  static generate(screenData) {
    if (!screenData || !screenData.id) {
      throw new Error('Invalid screen data provided to CodeGenerator');
    }

    const className = this.sanitizeClassName(screenData.id);
    const screenName = className.endsWith('Screen') ? className : `${className}Screen`;

    // Deterministically sort components by zIndex, then id to guarantee stable output
    const components = [...(screenData.components || [])].sort((a, b) => {
      const zDiff = (a.zIndex || 0) - (b.zIndex || 0);
      if (zDiff !== 0) return zDiff;
      return a.id.localeCompare(b.id);
    });

    const topComponents = components.filter(c => c.screen === 'top');
    const bottomComponents = components.filter(c => c.screen === 'bottom');

    const hpp = this.generateHeader(screenName, topComponents, bottomComponents);
    const cpp = this.generateSource(screenName, screenData, topComponents, bottomComponents);

    return {
      className: screenName,
      headerPath: `generated/include/screens/${screenName}.hpp`,
      sourcePath: `generated/src/screens/${screenName}.cpp`,
      hpp,
      cpp
    };
  }

  static sanitizeClassName(str) {
    const cleaned = str.replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleaned) return 'CustomScreen';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  static sanitizeVarName(id) {
    let clean = id.replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[0-9]/.test(clean)) clean = `comp_${clean}`;
    return `m_${clean.toLowerCase()}`;
  }

  static hexColorToUint32(hex, alphaHex = 'FF') {
    if (!hex) return '0xFFFFFFFF';
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length === 8) {
      // #RRGGBBAA
      const r = clean.slice(0, 2);
      const g = clean.slice(2, 4);
      const b = clean.slice(4, 6);
      const a = clean.slice(6, 8);
      return `0x${a.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
    }
    if (clean.length === 6) {
      // #RRGGBB -> 0xAABBGGRR (Citro2D format)
      const r = clean.slice(0, 2);
      const g = clean.slice(2, 4);
      const b = clean.slice(4, 6);
      return `0x${alphaHex.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
    }
    return '0xFFFFFFFF';
  }

  static escapeString(str) {
    return String(str ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  static generateHeader(screenName, topComps, bottomComps) {
    const lines = [];
    lines.push('#pragma once');
    lines.push('');
    lines.push('#include "screens/screen.hpp"');
    lines.push('#include "ui/panel.hpp"');
    lines.push('#include "ui/button.hpp"');
    lines.push('#include "ui/text.hpp"');
    lines.push('#include "ui/focus_manager.hpp"');
    lines.push('#include <memory>');
    lines.push('#include <vector>');
    lines.push('');
    lines.push(`class ${screenName} : public Screen {`);
    lines.push('public:');
    lines.push(`    ${screenName}();`);
    lines.push(`    ~${screenName}() override = default;`);
    lines.push('');
    lines.push('    void init();');
    lines.push('    void enter() override;');
    lines.push('    void exit() override;');
    lines.push('    void handleInput(const InputManager& input) override;');
    lines.push('    void update(float dt) override;');
    lines.push('    void drawTop(Renderer2D& renderer) override;');
    lines.push('    void drawBottom(Renderer2D& renderer) override;');
    lines.push('');
    lines.push('private:');
    lines.push('    void buildUI();');
    lines.push('');

    // Member definitions for Top Screen
    lines.push('    // Top screen elements (400x240)');
    if (topComps.length === 0) {
      lines.push('    // (No top screen elements defined)');
    } else {
      for (const comp of topComps) {
        const varName = this.sanitizeVarName(comp.id);
        if (comp.type === 'RogueBox') {
          lines.push(`    std::unique_ptr<Panel> ${varName};`);
        } else if (comp.type === 'PixelText') {
          lines.push(`    std::unique_ptr<Text> ${varName};`);
        } else if (comp.type === 'TouchButton') {
          lines.push(`    std::unique_ptr<Button> ${varName};`);
        } else {
          lines.push(`    std::unique_ptr<Panel> ${varName};`);
        }
      }
    }

    lines.push('');
    // Member definitions for Bottom Screen
    lines.push('    // Bottom screen elements (320x240)');
    if (bottomComps.length === 0) {
      lines.push('    // (No bottom screen elements defined)');
    } else {
      for (const comp of bottomComps) {
        const varName = this.sanitizeVarName(comp.id);
        if (comp.type === 'RogueBox') {
          lines.push(`    std::unique_ptr<Panel> ${varName};`);
        } else if (comp.type === 'PixelText') {
          lines.push(`    std::unique_ptr<Text> ${varName};`);
        } else if (comp.type === 'TouchButton') {
          lines.push(`    std::unique_ptr<Button> ${varName};`);
        } else {
          lines.push(`    std::unique_ptr<Panel> ${varName};`);
        }
      }
    }

    lines.push('');
    lines.push('    FocusManager m_focus_manager;');
    lines.push('};');
    lines.push('');

    return lines.join('\n');
  }

  static generateSource(screenName, screenData, topComps, bottomComps) {
    const lines = [];
    lines.push(`#include "screens/${screenName}.hpp"`);
    lines.push('#include "gfx/renderer2d.hpp"');
    lines.push('#include "core/input_manager.hpp"');
    lines.push('');
    lines.push(`${screenName}::${screenName}() {`);
    lines.push('    init();');
    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::init() {`);
    lines.push('    buildUI();');
    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::enter() {`);
    lines.push('    // Called when screen becomes active');
    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::exit() {`);
    lines.push('    // Called when screen transitions away');
    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::buildUI() {`);
    lines.push('    m_focus_manager.clear();');
    lines.push('');

    // Top screen components instantiation
    lines.push('    // ----------------------------------------------------');
    lines.push('    // 1. TOP SCREEN (400x240)');
    lines.push('    // ----------------------------------------------------');
    for (const comp of topComps) {
      this.writeComponentInit(lines, comp);
    }

    lines.push('');
    // Bottom screen components instantiation
    lines.push('    // ----------------------------------------------------');
    lines.push('    // 2. BOTTOM SCREEN (320x240)');
    lines.push('    // ----------------------------------------------------');
    for (const comp of bottomComps) {
      this.writeComponentInit(lines, comp);
    }

    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::handleInput(const InputManager& input) {`);
    lines.push('    m_focus_manager.handleInput(input);');
    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::update(float dt) {`);
    lines.push('    m_focus_manager.update(dt);');
    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::drawTop(Renderer2D& renderer) {`);

    const topBg = screenData.top?.backgroundColor ? this.hexColorToUint32(screenData.top.backgroundColor) : '0xFF12141C';
    lines.push(`    renderer.clear(${topBg});`);

    for (const comp of topComps) {
      if (comp.visible === false) continue;
      const varName = this.sanitizeVarName(comp.id);
      lines.push(`    if (${varName}) ${varName}->draw(renderer);`);
    }

    lines.push('}');
    lines.push('');
    lines.push(`void ${screenName}::drawBottom(Renderer2D& renderer) {`);

    const bottomBg = screenData.bottom?.backgroundColor ? this.hexColorToUint32(screenData.bottom.backgroundColor) : '0xFF1A1824';
    lines.push(`    renderer.clear(${bottomBg});`);

    for (const comp of bottomComps) {
      if (comp.visible === false) continue;
      const varName = this.sanitizeVarName(comp.id);
      lines.push(`    if (${varName}) ${varName}->draw(renderer);`);
    }

    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  static writeComponentInit(lines, comp) {
    const varName = this.sanitizeVarName(comp.id);
    const x = `${comp.x}.0f`;
    const y = `${comp.y}.0f`;
    const w = `${comp.width}.0f`;
    const h = `${comp.height}.0f`;
    const props = comp.properties || {};

    if (comp.type === 'RogueBox') {
      const bg = this.hexColorToUint32(props.backgroundColor || '#1e2230');
      const border = this.hexColorToUint32(props.borderColor || '#c83834');
      lines.push(`    ${varName} = std::make_unique<Panel>(${x}, ${y}, ${w}, ${h}, PanelStyle::ROGUE_BOX);`);
      lines.push(`    ${varName}->backgroundColor = ${bg};`);
      lines.push(`    ${varName}->borderColor = ${border};`);
    } else if (comp.type === 'PixelText') {
      const text = this.escapeString(props.text || '');
      const color = this.hexColorToUint32(props.color || '#ffffff');
      lines.push(`    ${varName} = std::make_unique<Text>(${x}, ${y}, "${text}", ${color}, true);`);
    } else if (comp.type === 'TouchButton') {
      const label = this.escapeString(props.label || 'BUTTON');
      const focusId = Number.isInteger(props.focusId) ? props.focusId : 0;
      lines.push(`    ${varName} = std::make_unique<Button>(${x}, ${y}, ${w}, ${h}, "${label}", ${focusId});`);
      lines.push(`    m_focus_manager.addElement(${varName}.get());`);
    }
  }
}
