/**
 * Validator - Categorized 3DS UI Validator.
 * Evaluates Structure, Layout, Input, and Performance constraints for Nintendo 3DS hardware.
 */
export class Validator {
  /**
   * Validate a single screen and its components.
   * @param {Object} screen 
   * @returns {{ valid: boolean, errors: Array<{ category: string, level: 'error'|'warn', componentId?: string, property?: string, value?: any, message: string }> }}
   */
  static validateScreen(screen) {
    const issues = [];
    if (!screen) {
      return {
        valid: false,
        errors: [{ category: 'Structure', level: 'error', message: 'Screen is undefined or null' }]
      };
    }

    if (!screen.id || typeof screen.id !== 'string') {
      issues.push({
        category: 'Structure',
        level: 'error',
        property: 'id',
        message: 'Screen ID must be a non-empty string'
      });
    }

    const topWidth = screen.top?.width || 400;
    const topHeight = screen.top?.height || 240;
    const bottomWidth = screen.bottom?.width || 320;
    const bottomHeight = screen.bottom?.height || 240;

    const seenIds = new Set();
    const components = screen.components || [];

    // --- Performance budget check ---
    if (components.length > 40) {
      issues.push({
        category: 'Performance',
        level: 'warn',
        message: `Screen contains ${components.length} elements. High element counts may impact ARM11 60 FPS performance on Nintendo 3DS.`
      });
    }

    for (const comp of components) {
      // 1. Structure: ID checks
      if (!comp.id || typeof comp.id !== 'string' || !comp.id.trim()) {
        issues.push({
          category: 'Structure',
          level: 'error',
          componentId: '(unknown)',
          property: 'id',
          message: 'Component has an empty or invalid ID'
        });
      } else if (seenIds.has(comp.id)) {
        issues.push({
          category: 'Structure',
          level: 'error',
          componentId: comp.id,
          property: 'id',
          value: comp.id,
          message: `Duplicate component ID "${comp.id}" detected.`
        });
      } else {
        seenIds.add(comp.id);
      }

      // 2. Structure: Target screen
      if (comp.screen !== 'top' && comp.screen !== 'bottom' && comp.screen !== 'global') {
        issues.push({
          category: 'Structure',
          level: 'error',
          componentId: comp.id,
          property: 'screen',
          value: comp.screen,
          message: `Screen target must be 'top', 'bottom', or 'global'. Found "${comp.screen}".`
        });
      }

      // 3. Layout: Integer pixel snapping check
      if (!Number.isInteger(comp.x)) {
        issues.push({
          category: 'Layout',
          level: 'warn',
          componentId: comp.id,
          property: 'x',
          value: comp.x,
          message: `Coordinate X (${comp.x}) is fractional. Coordinates must be integers for pixel-perfect 3DS rendering.`
        });
      }
      if (!Number.isInteger(comp.y)) {
        issues.push({
          category: 'Layout',
          level: 'warn',
          componentId: comp.id,
          property: 'y',
          value: comp.y,
          message: `Coordinate Y (${comp.y}) is fractional. Coordinates must be integers for pixel-perfect 3DS rendering.`
        });
      }

      // 4. Layout: Dimensions
      if (comp.width <= 0) {
        issues.push({
          category: 'Layout',
          level: 'error',
          componentId: comp.id,
          property: 'width',
          value: comp.width,
          message: 'Width must be greater than 0.'
        });
      }
      if (comp.height <= 0) {
        issues.push({
          category: 'Layout',
          level: 'error',
          componentId: comp.id,
          property: 'height',
          value: comp.height,
          message: 'Height must be greater than 0.'
        });
      }

      // 5. Layout: 3DS Display boundaries check
      const maxW = comp.screen === 'top' ? topWidth : bottomWidth;
      const maxH = comp.screen === 'top' ? topHeight : bottomHeight;
      const screenLabel = comp.screen === 'top' ? `Top screen (${maxW}x${maxH})` : `Bottom screen (${maxW}x${maxH})`;

      if (comp.x < 0) {
        issues.push({
          category: 'Layout',
          level: 'warn',
          componentId: comp.id,
          property: 'x',
          value: comp.x,
          message: `Element starts outside left edge of ${screenLabel}.`
        });
      }
      if (comp.y < 0) {
        issues.push({
          category: 'Layout',
          level: 'warn',
          componentId: comp.id,
          property: 'y',
          value: comp.y,
          message: `Element starts above top edge of ${screenLabel}.`
        });
      }
      if (comp.x + comp.width > maxW) {
        issues.push({
          category: 'Layout',
          level: 'warn',
          componentId: comp.id,
          property: 'x + width',
          value: comp.x + comp.width,
          message: `Element exceeds ${screenLabel} width (${comp.x + comp.width} > ${maxW}px).`
        });
      }
      if (comp.y + comp.height > maxH) {
        issues.push({
          category: 'Layout',
          level: 'warn',
          componentId: comp.id,
          property: 'y + height',
          value: comp.y + comp.height,
          message: `Element exceeds ${screenLabel} height (${comp.y + comp.height} > ${maxH}px).`
        });
      }

      // 6. Structure: Parent references & cycle detection
      if (comp.parent) {
        const parentComp = components.find(c => c.id === comp.parent);
        if (!parentComp) {
          issues.push({
            category: 'Structure',
            level: 'error',
            componentId: comp.id,
            property: 'parent',
            value: comp.parent,
            message: `Broken parent reference: Parent "${comp.parent}" does not exist in this screen.`
          });
        } else {
          if (parentComp.screen !== comp.screen) {
            issues.push({
              category: 'Structure',
              level: 'error',
              componentId: comp.id,
              property: 'parent',
              value: comp.parent,
              message: `Parent "${comp.parent}" is on screen "${parentComp.screen}" while child is on "${comp.screen}".`
            });
          }

          // Cycle check
          let curr = parentComp;
          let depth = 0;
          while (curr && depth++ < 50) {
            if (curr.id === comp.id) {
              issues.push({
                category: 'Structure',
                level: 'error',
                componentId: comp.id,
                property: 'parent',
                message: `Circular parent hierarchy detected involving "${comp.id}".`
              });
              break;
            }
            curr = components.find(c => c.id === curr.parent);
          }
        }
      }
    }

    const hasErrors = issues.some(i => i.level === 'error');
    return {
      valid: !hasErrors,
      errors: issues
    };
  }
}
