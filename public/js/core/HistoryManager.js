/**
 * HistoryManager - Undo / Redo command stack.
 */
export class HistoryManager {
  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
  }

  /**
   * Push a command onto the stack and execute it if not already executed.
   * Command interface: { execute(), undo(), description: string }
   */
  execute(command) {
    if (typeof command.execute === 'function') {
      command.execute();
    }
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this._notify();
  }

  /**
   * Push an action that is already executed.
   */
  push(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this._notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    const command = this.undoStack.pop();
    if (typeof command.undo === 'function') {
      command.undo();
    }
    this.redoStack.push(command);
    this._notify();
    return command;
  }

  redo() {
    if (!this.canRedo()) return null;
    const command = this.redoStack.pop();
    if (typeof command.execute === 'function') {
      command.execute();
    }
    this.undoStack.push(command);
    this._notify();
    return command;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener({
          canUndo: this.canUndo(),
          canRedo: this.canRedo(),
          undoCount: this.undoStack.length,
          redoCount: this.redoStack.length
        });
      } catch (err) {
        console.error('Error in HistoryManager listener:', err);
      }
    }
  }
}
