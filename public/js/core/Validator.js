/**
 * Validator - Validates 3DS UI project, screens, components, bounds, and layout rules.
 */
export class Validator {
  /**
   * Validate a single screen and its components.
   * @param {Object} screen 
   * @returns {{ valid: boolean, errors: Array<{ level: 'error'|'warn', componentId?: string, property?: string, value?: any, message: string }> }}
   */
  static validateScreen(screen) {
    const issues = [];
    if (!screen) {
      return { valid: false, errors: [{ level: 'error', message: 'Screen is undefined or null' }] };
    }

    if (!screen.id || typeof screen.id !== 'string') {
      issues.push({ level: 'error', property: 'id', message: 'Screen ID must be a non-empty string' });
    }

    const topWidth = screen.top?.width || 400;
    const topHeight = screen.top?.height || 240;
    const bottomWidth = screen.bottom?.width || 320;
    const bottomHeight = screen.bottom?.height || 240;

    const seenIds = new Set();
    const components = screen.components || [];

    for (const comp of components) {
      // 1. ID checks
      if (!comp.id || typeof comp.id !== 'string' || !comp.id.trim()) {
        issues.push({
          level: 'error',
          componentId: '(unknown)',
          property: 'id',
          message: 'Component has an empty or invalid ID'
        });
      } else if (seenIds.has(comp.id)) {
        issues.push({
          level: 'error',
          componentId: comp.id,
          property: 'id',
          value: comp.id,
          message: `Duplicate component ID "${comp.id}" detected.`
        });
      } else {
        seenIds.add(comp.id);
      }

      // 2. Screen target check
      if (comp.screen !== 'top' && comp.screen !== 'bottom') {
        issues.push({
          level: 'error',
          componentId: comp.id,
          property: 'screen',
          value: comp.screen,
          message: `Screen target must be 'top' or 'bottom'. Found "${comp.screen}".`
        });
      }

      // 3. Integer coordinates check (Pixel snapping rule)
      if (!Number.isInteger(comp.x)) {
        issues.push({
          level: 'warn',
          componentId: comp.id,
          property: 'x',
          value: comp.x,
          message: `Coordinate X (${comp.x}) is fractional. Coordinates must be integers for pixel-perfect 3DS rendering.`
        });
      }
      if (!Number.isInteger(comp.y)) {
        issues.push({
          level: 'warn',
          componentId: comp.id,
          property: 'y',
          value: comp.y,
          message: `Coordinate Y (${comp.y}) is fractional. Coordinates must be integers for pixel-perfect 3DS rendering.`
        });
      }

      // 4. Dimensions check
      if (comp.width <= 0) {
        issues.push({
          level: 'error',
          componentId: comp.id,
          property: 'width',
          value: comp.width,
          message: `Width must be greater than 0.`
        });
      }
      if (comp.height <= 0) {
        issues.push({
          level: 'error',
          componentId: comp.id,
          property: 'height',
          value: comp.height,
          message: `Height must be greater than 0.`
        });
      }

      // 5. 3DS Display boundaries check
      const maxW = comp.screen === 'top' ? topWidth : bottomWidth;
      const maxH = comp.screen === 'top' ? topHeight : bottomHeight;
      const screenLabel = comp.screen === 'top' ? `Top screen (${maxW}x${maxH})` : `Bottom screen (${maxW}x${maxH})`;

      if (comp.x < 0) {
        issues.push({
          level: 'warn',
          componentId: comp.id,
          property: 'x',
          value: comp.x,
          message: `Element starts outside left edge of ${screenLabel}.`
        });
      }
      if (comp.y < 0) {
        issues.push({
          level: 'warn',
          componentId: comp.id,
          property: 'y',
          value: comp.y,
          message: `Element starts above top edge of ${screenLabel}.`
        });
      }
      if (comp.x + comp.width > maxW) {
        issues.push({
          level: 'warn',
          componentId: comp.id,
          property: 'x + width',
          value: comp.x + comp.width,
          message: `Element exceeds ${screenLabel} width (${comp.x + comp.width} > ${maxW}px).`
        });
      }
      if (comp.y + comp.height > maxH) {
        issues.push({
          level: 'warn',
          componentId: comp.id,
          property: 'y + height',
          value: comp.y + comp.height,
          message: `Element exceeds ${screenLabel} height (${comp.y + comp.height} > ${maxH}px).`
        });
      }

      // 6. Parent reference check
      if (comp.parent) {
        const parentComp = components.find(c => c.id === comp.parent);
        if (!parentComp) {
          issues.push({
            level: 'error',
            componentId: comp.id,
            property: 'parent',
            value: comp.parent,
            message: `Broken parent reference: Parent "${comp.parent}" does not exist in this screen.`
          });
        } else if (parentComp.screen !== comp.screen) {
          issues.push({
            level: 'error',
            componentId: comp.id,
            property: 'parent',
            value: comp.parent,
            message: `Parent "${comp.parent}" is on screen "${parentComp.screen}" while child is on "${comp.screen}".`
          });
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
