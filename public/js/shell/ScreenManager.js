/**
 * ScreenManager.js
 * Centralized screen lifecycle and transition manager for GUI_3DS.
 * Manages mounting, unmounting, and updating active screens in the 3DS Dual Viewport.
 */

export class ScreenManager {
  constructor(appShell) {
    this.appShell = appShell;
    this.screens = new Map(); // stateName -> ScreenClass
    this.activeScreen = null;
    this.activeScreenState = null;
  }

  registerScreen(stateName, ScreenClass) {
    this.screens.set(stateName, ScreenClass);
  }

  /**
   * Controlled transition to a new screen.
   */
  async transitionTo(stateName, payload = {}) {
    const ScreenClass = this.screens.get(stateName);
    if (!ScreenClass) {
      throw new Error(`ScreenManager: No screen registered for state "${stateName}"`);
    }

    if (this.activeScreen) {
      await this.activeScreen.exit();
      this.activeScreen.destroy();
      this.activeScreen = null;
    }

    const instance = new ScreenClass(this.appShell);
    this.activeScreen = instance;
    this.activeScreenState = stateName;

    if (this.appShell.topContainer && this.appShell.bottomContainer) {
      instance.mount(this.appShell.topContainer, this.appShell.bottomContainer);
    }

    await instance.enter(payload);
  }

  handleInput(gameInput) {
    if (this.activeScreen && typeof this.activeScreen.handleInput === 'function') {
      return this.activeScreen.handleInput(gameInput);
    }
    return false;
  }

  destroy() {
    if (this.activeScreen) {
      this.activeScreen.destroy();
      this.activeScreen = null;
    }
    this.screens.clear();
  }
}
