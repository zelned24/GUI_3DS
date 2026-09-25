/**
 * BaseScreen.js
 * Abstract foundation for all Nintendo 3DS game screens in GUI_3DS.
 * Strictly separates Top Screen (400x240) and Bottom Screen (320x240) mounting.
 */

export class BaseScreen {
  constructor(appShell) {
    this.appShell = appShell;
    this.topEl = null;
    this.bottomEl = null;
    this.isMounted = false;
  }

  /**
   * Mounts the screen into the dual-screen viewports.
   */
  mount(topContainer, bottomContainer) {
    this.topEl = topContainer;
    this.bottomEl = bottomContainer;
    this.isMounted = true;
    this.topEl.innerHTML = '';
    this.bottomEl.innerHTML = '';
  }

  async enter(payload = {}) {
    // Override in subclass
  }

  async exit() {
    // Override in subclass
  }

  destroy() {
    if (this.topEl) this.topEl.innerHTML = '';
    if (this.bottomEl) this.bottomEl.innerHTML = '';
    this.isMounted = false;
  }

  handleInput(gameInput) {
    // Override in subclass if handling D-Pad / Keys
    return false;
  }
}
