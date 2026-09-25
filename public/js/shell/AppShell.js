/**
 * AppShell.js
 * Master orchestrator for the Nintendo 3DS GUI_3DS playable application.
 * Controls the active state, screen transitions, input routing, and mode toggling.
 */

import { ScreenManager } from './ScreenManager.js';
import { InputManager } from './InputManager.js';
import { WaveManager } from '../wave/WaveManager.js';
import { TitleScreen } from '../screens/TitleScreen.js';
import { RunSetupScreen } from '../screens/RunSetupScreen.js';
import { WaveIntroScreen } from '../screens/WaveIntroScreen.js';
import { BattleScreen } from '../screens/BattleScreen.js';
import { BattleResultScreen } from '../screens/BattleResultScreen.js';
import { RunSummaryScreen } from '../screens/RunSummaryScreen.js';
import { OptionsScreen } from '../screens/OptionsScreen.js';

export const AppStates = {
  BOOT: 'BOOT',
  TITLE: 'TITLE',
  SETUP: 'SETUP',
  OPTIONS: 'OPTIONS',
  WAVE_INTRO: 'WAVE_INTRO',
  BATTLE: 'BATTLE',
  RESULT: 'RESULT',
  REWARD: 'REWARD',
  RUN_SUMMARY: 'RUN_SUMMARY',
  DEBUG: 'DEBUG'
};

export class AppShell {
  constructor(options = {}) {
    this.topContainer = options.topContainer || null;
    this.bottomContainer = options.bottomContainer || null;
    this.currentState = AppStates.BOOT;
    this.audioHooks = [];
    this.listeners = [];

    this.inputManager = new InputManager(this);
    this.screenManager = new ScreenManager(this);
    this.waveManager = new WaveManager();

    // Register all core game screens
    this.screenManager.registerScreen(AppStates.TITLE, TitleScreen);
    this.screenManager.registerScreen(AppStates.SETUP, RunSetupScreen);
    this.screenManager.registerScreen(AppStates.OPTIONS, OptionsScreen);
    this.screenManager.registerScreen(AppStates.WAVE_INTRO, WaveIntroScreen);
    this.screenManager.registerScreen(AppStates.BATTLE, BattleScreen);
    this.screenManager.registerScreen(AppStates.RESULT, BattleResultScreen);
    this.screenManager.registerScreen(AppStates.RUN_SUMMARY, RunSummaryScreen);

    // Development / Studio mode callback (when user switches to developer mode)
    this.onEnterDebug = options.onEnterDebug || null;
  }

  init() {
    this.inputManager.attach();
    this.transitionTo(AppStates.TITLE);
  }

  /**
   * Controlled transition between application states.
   * @param {string} nextState
   * @param {object} payload
   */
  async transitionTo(nextState, payload = {}) {
    if (!AppStates[nextState]) {
      throw new Error(`Invalid AppState: ${nextState}`);
    }

    const prevState = this.currentState;
    this.currentState = nextState;

    // Dispatch lifecycle hook
    this._emitAudioHook(`STATE_${nextState}`);

    if (nextState === AppStates.DEBUG) {
      if (typeof this.onEnterDebug === 'function') {
        this.onEnterDebug();
      }
      this._notifyChange(prevState, nextState, payload);
      return;
    }

    await this.screenManager.transitionTo(nextState, payload);
    this._notifyChange(prevState, nextState, payload);
  }

  /**
   * Starts a new run with the chosen player Pokémon and level.
   * Optionally allows jumping to startWave for QA / Debug testing.
   */
  startNewRun(playerConfig = {}, startWave = 1) {
    this.waveManager.resetRun(playerConfig, startWave);
    this.transitionTo(AppStates.WAVE_INTRO, {
      waveDefinition: this.waveManager.getCurrentWaveDefinition(),
      runState: this.waveManager.getRunState()
    });
  }

  /**
   * Advances to next wave or run summary if wave 10 is reached.
   */
  advanceWave() {
    const nextWaveDef = this.waveManager.advanceWave();
    if (this.waveManager.isRunComplete()) {
      this.transitionTo(AppStates.RUN_SUMMARY, {
        runSummary: this.waveManager.getRunSummary()
      });
    } else {
      this.transitionTo(AppStates.WAVE_INTRO, {
        waveDefinition: nextWaveDef,
        runState: this.waveManager.getRunState()
      });
    }
  }

  /**
   * Audio event hook dispatcher.
   */
  _emitAudioHook(cue) {
    this.audioHooks.push({ cue, timestampStep: this.audioHooks.length });
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notifyChange(from, to, payload) {
    this.listeners.forEach(fn => fn({ from, to, payload }));
  }

  destroy() {
    this.inputManager.detach();
    this.screenManager.destroy();
  }
}
