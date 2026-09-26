import { AnimationTrack } from '../animation/AnimationTrack.js';
import { Keyframe, InterpolationTypes } from '../animation/Keyframe.js';
import { Interpolation } from '../animation/Interpolation.js';
import { ClipLibrary } from '../animation/ClipLibrary.js';

/**
 * TimelineUI - Professional 2D Scene Timeline and Playhead Editor for Nintendo 3DS.
 * 
 * Features:
 * - Frame-based temporal timeline (60 FPS standard)
 * - Interactive Playhead with bidirectional real-time scrubbing
 * - Playback Engine (Play, Pause, Stop, Loop, Speeds: 0.25x, 0.5x, 1x, 2x, 4x)
 * - Track management grouped by Scene Node (Position X/Y, Scale X/Y, Rotation, Opacity, Visibility)
 * - Keyframe manipulation (Add, Delete, Move with integer frame snapping, Selection)
 * - Interpolation curves: Step, Linear, Ease In, Ease Out, Ease In Out, Bezier
 * - Multi-keyframe selection & group operations (Group move, Copy, Paste, Duplicate, Delete)
 * - Graph Editor mode for fine numeric curve & tangent handle editing
 * - Timeline markers and audio cues authoring
 * - Frame snapping across markers, audio cues, and keyframes
 * - Auto-Key recording toggle
 * - Undo/Redo integration with HistoryManager
 */
export class TimelineUI {
  /**
   * @param {HTMLElement} containerElement 
   * @param {ProjectModel} projectModel 
   * @param {SelectionManager} selectionManager 
   * @param {CanvasRenderer} canvasRenderer 
   */
  constructor(containerElement, projectModel, selectionManager, canvasRenderer, historyManager = null) {
    if (containerElement && !containerElement.nodeType && typeof containerElement === 'object' && !projectModel) {
      const opts = containerElement;
      this.container = opts.container || null;
      this.model = opts.projectModel || opts.sceneModel || opts.model || null;
      this.selection = opts.selectionManager || opts.selection || null;
      this.renderer = opts.canvasRenderer || opts.renderer || null;
      this._historyManager = opts.historyManager || opts.history || null;
    } else {
      this.container = containerElement || null;
      this.model = projectModel || null;
      this.selection = selectionManager || null;
      this.renderer = canvasRenderer || null;
      this._historyManager = historyManager || null;
    }

    // View & Zoom configuration
    this.pxPerFrame = 8; // Pixels per frame on the ruler
    this.minPxPerFrame = 2;
    this.maxPxPerFrame = 32;
    this.rulerHeight = 28;
    this.rowHeight = 26;

    // Playback state
    this.isPlaying = false;
    this.isLooping = true;
    this.playbackSpeed = 1.0;
    this.autoKeyEnabled = false;
    this._playAnimId = null;
    this._lastPlayTimestamp = 0;
    this._fractionalFrame = 0;

    // Interaction & View state (BETA-UI-6)
    this.viewMode = 'timeline'; // 'timeline' | 'graph'
    this.snapEnabled = true;
    this.clipboard = [];
    this.isScrubbing = false;
    this.draggingKeyframe = null; // { track, keyframe, startFrame, mouseStartX }
    this.selectedKeyframes = new Set(); // Set of Keyframe instances
    this.selectedKeyframeMap = new Map(); // Keyframe -> AnimationTrack
    this.isMarquee = false;
    this.marqueeStart = null;
    this.marqueeEnd = null;

    // Expanded nodes set
    this.expandedNodes = new Set();

    this._initUI();
    this._setupModelListeners();
  }

  get activeScene() {
    if (!this.model) return null;
    if (typeof this.model.getActiveScreen === 'function') {
      return this.model.getActiveScreen();
    }
    if (this.model.activeScene) return this.model.activeScene;
    if (this.model.scene) return this.model.scene;
    return this.model;
  }

  _setupModelListeners() {
    if (this.model && typeof this.model.on === 'function') {
      this.model.on('sceneChanged', () => this.render());
      this.model.on('screenChanged', () => this.render());
    }
  }

  _pushHistory(command) {
    const h = this._historyManager || this.model?.history;
    if (h) {
      if (typeof h.push === 'function') {
        h.push(command);
      } else if (typeof h.execute === 'function') {
        h.execute(command);
      }
    }
  }

  _initUI() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="timeline-root">
        <!-- TOP TOOLBAR: CONTROLS, TIME READOUT, ZOOM -->
        <div class="timeline-toolbar">
          <div class="tl-controls-left">
            <span class="tl-title">TIMELINE</span>
            <div class="btn-group">
              <button id="tl_btn_jump_start" class="tl-btn" title="Jump to Start (Home)">|◀</button>
              <button id="tl_btn_prev_frame" class="tl-btn" title="Previous Frame (Left Arrow)">⏮</button>
              <button id="tl_btn_play_pause" class="tl-btn tl-btn-play" title="Play / Pause (Space)">▶</button>
              <button id="tl_btn_stop" class="tl-btn" title="Stop and Return to Start">■</button>
              <button id="tl_btn_next_frame" class="tl-btn" title="Next Frame (Right Arrow)">⏭</button>
              <button id="tl_btn_jump_end" class="tl-btn" title="Jump to End (End)">▶|</button>
            </div>

            <button id="tl_btn_loop" class="tl-btn active" title="Toggle Loop Playback">🔁</button>
            
            <div class="tl-speed-wrap">
              <select id="tl_select_speed" title="Playback Preview Speed">
                <option value="0.25">0.25×</option>
                <option value="0.5">0.5×</option>
                <option value="1.0" selected>1.0×</option>
                <option value="2.0">2.0×</option>
                <option value="4.0">4.0×</option>
              </select>
            </div>

            <button id="tl_btn_autokey" class="tl-btn tl-btn-autokey" title="Toggle Auto-Key Record Mode">🔴 Auto-Key</button>
          </div>

          <!-- TIME READOUT & DURATION -->
          <div class="tl-controls-center">
            <div class="tl-time-box">
              <span class="tl-label">FRAME</span>
              <input type="number" id="tl_input_frame" class="tl-input-frame" value="0" min="0" />
              <span class="tl-divider">/</span>
              <input type="number" id="tl_input_duration" class="tl-input-duration" value="60" min="1" title="Scene Duration (frames)" />
            </div>

            <div class="tl-time-display">
              <span id="tl_timecode" class="tl-timecode">00:00.000</span>
              <span id="tl_fps_badge" class="tl-fps-badge">60 FPS</span>
            </div>
          </div>

          <!-- ZOOM & TOOLS & ADD TRACK -->
          <div class="tl-controls-right">
            <div class="btn-group">
              <button id="tl_btn_view_mode" class="tl-btn" title="Toggle Graph Editor Mode">📊 Graph</button>
              <button id="tl_btn_snap" class="tl-btn active" title="Toggle Frame Snapping">🧲 Snap</button>
            </div>
            <div class="btn-group">
              <button id="tl_btn_copy_keys" class="tl-btn" title="Copy Selected Keyframes (Ctrl+C)">📋</button>
              <button id="tl_btn_paste_keys" class="tl-btn" title="Paste Keyframes (Ctrl+V)">📌</button>
              <button id="tl_btn_dup_keys" class="tl-btn" title="Duplicate Selected (Ctrl+D)">⧉</button>
              <button id="tl_btn_del_keys" class="tl-btn" title="Delete Selected Keyframes (Del)">🗑</button>
            </div>
            <div class="btn-group">
              <button id="tl_btn_zoom_out" class="tl-btn" title="Zoom Out Timeline">−</button>
              <button id="tl_btn_zoom_fit" class="tl-btn" title="Fit Timeline to View">Fit</button>
              <button id="tl_btn_zoom_in" class="tl-btn" title="Zoom In Timeline">+</button>
            </div>
            <button id="tl_btn_add_track_menu" class="tl-btn tl-btn-primary" title="Add Animation Track">+ Track</button>
          </div>
        </div>

        <!-- TIMELINE BODY: LEFT HEADERS & RIGHT LANES -->
        <div class="timeline-body" id="tl_body">
          <!-- LEFT: TRACK HEADERS LIST -->
          <div class="tl-headers-column" id="tl_headers_col">
            <div class="tl-headers-top-bar">
              <span>Track Channels</span>
              <span id="tl_track_count" class="tl-track-count">0 tracks</span>
            </div>
            <div class="tl-headers-scroll" id="tl_headers_scroll">
              <div id="tl_headers_list"></div>
            </div>
          </div>

          <!-- RIGHT: RULER & LANES SCROLL VIEWPORT -->
          <div class="tl-lanes-viewport" id="tl_lanes_viewport">
            <!-- TOP RULER -->
            <div class="tl-ruler-container" id="tl_ruler_container">
              <canvas id="tl_ruler_canvas" height="28"></canvas>
            </div>

            <!-- LANES CONTENT -->
            <div class="tl-lanes-scroll" id="tl_lanes_scroll">
              <div class="tl-lanes-grid" id="tl_lanes_grid">
                <canvas id="tl_lanes_canvas"></canvas>
                <!-- Interactive Playhead Line -->
                <div class="tl-playhead" id="tl_playhead">
                  <div class="tl-playhead-head">▲</div>
                  <div class="tl-playhead-line"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- KEYFRAME CONTEXT / EDIT POPUP -->
        <div class="tl-context-menu" id="tl_context_menu" style="display: none;"></div>
      </div>
    `;

    this._bindControls();
    this._bindScrubbingAndCanvasEvents();
    this.render();
  }

  _setupModelListeners() {
    if (this.model && typeof this.model.on === 'function') {
      this.model.on('screenChanged', () => {
        this.stop();
        this.render();
      });
      this.model.on('screenLoaded', () => {
        this.render();
      });
      this.model.on('componentAdded', () => {
        this.render();
      });
      this.model.on('componentRemoved', () => {
        this.render();
      });
    }
    if (this.selection && typeof this.selection.on === 'function') {
      this.selection.on('selectionChanged', () => {
        this.render();
      });
    }
  }

  _bindControls() {
    const playPauseBtn = this.container.querySelector('#tl_btn_play_pause');
    const stopBtn = this.container.querySelector('#tl_btn_stop');
    const prevBtn = this.container.querySelector('#tl_btn_prev_frame');
    const nextBtn = this.container.querySelector('#tl_btn_next_frame');
    const jumpStartBtn = this.container.querySelector('#tl_btn_jump_start');
    const jumpEndBtn = this.container.querySelector('#tl_btn_jump_end');
    const loopBtn = this.container.querySelector('#tl_btn_loop');
    const speedSelect = this.container.querySelector('#tl_select_speed');
    const autoKeyBtn = this.container.querySelector('#tl_btn_autokey');

    const frameInput = this.container.querySelector('#tl_input_frame');
    const durationInput = this.container.querySelector('#tl_input_duration');

    const zoomInBtn = this.container.querySelector('#tl_btn_zoom_in');
    const zoomOutBtn = this.container.querySelector('#tl_btn_zoom_out');
    const zoomFitBtn = this.container.querySelector('#tl_btn_zoom_fit');
    const addTrackBtn = this.container.querySelector('#tl_btn_add_track_menu');

    playPauseBtn?.addEventListener('click', () => this.togglePlay());
    stopBtn?.addEventListener('click', () => this.stop());
    prevBtn?.addEventListener('click', () => this.stepFrame(-1));
    nextBtn?.addEventListener('click', () => this.stepFrame(1));
    jumpStartBtn?.addEventListener('click', () => this.seek(0));
    jumpEndBtn?.addEventListener('click', () => {
      const dur = this.activeScene?.durationFrames ?? 60;
      this.seek(dur);
    });

    loopBtn?.addEventListener('click', () => {
      this.isLooping = !this.isLooping;
      loopBtn.classList.toggle('active', this.isLooping);
    });

    speedSelect?.addEventListener('change', (e) => {
      this.playbackSpeed = parseFloat(e.target.value) || 1.0;
    });

    autoKeyBtn?.addEventListener('click', () => {
      this.autoKeyEnabled = !this.autoKeyEnabled;
      autoKeyBtn.classList.toggle('active', this.autoKeyEnabled);
    });

    frameInput?.addEventListener('change', (e) => {
      const f = parseInt(e.target.value, 10);
      if (!isNaN(f)) this.seek(f);
    });

    durationInput?.addEventListener('change', (e) => {
      const d = parseInt(e.target.value, 10);
      if (!isNaN(d) && d >= 1 && this.activeScene) {
        this.activeScene.durationFrames = d;
        this.render();
      }
    });

    zoomInBtn?.addEventListener('click', () => this.setZoom(this.pxPerFrame * 1.3));
    zoomOutBtn?.addEventListener('click', () => this.setZoom(this.pxPerFrame / 1.3));
    zoomFitBtn?.addEventListener('click', () => this.fitZoom());

    addTrackBtn?.addEventListener('click', (e) => this._showAddTrackMenu(e));

    // View Mode & Snapping & Clipboard Controls (BETA-UI-6)
    const viewModeBtn = this.container.querySelector('#tl_btn_view_mode');
    const snapBtn = this.container.querySelector('#tl_btn_snap');
    const copyBtn = this.container.querySelector('#tl_btn_copy_keys');
    const pasteBtn = this.container.querySelector('#tl_btn_paste_keys');
    const dupBtn = this.container.querySelector('#tl_btn_dup_keys');
    const delBtn = this.container.querySelector('#tl_btn_del_keys');

    viewModeBtn?.addEventListener('click', () => {
      this.setViewMode(this.viewMode === 'graph' ? 'timeline' : 'graph');
    });

    snapBtn?.addEventListener('click', () => {
      this.snapEnabled = !this.snapEnabled;
      snapBtn.classList.toggle('active', this.snapEnabled);
    });

    copyBtn?.addEventListener('click', () => this.copySelectedKeyframes());
    pasteBtn?.addEventListener('click', () => this.pasteKeyframes());
    dupBtn?.addEventListener('click', () => this.duplicateSelectedKeyframes());
    delBtn?.addEventListener('click', () => this.deleteSelectedKeyframes());

    // Global Keyboard Shortcuts (BETA-UI-6)
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        this.copySelectedKeyframes();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        this.pasteKeyframes();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.duplicateSelectedKeyframes();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelectedKeyframes();
      }
    });

    // Synchronize vertical scrolling between headers and lanes
    const headersScroll = this.container.querySelector('#tl_headers_scroll');
    const lanesScroll = this.container.querySelector('#tl_lanes_scroll');
    if (lanesScroll && headersScroll) {
      lanesScroll.addEventListener('scroll', () => {
        headersScroll.scrollTop = lanesScroll.scrollTop;
      });
      headersScroll.addEventListener('scroll', () => {
        lanesScroll.scrollTop = headersScroll.scrollTop;
      });
    }
  }

  _bindScrubbingAndCanvasEvents() {
    const rulerCanvas = this.container.querySelector('#tl_ruler_canvas');
    const lanesCanvas = this.container.querySelector('#tl_lanes_canvas');
    const lanesScroll = this.container.querySelector('#tl_lanes_scroll');

    const handleScrubStart = (clientX) => {
      const rect = lanesScroll.getBoundingClientRect();
      const scrollX = lanesScroll.scrollLeft;
      const xInLanes = (clientX - rect.left) + scrollX;
      let frame = Math.max(0, Math.round(xInLanes / this.pxPerFrame));
      if (this.snapEnabled) frame = this.snapFrame(frame);
      this.seek(frame);
      this.isScrubbing = true;
    };

    rulerCanvas?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      handleScrubStart(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isScrubbing && lanesScroll) {
        const rect = lanesScroll.getBoundingClientRect();
        const scrollX = lanesScroll.scrollLeft;
        const xInLanes = (e.clientX - rect.left) + scrollX;
        let frame = Math.max(0, Math.round(xInLanes / this.pxPerFrame));
        if (this.snapEnabled) frame = this.snapFrame(frame);
        this.seek(frame);
        return;
      }

      // Rubber-band marquee selection
      if (this.isMarquee && lanesCanvas) {
        const rect = lanesCanvas.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        this.marqueeEnd = { x: curX, y: curY };
        this.selectKeyframesInRect({
          minX: Math.min(this.marqueeStart.x, curX),
          maxX: Math.max(this.marqueeStart.x, curX),
          minY: Math.min(this.marqueeStart.y, curY),
          maxY: Math.max(this.marqueeStart.y, curY)
        });
        this.render();
        return;
      }

      // Dragging keyframe(s)
      if (this.draggingKeyframe && lanesScroll) {
        const rect = lanesScroll.getBoundingClientRect();
        const scrollX = lanesScroll.scrollLeft;
        const xInLanes = (e.clientX - rect.left) + scrollX;
        let newFrame = Math.max(0, Math.round(xInLanes / this.pxPerFrame));
        if (this.snapEnabled) newFrame = this.snapFrame(newFrame);
        const deltaFrames = newFrame - this.draggingKeyframe.startFrame;

        if (deltaFrames !== 0) {
          const moved = this.moveSelectedKeyframes(deltaFrames);
          if (moved) {
            this.draggingKeyframe.startFrame = newFrame;
            this.seek(newFrame);
            this.render();
          }
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isScrubbing) {
        this.isScrubbing = false;
      }
      if (this.isMarquee) {
        this.isMarquee = false;
        this.marqueeStart = null;
        this.marqueeEnd = null;
        this.render();
      }
      if (this.draggingKeyframe) {
        this.draggingKeyframe = null;
      }
    });

    // Keyframe click & drag detection on lanes canvas
    lanesCanvas?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = lanesCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const hit = this._hitTestKeyframe(clickX, clickY);
      if (hit) {
        if (e.ctrlKey || e.metaKey) {
          this.selectKeyframe(hit.track, hit.keyframe, false, true);
        } else if (e.shiftKey) {
          this.selectKeyframe(hit.track, hit.keyframe, true, false);
        } else {
          if (!this.selectedKeyframes.has(hit.keyframe)) {
            this.selectKeyframe(hit.track, hit.keyframe, false, false);
          }
        }

        this.draggingKeyframe = {
          track: hit.track,
          keyframe: hit.keyframe,
          startFrame: hit.keyframe.frame
        };
        this.seek(hit.keyframe.frame);
        this.render();
        e.stopPropagation();
      } else {
        if (e.shiftKey || e.ctrlKey) {
          this.isMarquee = true;
          this.marqueeStart = { x: clickX, y: clickY };
          this.marqueeEnd = { x: clickX, y: clickY };
        } else {
          this.clearKeyframeSelection();
          handleScrubStart(e.clientX);
        }
      }
    });

    // Double-click on lane adds keyframe
    lanesCanvas?.addEventListener('dblclick', (e) => {
      const rect = lanesCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      let clickedFrame = Math.max(0, Math.round(clickX / this.pxPerFrame));
      if (this.snapEnabled) clickedFrame = this.snapFrame(clickedFrame);

      const track = this._getTrackAtY(clickY);
      if (track) {
        const scene = this.activeScene;
        const node = scene?.getNode(track.targetNodeId);
        if (node) {
          const val = this._getNodePropertyValue(node, track.propertyPath);
          this.addKeyframe(track, clickedFrame, val);
          this.seek(clickedFrame);
        }
      }
    });

    // Context menu on right click
    lanesCanvas?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = lanesCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const hit = this._hitTestKeyframe(clickX, clickY);

      if (hit) {
        this._showKeyframeContextMenu(e.clientX, e.clientY, hit.track, hit.keyframe);
      }
    });
  }

  // --- Zoom Controls ---

  setZoom(pxPerFrame) {
    this.pxPerFrame = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, pxPerFrame));
    this.render();
  }

  fitZoom() {
    const lanesViewport = this.container.querySelector('#tl_lanes_viewport');
    const duration = this.activeScene?.durationFrames || 60;
    if (lanesViewport && duration > 0) {
      const availWidth = lanesViewport.clientWidth - 40;
      this.pxPerFrame = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, availWidth / duration));
      this.render();
    }
  }

  // --- Playback Controls ---

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    const scene = this.activeScene;
    if (!scene) return;

    this.isPlaying = true;
    this._lastPlayTimestamp = performance.now();
    this._fractionalFrame = scene.currentFrame;

    const playPauseBtn = this.container.querySelector('#tl_btn_play_pause');
    if (playPauseBtn) {
      playPauseBtn.textContent = '⏸';
      playPauseBtn.classList.add('playing');
    }

    const step = (timestamp) => {
      if (!this.isPlaying) return;
      const deltaMs = timestamp - this._lastPlayTimestamp;
      this._lastPlayTimestamp = timestamp;

      const fps = scene.fps || 60;
      const framesToAdvance = (deltaMs / 1000) * fps * this.playbackSpeed;
      this._fractionalFrame += framesToAdvance;

      let nextFrame = Math.round(this._fractionalFrame);
      if (nextFrame > scene.durationFrames) {
        if (this.isLooping) {
          nextFrame = 0;
          this._fractionalFrame = 0;
        } else {
          nextFrame = scene.durationFrames;
          this.pause();
        }
      }

      scene.seek(nextFrame);
      this._updatePlayheadUI();
      if (this.renderer) {
        this.renderer.render();
      }

      if (this.isPlaying) {
        this._playAnimId = requestAnimationFrame(step);
      }
    };

    this._playAnimId = requestAnimationFrame(step);
  }

  pause() {
    this.isPlaying = false;
    if (this._playAnimId) {
      cancelAnimationFrame(this._playAnimId);
      this._playAnimId = null;
    }
    const playPauseBtn = this.container.querySelector('#tl_btn_play_pause');
    if (playPauseBtn) {
      playPauseBtn.textContent = '▶';
      playPauseBtn.classList.remove('playing');
    }
  }

  stop() {
    this.pause();
    this.seek(0);
  }

  stepFrame(delta) {
    const scene = this.activeScene;
    if (!scene) return;
    this.seek(scene.currentFrame + delta);
  }

  seek(frame) {
    const scene = this.activeScene;
    if (!scene) return;

    const clamped = scene.seek(frame);
    this._fractionalFrame = clamped;
    this._updatePlayheadUI();
    if (this.renderer) {
      this.renderer.render();
    }
  }

  // --- Keyframe & Track Actions with Undo / Redo ---

  addKeyframe(track, frame, value, interpolation = InterpolationTypes.LINEAR) {
    if (!track) return null;
    const existing = track.getKeyframeAt(frame);
    const oldValue = existing ? existing.value : undefined;
    const oldInterp = existing ? existing.interpolation : undefined;

    const kf = track.addKeyframe(frame, value, interpolation);

    // Push Undo command
    this._pushHistory({
      description: `Add Keyframe at frame ${frame} (${track.displayName})`,
      undo: () => {
        if (oldValue !== undefined) {
          track.addKeyframe(frame, oldValue, oldInterp);
        } else {
          track.removeKeyframe(frame);
        }
        this.render();
      },
      execute: () => {
        track.addKeyframe(frame, value, interpolation);
        this.render();
      }
    });

    this.render();
    return kf;
  }

  deleteKeyframe(track, frame) {
    if (!track) return null;
    const existing = track.getKeyframeAt(frame);
    if (!existing) return null;

    const val = existing.value;
    const interp = existing.interpolation;
    track.removeKeyframe(frame);
    this.selectedKeyframes.delete(existing);

    this._pushHistory({
      description: `Delete Keyframe at frame ${frame} (${track.displayName})`,
      undo: () => {
        track.addKeyframe(frame, val, interp);
        this.render();
      },
      execute: () => {
        track.removeKeyframe(frame);
        this.render();
      }
    });

    this.render();
  }

  moveKeyframe(track, fromFrame, toFrame) {
    if (!track || fromFrame === toFrame) return;
    track.moveKeyframe(fromFrame, toFrame);

    this._pushHistory({
      description: `Move Keyframe ${fromFrame} -> ${toFrame} (${track.displayName})`,
      undo: () => {
        track.moveKeyframe(toFrame, fromFrame);
        this.render();
      },
      execute: () => {
        track.moveKeyframe(fromFrame, toFrame);
        this.render();
      }
    });
  }

  addTrack(nodeId, propertyPath) {
    const scene = this.activeScene;
    if (!scene) return null;

    const track = new AnimationTrack({
      targetNodeId: nodeId,
      propertyPath
    });

    scene.addTrack(track);

    this._pushHistory({
      description: `Add Track ${track.displayName} for ${nodeId}`,
      undo: () => {
        scene.removeTrack(track.id);
        this.render();
      },
      execute: () => {
        scene.addTrack(track);
        this.render();
      }
    });

    this.expandedNodes.add(nodeId);
    this.render();
    return track;
  }

  deleteTrack(trackId) {
    const scene = this.activeScene;
    if (!scene) return;
    const track = scene.getTrack(trackId);
    if (!track) return;

    scene.removeTrack(trackId);

    this._pushHistory({
      description: `Delete Track ${track.displayName}`,
      undo: () => {
        scene.addTrack(track);
        this.render();
      },
      execute: () => {
        scene.removeTrack(trackId);
        this.render();
      }
    });

    this.render();
  }

  // --- Multi-Keyframe Selection (BETA-UI-6) ---

  selectKeyframe(track, keyframe, multi = false, toggle = false) {
    if (!keyframe || !track) return;
    if (!multi && !toggle) {
      this.selectedKeyframes.clear();
      this.selectedKeyframeMap.clear();
    }

    if (toggle) {
      if (this.selectedKeyframes.has(keyframe)) {
        this.selectedKeyframes.delete(keyframe);
        this.selectedKeyframeMap.delete(keyframe);
      } else {
        this.selectedKeyframes.add(keyframe);
        this.selectedKeyframeMap.set(keyframe, track);
      }
    } else {
      this.selectedKeyframes.add(keyframe);
      this.selectedKeyframeMap.set(keyframe, track);
    }

    this.render();
  }

  clearKeyframeSelection() {
    this.selectedKeyframes.clear();
    this.selectedKeyframeMap.clear();
    this.render();
  }

  getSelectedKeyframes() {
    return Array.from(this.selectedKeyframes);
  }

  isKeyframeSelected(track, keyframe) {
    return this.selectedKeyframes.has(keyframe);
  }

  selectKeyframesInRect(rect) {
    const scene = this.activeScene;
    if (!scene) return [];

    const selected = [];
    if (rect.minFrame !== undefined && rect.maxFrame !== undefined) {
      const minF = Math.min(rect.minFrame, rect.maxFrame);
      const maxF = Math.max(rect.minFrame, rect.maxFrame);
      for (const track of scene.tracks) {
        if (rect.trackIds && !rect.trackIds.includes(track.id)) continue;
        for (const kf of track.keyframes) {
          if (kf.frame >= minF && kf.frame <= maxF) {
            this.selectedKeyframes.add(kf);
            this.selectedKeyframeMap.set(kf, track);
            selected.push(kf);
          }
        }
      }
    } else if (rect.minX !== undefined && rect.maxX !== undefined) {
      let currentY = 0;
      const tracksByNode = new Map();
      for (const track of scene.tracks) {
        if (!tracksByNode.has(track.targetNodeId)) tracksByNode.set(track.targetNodeId, []);
        tracksByNode.get(track.targetNodeId).push(track);
      }

      for (const [nodeId, tracks] of tracksByNode.entries()) {
        currentY += this.rowHeight;
        if (this.expandedNodes.has(nodeId)) {
          for (const track of tracks) {
            const laneY = currentY + this.rowHeight / 2;
            if (laneY >= rect.minY && laneY <= rect.maxY) {
              for (const kf of track.keyframes) {
                const kx = kf.frame * this.pxPerFrame;
                if (kx >= rect.minX && kx <= rect.maxX) {
                  this.selectedKeyframes.add(kf);
                  this.selectedKeyframeMap.set(kf, track);
                  selected.push(kf);
                }
              }
            }
            currentY += this.rowHeight;
          }
        }
      }
    }

    this.render();
    return selected;
  }

  // --- Group Movement with Collision Policy (BETA-UI-6) ---

  moveSelectedKeyframes(deltaFrames) {
    if (deltaFrames === 0 || this.selectedKeyframes.size === 0) return false;
    const delta = Math.round(deltaFrames);

    // 1. Collision pre-check: verify boundary and no collision with stationary unselected keyframes
    for (const [kf, track] of this.selectedKeyframeMap.entries()) {
      const targetFrame = kf.frame + delta;
      if (targetFrame < 0) return false;

      const existing = track.getKeyframeAt(targetFrame);
      if (existing && !this.selectedKeyframes.has(existing)) {
        // Deterministic collision policy: reject group move if collision would occur
        return false;
      }
    }

    // 2. Execute move in safe order
    const entries = Array.from(this.selectedKeyframeMap.entries());
    const originalPositions = entries.map(([kf, track]) => ({ kf, track, fromFrame: kf.frame, toFrame: kf.frame + delta }));

    originalPositions.sort((a, b) => delta > 0 ? (b.fromFrame - a.fromFrame) : (a.fromFrame - b.fromFrame));

    for (const item of originalPositions) {
      item.track.moveKeyframe(item.fromFrame, item.toFrame);
    }

    // 3. Register in HistoryManager
    this._pushHistory({
      description: `Group Move ${entries.length} Keyframes by ${delta} frames`,
      undo: () => {
        const revPositions = [...originalPositions].sort((a, b) => delta > 0 ? (a.toFrame - b.toFrame) : (b.toFrame - a.toFrame));
        for (const item of revPositions) {
          item.track.moveKeyframe(item.toFrame, item.fromFrame);
        }
        this.render();
      },
      execute: () => {
        for (const item of originalPositions) {
          item.track.moveKeyframe(item.fromFrame, item.toFrame);
        }
        this.render();
      }
    });

    this.render();
    return true;
  }

  // --- Copy / Paste / Duplicate / Delete (BETA-UI-6) ---

  copySelectedKeyframes() {
    if (this.selectedKeyframes.size === 0) return [];

    const kfs = Array.from(this.selectedKeyframes);
    const minFrame = Math.min(...kfs.map(k => k.frame));

    this.clipboard = [];
    for (const [kf, track] of this.selectedKeyframeMap.entries()) {
      this.clipboard.push({
        trackId: track.id,
        targetNodeId: track.targetNodeId,
        propertyPath: track.propertyPath,
        displayName: track.displayName,
        valueType: track.valueType,
        offset: kf.frame - minFrame,
        value: kf.value,
        interpolation: kf.interpolation,
        curve: kf.curve ? JSON.parse(JSON.stringify(kf.curve)) : null
      });
    }

    return [...this.clipboard];
  }

  pasteKeyframes(targetFrame = null) {
    if (!this.clipboard || this.clipboard.length === 0) return [];
    const scene = this.activeScene;
    if (!scene) return [];

    const baseFrame = targetFrame !== null ? Math.max(0, Math.round(targetFrame)) : (scene.currentFrame || 0);
    const pastedKeyframes = [];
    const addedRecords = [];

    const selectedComp = (this.selection && typeof this.selection.getSelectedComponents === 'function')
      ? this.selection.getSelectedComponents()[0]
      : null;

    for (const item of this.clipboard) {
      const targetNodeId = (selectedComp && selectedComp.id) ? selectedComp.id : item.targetNodeId;
      let track = scene.tracks.find(t => t.targetNodeId === targetNodeId && t.propertyPath === item.propertyPath);
      let trackCreated = false;

      if (!track) {
        track = new AnimationTrack({
          targetNodeId,
          propertyPath: item.propertyPath,
          valueType: item.valueType
        });
        scene.addTrack(track);
        trackCreated = true;
      }

      const destFrame = baseFrame + item.offset;
      const prevKf = track.getKeyframeAt(destFrame);
      const prevValue = prevKf ? prevKf.value : undefined;
      const prevInterp = prevKf ? prevKf.interpolation : undefined;
      const prevCurve = prevKf ? prevKf.curve : undefined;

      const newKf = track.addKeyframe(destFrame, item.value, item.interpolation, item.curve);
      pastedKeyframes.push(newKf);
      this.selectedKeyframes.add(newKf);
      this.selectedKeyframeMap.set(newKf, track);

      addedRecords.push({
        track,
        destFrame,
        trackCreated,
        prevValue,
        prevInterp,
        prevCurve,
        newValue: item.value,
        newInterp: item.interpolation,
        newCurve: item.curve
      });
    }

    this._pushHistory({
      description: `Paste ${addedRecords.length} Keyframes at Frame ${baseFrame}`,
      undo: () => {
        for (const rec of addedRecords) {
          if (rec.prevValue !== undefined) {
            rec.track.addKeyframe(rec.destFrame, rec.prevValue, rec.prevInterp, rec.prevCurve);
          } else {
            rec.track.removeKeyframe(rec.destFrame);
          }
          if (rec.trackCreated && rec.track.keyframes.length === 0) {
            scene.removeTrack(rec.track.id);
          }
        }
        this.render();
      },
      execute: () => {
        for (const rec of addedRecords) {
          rec.track.addKeyframe(rec.destFrame, rec.newValue, rec.newInterp, rec.newCurve);
        }
        this.render();
      }
    });

    this.render();
    return pastedKeyframes;
  }

  duplicateSelectedKeyframes(offsetFrames = 5) {
    if (this.selectedKeyframes.size === 0) return [];
    const offset = Math.max(1, Math.round(offsetFrames));
    const duplicated = [];
    const records = [];

    for (const [kf, track] of this.selectedKeyframeMap.entries()) {
      const destFrame = kf.frame + offset;
      const prev = track.getKeyframeAt(destFrame);
      const prevValue = prev ? prev.value : undefined;
      const prevInterp = prev ? prev.interpolation : undefined;
      const prevCurve = prev ? prev.curve : undefined;

      const newKf = track.addKeyframe(destFrame, kf.value, kf.interpolation, kf.curve ? JSON.parse(JSON.stringify(kf.curve)) : null);
      duplicated.push(newKf);

      records.push({
        track,
        destFrame,
        prevValue,
        prevInterp,
        prevCurve,
        val: kf.value,
        interp: kf.interpolation,
        curve: kf.curve ? JSON.parse(JSON.stringify(kf.curve)) : null
      });
    }

    this.selectedKeyframes.clear();
    this.selectedKeyframeMap.clear();
    for (let i = 0; i < duplicated.length; i++) {
      this.selectedKeyframes.add(duplicated[i]);
      this.selectedKeyframeMap.set(duplicated[i], records[i].track);
    }

    this._pushHistory({
      description: `Duplicate ${records.length} Keyframes (+${offset} frames)`,
      undo: () => {
        for (const rec of records) {
          if (rec.prevValue !== undefined) {
            rec.track.addKeyframe(rec.destFrame, rec.prevValue, rec.prevInterp, rec.prevCurve);
          } else {
            rec.track.removeKeyframe(rec.destFrame);
          }
        }
        this.render();
      },
      execute: () => {
        for (const rec of records) {
          rec.track.addKeyframe(rec.destFrame, rec.val, rec.interp, rec.curve);
        }
        this.render();
      }
    });

    this.render();
    return duplicated;
  }

  deleteSelectedKeyframes() {
    if (this.selectedKeyframes.size === 0) return 0;
    const records = [];

    for (const [kf, track] of this.selectedKeyframeMap.entries()) {
      records.push({
        track,
        frame: kf.frame,
        value: kf.value,
        interpolation: kf.interpolation,
        curve: kf.curve ? JSON.parse(JSON.stringify(kf.curve)) : null
      });
      track.removeKeyframe(kf.frame);
    }

    this.selectedKeyframes.clear();
    this.selectedKeyframeMap.clear();

    this._pushHistory({
      description: `Delete ${records.length} Selected Keyframes`,
      undo: () => {
        for (const rec of records) {
          rec.track.addKeyframe(rec.frame, rec.value, rec.interpolation, rec.curve);
        }
        this.render();
      },
      execute: () => {
        for (const rec of records) {
          rec.track.removeKeyframe(rec.frame);
        }
        this.render();
      }
    });

    this.render();
    return records.length;
  }

  // --- Snapping (BETA-UI-6) ---

  snapFrame(targetFrame, threshold = 3) {
    if (!this.snapEnabled) return Math.max(0, Math.round(targetFrame));
    const scene = this.activeScene;
    if (!scene) return Math.max(0, Math.round(targetFrame));

    const snapPoints = [0, scene.durationFrames];

    for (const m of scene.markers || []) {
      snapPoints.push(m.frame);
    }
    for (const c of scene.audioCues || []) {
      snapPoints.push(c.frame);
    }
    for (const t of scene.tracks || []) {
      for (const k of t.keyframes || []) {
        snapPoints.push(k.frame);
      }
    }
    for (const s of scene.sequence || []) {
      snapPoints.push(s.startFrame);
      snapPoints.push(s.startFrame + s.durationFrames);
    }

    let closest = Math.max(0, Math.round(targetFrame));
    let minDiff = Infinity;

    for (const p of snapPoints) {
      const diff = Math.abs(p - targetFrame);
      if (diff <= threshold && diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    return closest;
  }

  // --- Markers & Audio Cues Authoring (BETA-UI-6) ---

  addMarker(frame = null, name = 'Marker', type = 'Event', metadata = {}) {
    const scene = this.activeScene;
    if (!scene) return null;
    const f = frame !== null ? Math.max(0, Math.round(frame)) : scene.currentFrame;
    const m = scene.addMarker({ frame: f, name, type, metadata });
    this.render();
    return m;
  }

  updateMarker(markerId, updates = {}) {
    const scene = this.activeScene;
    if (!scene) return false;
    const res = scene.updateMarker(markerId, updates);
    this.render();
    return res;
  }

  deleteMarker(markerId) {
    const scene = this.activeScene;
    if (!scene) return false;
    const res = scene.deleteMarker(markerId);
    this.render();
    return res;
  }

  addAudioCue(frame = null, asset = 'se_select', volume = 1.0, channel = 0) {
    const scene = this.activeScene;
    if (!scene) return null;
    const f = frame !== null ? Math.max(0, Math.round(frame)) : scene.currentFrame;
    const cue = scene.addAudioCue({ frame: f, asset, volume, channel });
    this.render();
    return cue;
  }

  updateAudioCue(cueId, updates = {}) {
    const scene = this.activeScene;
    if (!scene) return false;
    const res = scene.updateAudioCue(cueId, updates);
    this.render();
    return res;
  }

  deleteAudioCue(cueId) {
    const scene = this.activeScene;
    if (!scene) return false;
    const res = scene.deleteAudioCue(cueId);
    this.render();
    return res;
  }

  // --- Graph Editor Mode (BETA-UI-6) ---

  setViewMode(mode) {
    if (mode !== 'timeline' && mode !== 'graph') return;
    this.viewMode = mode;
    const viewBtn = this.container?.querySelector('#tl_btn_view_mode');
    if (viewBtn) {
      viewBtn.textContent = mode === 'graph' ? '⏱ Timeline' : '📊 Graph';
    }
    this.render();
  }

  // --- Rendering UI & Canvas ---

  render() {
    if (!this.container) return;
    const scene = this.activeScene;
    if (!scene) return;

    this._updateToolbarUI();
    this._renderHeadersList();
    this._renderRulerAndLanes();
    this._updatePlayheadUI();
  }

  _updateToolbarUI() {
    const scene = this.activeScene;
    if (!scene) return;

    const frameInput = this.container.querySelector('#tl_input_frame');
    const durationInput = this.container.querySelector('#tl_input_duration');
    const timecode = this.container.querySelector('#tl_timecode');
    const fpsBadge = this.container.querySelector('#tl_fps_badge');
    const trackCount = this.container.querySelector('#tl_track_count');

    if (frameInput) frameInput.value = scene.currentFrame;
    if (durationInput) durationInput.value = scene.durationFrames;
    if (timecode) timecode.textContent = scene.getFormattedTime();
    if (fpsBadge) fpsBadge.textContent = `${scene.fps} FPS`;
    if (trackCount) trackCount.textContent = `${scene.tracks.length} track${scene.tracks.length === 1 ? '' : 's'}`;
  }

  _updatePlayheadUI() {
    const scene = this.activeScene;
    if (!scene) return;

    const playheadEl = this.container.querySelector('#tl_playhead');
    const frameInput = this.container.querySelector('#tl_input_frame');
    const timecode = this.container.querySelector('#tl_timecode');

    const xPos = scene.currentFrame * this.pxPerFrame;
    if (playheadEl) {
      playheadEl.style.transform = `translateX(${xPos}px)`;
    }
    if (frameInput) frameInput.value = scene.currentFrame;
    if (timecode) timecode.textContent = scene.getFormattedTime();

    // Redraw ruler to show playhead tick
    this._drawRuler();
  }

  _renderHeadersList() {
    const scene = this.activeScene;
    const headersListEl = this.container.querySelector('#tl_headers_list');
    if (!headersListEl || !scene) return;

    const selectedComp = this.selection.getSelectedComponents()[0];
    const nodes = scene.nodes || [];

    // Group tracks by node
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const tracksByNode = new Map();

    for (const track of scene.tracks) {
      if (!tracksByNode.has(track.targetNodeId)) {
        tracksByNode.set(track.targetNodeId, []);
      }
      tracksByNode.get(track.targetNodeId).push(track);
    }

    if (scene.tracks.length === 0) {
      headersListEl.innerHTML = `
        <div class="tl-empty-state">
          <p>No animation tracks yet</p>
          <button class="tl-btn tl-btn-sm" id="tl_quick_add_track">+ Add Track for Selected Node</button>
        </div>
      `;
      headersListEl.querySelector('#tl_quick_add_track')?.addEventListener('click', (e) => this._showAddTrackMenu(e));
      return;
    }

    let html = '';
    for (const [nodeId, tracks] of tracksByNode.entries()) {
      const node = nodeMap.get(nodeId);
      const nodeName = node ? node.name : nodeId;
      const isSelected = selectedComp && selectedComp.id === nodeId;
      const isExpanded = this.expandedNodes.has(nodeId);

      html += `
        <div class="tl-node-group ${isSelected ? 'selected' : ''}" data-node-id="${nodeId}">
          <div class="tl-node-row">
            <span class="tl-chevron ${isExpanded ? 'expanded' : ''}" data-action="toggle-expand">▶</span>
            <span class="tl-node-name" title="${nodeName}">${nodeName}</span>
            <div class="tl-row-actions">
              <button class="tl-mini-btn" data-action="add-prop" title="Add Property Track">+</button>
            </div>
          </div>
      `;

      if (isExpanded) {
        for (const track of tracks) {
          const hasKeyAtPlayhead = track.hasKeyframeAt(scene.currentFrame);
          html += `
            <div class="tl-track-row" data-track-id="${track.id}">
              <span class="tl-track-indent">↳</span>
              <span class="tl-track-label" title="${track.displayName}">${track.displayName}</span>
              <div class="tl-row-actions">
                <button class="tl-mini-btn tl-btn-mute ${track.muted ? 'active' : ''}" data-action="toggle-mute" title="Mute Track">M</button>
                <button class="tl-mini-btn tl-btn-solo ${track.solo ? 'active' : ''}" data-action="toggle-solo" title="Solo Track">S</button>
                <button class="tl-mini-btn tl-key-indicator ${hasKeyAtPlayhead ? 'keyed' : ''}" data-action="toggle-key" title="Add / Delete Keyframe at Playhead">●</button>
                <button class="tl-mini-btn tl-btn-del" data-action="delete-track" title="Remove Track">✕</button>
              </div>
            </div>
          `;
        }
      }

      html += `</div>`;
    }

    headersListEl.innerHTML = html;

    // Attach row events
    headersListEl.querySelectorAll('.tl-node-row').forEach(row => {
      const groupEl = row.closest('.tl-node-group');
      const nodeId = groupEl.dataset.nodeId;

      row.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'toggle-expand' || e.target.classList.contains('tl-chevron')) {
          if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
          } else {
            this.expandedNodes.add(nodeId);
          }
          this.render();
          return;
        }

        if (e.target.dataset.action === 'add-prop') {
          this._showTrackPropertyMenu(e, nodeId);
          return;
        }

        // Select node in IDE
        this.selection.select(nodeId);
      });
    });

    headersListEl.querySelectorAll('.tl-track-row').forEach(row => {
      const trackId = row.dataset.trackId;
      const track = scene.getTrack(trackId);
      if (!track) return;

      row.querySelector('[data-action="toggle-mute"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        track.muted = !track.muted;
        this.render();
        this.renderer.render();
      });

      row.querySelector('[data-action="toggle-solo"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        track.solo = !track.solo;
        this.render();
        this.renderer.render();
      });

      row.querySelector('[data-action="toggle-key"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const f = scene.currentFrame;
        if (track.hasKeyframeAt(f)) {
          this.deleteKeyframe(track, f);
        } else {
          const node = scene.getNode(track.targetNodeId);
          const val = this._getNodePropertyValue(node, track.propertyPath);
          this.addKeyframe(track, f, val);
        }
      });

      row.querySelector('[data-action="delete-track"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTrack(track.id);
      });
    });
  }

  _renderRulerAndLanes() {
    const scene = this.activeScene;
    if (!scene) return;

    const rulerCanvas = this.container.querySelector('#tl_ruler_canvas');
    const lanesCanvas = this.container.querySelector('#tl_lanes_canvas');
    const lanesGrid = this.container.querySelector('#tl_lanes_grid');
    if (!rulerCanvas || !lanesCanvas || !lanesGrid) return;

    const totalFrames = Math.max(scene.durationFrames, 120);
    const canvasWidth = totalFrames * this.pxPerFrame + 200;

    // Calculate total height based on visible track rows
    let visibleRowsCount = 0;
    const tracksByNode = new Map();
    for (const track of scene.tracks) {
      if (!tracksByNode.has(track.targetNodeId)) tracksByNode.set(track.targetNodeId, []);
      tracksByNode.get(track.targetNodeId).push(track);
    }
    for (const [nodeId, tracks] of tracksByNode.entries()) {
      visibleRowsCount++; // Node row
      if (this.expandedNodes.has(nodeId)) {
        visibleRowsCount += tracks.length;
      }
    }
    const canvasHeight = this.viewMode === 'graph' ? 320 : Math.max(160, visibleRowsCount * this.rowHeight + 40);

    rulerCanvas.width = canvasWidth;
    rulerCanvas.height = this.rulerHeight;

    lanesCanvas.width = canvasWidth;
    lanesCanvas.height = canvasHeight;
    lanesGrid.style.width = `${canvasWidth}px`;
    lanesGrid.style.height = `${canvasHeight}px`;

    this._drawRuler();
    if (this.viewMode === 'graph') {
      this._drawGraphEditor(lanesCanvas.getContext('2d'), canvasWidth, canvasHeight);
    } else {
      this._drawLanes();
    }
  }

  _drawRuler() {
    const rulerCanvas = this.container.querySelector('#tl_ruler_canvas');
    const scene = this.activeScene;
    if (!rulerCanvas || !scene) return;

    const ctx = rulerCanvas.getContext('2d');
    const w = rulerCanvas.width;
    const h = rulerCanvas.height;

    ctx.fillStyle = '#11141c';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#272d40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();

    // Determine tick interval based on zoom
    const frameStep = this.pxPerFrame >= 12 ? 1 : (this.pxPerFrame >= 6 ? 5 : 10);
    const maxFrames = Math.ceil(w / this.pxPerFrame);

    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let f = 0; f <= maxFrames; f += frameStep) {
      const x = Math.round(f * this.pxPerFrame) + 0.5;
      const isMajor = f % 5 === 0;

      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 12 : 20);
      ctx.lineTo(x, h);
      ctx.strokeStyle = isMajor ? '#475569' : '#272d40';
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = (f === scene.currentFrame) ? '#ff4d4d' : '#94a3b8';
        ctx.fillText(String(f), x, 2);
      }
    }

    // Draw active scene duration boundary line
    const durationX = Math.round(scene.durationFrames * this.pxPerFrame) + 0.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(durationX, 0);
    ctx.lineTo(durationX, h);
    ctx.stroke();

    // Draw Timeline Markers (BETA-UI-6)
    for (const m of scene.markers || []) {
      const mx = Math.round(m.frame * this.pxPerFrame);
      const color = m.type === 'Audio' ? '#38bdf8' : (m.type === 'Comment' ? '#4ade80' : (m.type === 'Sync' ? '#c084fc' : '#fbbf24'));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx + 5, 0);
      ctx.lineTo(mx + 5, 7);
      ctx.lineTo(mx, 12);
      ctx.lineTo(mx - 5, 7);
      ctx.lineTo(mx - 5, 0);
      ctx.closePath();
      ctx.fill();
    }

    // Draw Audio Cues on ruler bottom
    for (const c of scene.audioCues || []) {
      const cx = Math.round(c.frame * this.pxPerFrame);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(cx, h - 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawLanes() {
    const lanesCanvas = this.container.querySelector('#tl_lanes_canvas');
    const scene = this.activeScene;
    if (!lanesCanvas || !scene) return;

    const ctx = lanesCanvas.getContext('2d');
    const w = lanesCanvas.width;
    const h = lanesCanvas.height;

    ctx.fillStyle = '#161924';
    ctx.fillRect(0, 0, w, h);

    // Draw frame grid vertical lines
    const frameStep = this.pxPerFrame >= 6 ? 5 : 10;
    const maxFrames = Math.ceil(w / this.pxPerFrame);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let f = 0; f <= maxFrames; f += frameStep) {
      const x = Math.round(f * this.pxPerFrame) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    // Draw scene bounds shade beyond duration
    const durX = scene.durationFrames * this.pxPerFrame;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(durX, 0, w - durX, h);

    // Render lanes and keyframes
    const tracksByNode = new Map();
    for (const track of scene.tracks) {
      if (!tracksByNode.has(track.targetNodeId)) tracksByNode.set(track.targetNodeId, []);
      tracksByNode.get(track.targetNodeId).push(track);
    }

    let currentY = 0;
    for (const [nodeId, tracks] of tracksByNode.entries()) {
      // 1. Node group row
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(0, currentY, w, this.rowHeight);
      ctx.strokeStyle = '#1e2433';
      ctx.strokeRect(0, currentY + 0.5, w, this.rowHeight);

      // Node-level aggregate keyframe markers
      const nodeFrames = new Set();
      for (const t of tracks) {
        for (const k of t.keyframes) nodeFrames.add(k.frame);
      }
      for (const f of nodeFrames) {
        const kx = Math.round(f * this.pxPerFrame);
        const ky = currentY + this.rowHeight / 2;
        this._drawDiamond(ctx, kx, ky, 4, '#64748b', '#475569');
      }

      currentY += this.rowHeight;

      // 2. Expanded track rows
      if (this.expandedNodes.has(nodeId)) {
        for (const track of tracks) {
          ctx.fillStyle = '#161924';
          ctx.fillRect(0, currentY, w, this.rowHeight);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.strokeRect(0, currentY + 0.5, w, this.rowHeight);

          // Span connection line between first and last keyframe
          if (track.keyframes.length >= 2) {
            const firstX = track.keyframes[0].frame * this.pxPerFrame;
            const lastX = track.keyframes[track.keyframes.length - 1].frame * this.pxPerFrame;
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(firstX, currentY + this.rowHeight / 2);
            ctx.lineTo(lastX, currentY + this.rowHeight / 2);
            ctx.stroke();
          }

          // Draw keyframe diamonds
          for (const kf of track.keyframes) {
            const kx = Math.round(kf.frame * this.pxPerFrame);
            const ky = currentY + this.rowHeight / 2;
            const isSelected = this.selectedKeyframes.has(kf);
            const fillColor = isSelected ? '#ffcb05' : '#38bdf8';
            const strokeColor = isSelected ? '#ffffff' : '#0284c7';
            this._drawDiamond(ctx, kx, ky, 6, fillColor, strokeColor);
          }

          currentY += this.rowHeight;
        }
      }
    }

    // 3. Render Rubber-band / Marquee selection rectangle (BETA-UI-6)
    if (this.isMarquee && this.marqueeStart && this.marqueeEnd) {
      const rx = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
      const ry = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
      const rw = Math.abs(this.marqueeStart.x - this.marqueeEnd.x);
      const rh = Math.abs(this.marqueeStart.y - this.marqueeEnd.y);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }
  }

  // --- Graph / Curve Editor Canvas Rendering (BETA-UI-6) ---

  _drawGraphEditor(ctx, w, h) {
    const scene = this.activeScene;
    if (!scene) return;

    ctx.fillStyle = '#0f111a';
    ctx.fillRect(0, 0, w, h);

    // Frame vertical grid lines
    const maxFrames = Math.ceil(w / this.pxPerFrame);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let f = 0; f <= maxFrames; f += 5) {
      const x = Math.round(f * this.pxPerFrame) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    const selectedComp = this.selection?.getSelectedComponents()?.[0];
    const tracksToPlot = (scene.tracks || []).filter(t => {
      if (selectedComp && t.targetNodeId !== selectedComp.id) return false;
      return t.propertyPath.startsWith('transform.') || t.propertyPath === 'opacity' || t.propertyPath === 'x' || t.propertyPath === 'y';
    });

    if (tracksToPlot.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a Node with Animation Tracks to view and edit curves in Graph Editor', w / 2, h / 2);
      return;
    }

    let minV = Infinity;
    let maxV = -Infinity;
    for (const track of tracksToPlot) {
      for (const kf of track.keyframes) {
        if (typeof kf.value === 'number') {
          minV = Math.min(minV, kf.value);
          maxV = Math.max(maxV, kf.value);
        }
      }
    }
    if (!isFinite(minV) || !isFinite(maxV)) {
      minV = 0; maxV = 100;
    }
    if (minV === maxV) {
      minV -= 10; maxV += 10;
    }
    const padding = (maxV - minV) * 0.15 || 5;
    minV -= padding;
    maxV += padding;

    const valueToY = (v) => h - 25 - ((v - minV) / (maxV - minV)) * (h - 50);

    // Value horizontal grid lines
    const valSteps = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= valSteps; i++) {
      const v = minV + (i / valSteps) * (maxV - minV);
      const y = valueToY(v);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(1), 5, y - 2);
    }

    // Zero line
    if (minV <= 0 && maxV >= 0) {
      const y0 = valueToY(0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(w, y0);
      ctx.stroke();
    }

    const propColors = {
      'transform.x': '#ef4444',
      'transform.y': '#22c55e',
      'transform.scaleX': '#38bdf8',
      'transform.scaleY': '#06b6d4',
      'transform.rotation': '#eab308',
      'transform.opacity': '#ec4899',
      'opacity': '#ec4899'
    };

    // Plot curves for each track
    for (const track of tracksToPlot) {
      if (track.keyframes.length === 0) continue;
      const color = propColors[track.propertyPath] || '#a855f7';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      ctx.moveTo(0, valueToY(track.evaluate(0)));
      for (let f = 0; f <= scene.durationFrames; f += 0.5) {
        const val = track.evaluate(f);
        const x = f * this.pxPerFrame;
        const y = valueToY(val);
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Plot keyframe vertex dots and tangent handles
      for (const kf of track.keyframes) {
        const kx = kf.frame * this.pxPerFrame;
        const ky = valueToY(kf.value);
        const isSelected = this.selectedKeyframes.has(kf);

        // Draw tangent handles if selected and has curve data
        if (isSelected && kf.curve) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;

          // Tangent In
          const tin = kf.curve.tangentIn || { x: -10, y: 0 };
          const inX = kx + tin.x * 2;
          const inY = ky - tin.y * 2;
          ctx.beginPath();
          ctx.moveTo(kx, ky);
          ctx.lineTo(inX, inY);
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(inX, inY, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Tangent Out
          const tout = kf.curve.tangentOut || { x: 10, y: 0 };
          const outX = kx + tout.x * 2;
          const outY = ky - tout.y * 2;
          ctx.beginPath();
          ctx.moveTo(kx, ky);
          ctx.lineTo(outX, outY);
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(outX, outY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Keyframe circle
        ctx.fillStyle = isSelected ? '#ffcb05' : color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(kx, ky, isSelected ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  _drawDiamond(ctx, cx, cy, size, fillColor, strokeColor) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  _hitTestKeyframe(x, y) {
    const scene = this.activeScene;
    if (!scene) return null;

    let currentY = 0;
    const tracksByNode = new Map();
    for (const track of scene.tracks) {
      if (!tracksByNode.has(track.targetNodeId)) tracksByNode.set(track.targetNodeId, []);
      tracksByNode.get(track.targetNodeId).push(track);
    }

    for (const [nodeId, tracks] of tracksByNode.entries()) {
      currentY += this.rowHeight; // skip node row
      if (this.expandedNodes.has(nodeId)) {
        for (const track of tracks) {
          if (y >= currentY && y <= currentY + this.rowHeight) {
            // Check each keyframe diamond in this track
            for (const kf of track.keyframes) {
              const kx = kf.frame * this.pxPerFrame;
              if (Math.abs(x - kx) <= 8) {
                return { track, keyframe: kf };
              }
            }
          }
          currentY += this.rowHeight;
        }
      }
    }

    return null;
  }

  _getTrackAtY(y) {
    const scene = this.activeScene;
    if (!scene) return null;

    let currentY = 0;
    const tracksByNode = new Map();
    for (const track of scene.tracks) {
      if (!tracksByNode.has(track.targetNodeId)) tracksByNode.set(track.targetNodeId, []);
      tracksByNode.get(track.targetNodeId).push(track);
    }

    for (const [nodeId, tracks] of tracksByNode.entries()) {
      currentY += this.rowHeight;
      if (this.expandedNodes.has(nodeId)) {
        for (const track of tracks) {
          if (y >= currentY && y <= currentY + this.rowHeight) {
            return track;
          }
          currentY += this.rowHeight;
        }
      }
    }
    return null;
  }

  _getNodePropertyValue(node, path) {
    if (!node) return 0;
    if (path.startsWith('transform.')) {
      const prop = path.replace('transform.', '');
      return node.transform[prop] ?? 0;
    }
    if (path === 'x' || path === 'y') return node[path] ?? 0;
    if (path === 'opacity') return node.opacity ?? 1.0;
    if (path === 'visible') return node.visible !== false;
    if (path.startsWith('properties.')) {
      const prop = path.replace('properties.', '');
      return node.properties[prop] ?? 0;
    }
    return 0;
  }

  // --- Popups & Context Menus ---

  _showAddTrackMenu(event) {
    const scene = this.activeScene;
    const selectedComp = this.selection.getSelectedComponents()[0];
    if (!scene || !selectedComp) {
      alert('Please select a Node in the Hierarchy or Canvas first to add an animation track.');
      return;
    }
    this._showTrackPropertyMenu(event, selectedComp.id);
  }

  _showTrackPropertyMenu(event, nodeId) {
    const scene = this.activeScene;
    const node = scene?.getNode(nodeId);
    if (!node) return;

    const availableProps = [
      { path: 'transform.x', label: 'Position X' },
      { path: 'transform.y', label: 'Position Y' },
      { path: 'transform.scaleX', label: 'Scale X' },
      { path: 'transform.scaleY', label: 'Scale Y' },
      { path: 'transform.rotation', label: 'Rotation' },
      { path: 'transform.opacity', label: 'Opacity' },
      { path: 'visible', label: 'Visibility' }
    ];

    const menu = this.container.querySelector('#tl_context_menu');
    if (!menu) return;

    menu.innerHTML = `
      <div class="tl-menu-title">Add Track for <strong>${node.name}</strong></div>
      <div class="tl-menu-items">
        ${availableProps.map(p => {
          const exists = scene.getTrackForProperty(nodeId, p.path);
          return `
            <button class="tl-menu-item ${exists ? 'disabled' : ''}" data-path="${p.path}" ${exists ? 'disabled' : ''}>
              ${exists ? '✓' : '+'} ${p.label}
            </button>
          `;
        }).join('')}
      </div>
    `;

    menu.style.display = 'block';
    menu.style.left = `${Math.min(window.innerWidth - 220, event.clientX || 200)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 250, event.clientY || 300)}px`;

    const closeHandler = () => {
      menu.style.display = 'none';
      window.removeEventListener('click', closeHandler);
    };

    setTimeout(() => {
      window.addEventListener('click', closeHandler);
    }, 10);

    menu.querySelectorAll('.tl-menu-item:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addTrack(nodeId, btn.dataset.path);
        menu.style.display = 'none';
      });
    });
  }

  _showKeyframeContextMenu(clientX, clientY, track, keyframe) {
    const menu = this.container.querySelector('#tl_context_menu');
    if (!menu) return;

    menu.innerHTML = `
      <div class="tl-menu-title">Keyframe at Frame ${keyframe.frame}</div>
      <div class="tl-menu-section">Interpolation Curve</div>
      <div class="tl-menu-items">
        <button class="tl-menu-item ${keyframe.interpolation === InterpolationTypes.LINEAR ? 'active' : ''}" data-interp="linear">Linear</button>
        <button class="tl-menu-item ${keyframe.interpolation === InterpolationTypes.STEP ? 'active' : ''}" data-interp="step">Step</button>
        <button class="tl-menu-item ${keyframe.interpolation === InterpolationTypes.EASE_IN ? 'active' : ''}" data-interp="easeIn">Ease In</button>
        <button class="tl-menu-item ${keyframe.interpolation === InterpolationTypes.EASE_OUT ? 'active' : ''}" data-interp="easeOut">Ease Out</button>
        <button class="tl-menu-item ${keyframe.interpolation === InterpolationTypes.EASE_IN_OUT ? 'active' : ''}" data-interp="easeInOut">Ease In Out</button>
        <button class="tl-menu-item ${keyframe.interpolation === InterpolationTypes.BEZIER ? 'active' : ''}" data-interp="bezier">Bezier</button>
      </div>
      <div class="tl-menu-divider"></div>
      <button class="tl-menu-item tl-menu-danger" data-action="delete">Delete Keyframe</button>
    `;

    menu.style.display = 'block';
    menu.style.left = `${Math.min(window.innerWidth - 200, clientX)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 260, clientY)}px`;

    const closeHandler = () => {
      menu.style.display = 'none';
      window.removeEventListener('click', closeHandler);
    };

    setTimeout(() => {
      window.addEventListener('click', closeHandler);
    }, 10);

    menu.querySelectorAll('[data-interp]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const oldInterp = keyframe.interpolation;
        const oldCurve = keyframe.curve ? JSON.parse(JSON.stringify(keyframe.curve)) : null;
        const newInterp = btn.dataset.interp;

        keyframe.interpolation = newInterp;
        if (newInterp === InterpolationTypes.BEZIER && !keyframe.curve) {
          keyframe.curve = { mode: 'bezier', cp1: [0.25, 0.1], cp2: [0.25, 1.0], tangentIn: { x: -10, y: 0 }, tangentOut: { x: 10, y: 0 } };
        }

        this._pushHistory({
          description: `Change interpolation to ${newInterp} at frame ${keyframe.frame}`,
          undo: () => {
            keyframe.interpolation = oldInterp;
            keyframe.curve = oldCurve;
            this.render();
            if (this.renderer) this.renderer.render();
          },
          execute: () => {
            keyframe.interpolation = newInterp;
            if (newInterp === InterpolationTypes.BEZIER && !keyframe.curve) {
              keyframe.curve = { mode: 'bezier', cp1: [0.25, 0.1], cp2: [0.25, 1.0], tangentIn: { x: -10, y: 0 }, tangentOut: { x: 10, y: 0 } };
            }
            this.render();
            if (this.renderer) this.renderer.render();
          }
        });

        this.render();
        if (this.renderer) this.renderer.render();
        menu.style.display = 'none';
      });
    });

    menu.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteKeyframe(track, keyframe.frame);
      menu.style.display = 'none';
    });
  }
}
