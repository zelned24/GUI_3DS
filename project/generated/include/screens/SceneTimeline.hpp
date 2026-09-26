#pragma once

#include "screens/SceneData.hpp"
#include <cstdint>

namespace Citro2D {

struct EvaluatedTransform {
    float x;
    float y;
    float width;
    float height;
    float scaleX;
    float scaleY;
    float rotation;
    float opacity;
};

class SceneTimeline {
public:
    explicit SceneTimeline(const SceneDefinition& scene = g_SceneDefinition);

    // Temporal Authority: Frame number is the strict single source of truth
    uint32_t getCurrentFrame() const { return m_currentFrame; }
    uint32_t getDuration() const { return m_scene.durationFrames; }
    uint32_t getFps() const { return m_scene.fps; }
    float frameToSeconds(uint32_t frame) const;
    uint32_t secondsToFrame(float seconds) const;

    // Playback control
    void seek(uint32_t frame);
    void advanceFrame();
    void update(float dt = 1.0f / 60.0f);
    void play();
    void pause();
    void togglePlay();
    bool isPlaying() const { return m_isPlaying; }
    void setLoop(bool loop) { m_isLooping = loop; }
    bool isLooping() const { return m_isLooping; }

    // Pure mathematical evaluation matching TimelineEvaluator.js
    static float evaluateBezier(float t, float x1, float y1, float x2, float y2);
    static float evaluateProgress(float t, InterpolationType type, float cp1x = 0.25f, float cp1y = 0.1f, float cp2x = 0.25f, float cp2y = 1.0f);
    static float evaluateTrack(const SceneTrack& track, uint32_t frame, float defaultValue);
    static float evaluateClipTrack(const SceneClipTrack& track, uint32_t frame, float defaultValue);

    // Node evaluation (local overrides at frame)
    void evaluateNodeLocal(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const;

    // Node evaluation (world transform accumulating parent hierarchy)
    void evaluateNodeWorld(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const;

    // Timeline event queries
    bool hasMarkerAt(uint32_t frame, const char** outName = nullptr, const char** outType = nullptr) const;
    bool hasAudioCueAt(uint32_t frame, const char** outAsset = nullptr, float* outVol = nullptr, uint8_t* outChan = nullptr) const;

private:
    const SceneDefinition& m_scene;
    uint32_t m_currentFrame;
    bool m_isPlaying;
    bool m_isLooping;
    float m_subframeAccumulator;
};

} // namespace Citro2D
