/**
 * InputManager.js
 * Unified input listener and state locker for Nintendo 3DS GUI_3DS.
 * Translates Keyboard, Mouse clicks, and Touch interactions into game input actions.
 */

export class InputManager {
  constructor(appShell) {
    this.appShell = appShell;
    this.locks = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  attach() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
    }
  }

  detach() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    this.locks.clear();
  }

  lock(reason = 'ACTION_EXECUTION') {
    this.locks.add(reason);
  }

  unlock(reason = 'ACTION_EXECUTION') {
    this.locks.delete(reason);
  }

  isLocked() {
    return this.locks.size > 0;
  }

  _onKeyDown(e) {
    if (this.isLocked()) {
      return;
    }

    let action = null;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        action = 'NAV_UP';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        action = 'NAV_DOWN';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        action = 'NAV_LEFT';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        action = 'NAV_RIGHT';
        break;
      case 'Enter':
      case ' ':
        action = 'CONFIRM';
        break;
      case 'Escape':
      case 'Backspace':
        action = 'CANCEL';
        break;
      case '1':
        action = 'COMMAND_1';
        break;
      case '2':
        action = 'COMMAND_2';
        break;
      case '3':
        action = 'COMMAND_3';
        break;
      case '4':
        action = 'COMMAND_4';
        break;
    }

    if (action) {
      const handled = this.appShell.screenManager.handleInput({
        action,
        key: e.key,
        source: 'KEYBOARD'
      });
      if (handled) {
        e.preventDefault();
      }
    }
  }
}
