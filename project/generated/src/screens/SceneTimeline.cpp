#include "screens/SceneTimeline.hpp"
#include <cmath>
#include <cstring>

namespace Citro2D {

SceneTimeline::SceneTimeline(const SceneDefinition& scene)
    : m_scene(scene)
    , m_currentFrame(0)
    , m_isPlaying(false)
    , m_isLooping(true)
    , m_subframeAccumulator(0.0f)
{
}

float SceneTimeline::frameToSeconds(uint32_t frame) const {
    if (m_scene.fps == 0) return 0.0f;
    return static_cast<float>(frame) / static_cast<float>(m_scene.fps);
}

uint32_t SceneTimeline::secondsToFrame(float seconds) const {
    if (seconds <= 0.0f) return 0;
    return static_cast<uint32_t>(std::round(seconds * static_cast<float>(m_scene.fps)));
}

void SceneTimeline::seek(uint32_t frame) {
    if (frame > m_scene.durationFrames) {
        m_currentFrame = m_scene.durationFrames;
    } else {
        m_currentFrame = frame;
    }
}

void SceneTimeline::advanceFrame() {
    if (m_currentFrame + 1 > m_scene.durationFrames) {
        if (m_isLooping) {
            m_currentFrame = 0;
        } else {
            m_currentFrame = m_scene.durationFrames;
            m_isPlaying = false;
        }
    } else {
        m_currentFrame++;
    }
}

void SceneTimeline::update(float dt) {
    if (!m_isPlaying || m_scene.fps == 0) return;

    m_subframeAccumulator += dt;
    const float frameDuration = 1.0f / static_cast<float>(m_scene.fps);

    while (m_subframeAccumulator >= frameDuration) {
        m_subframeAccumulator -= frameDuration;
        advanceFrame();
    }
}

void SceneTimeline::play() {
    m_isPlaying = true;
}

void SceneTimeline::pause() {
    m_isPlaying = false;
}

void SceneTimeline::togglePlay() {
    m_isPlaying = !m_isPlaying;
}

// -------------------------------------------------------------
// PURE MATHEMATICAL INTERPOLATION (Identical to JS Interpolation.js)
// -------------------------------------------------------------
float SceneTimeline::evaluateProgress(float t, InterpolationType type) {
    const float clampedT = t < 0.0f ? 0.0f : (t > 1.0f ? 1.0f : t);

    switch (type) {
        case InterpolationType::Step:
            return clampedT < 1.0f ? 0.0f : 1.0f;

        case InterpolationType::Linear:
            return clampedT;

        case InterpolationType::EaseIn:
            // Quadratic Ease In: t^2
            return clampedT * clampedT;

        case InterpolationType::EaseOut:
            // Quadratic Ease Out: t * (2 - t)
            return clampedT * (2.0f - clampedT);

        case InterpolationType::EaseInOut:
            // Smooth Quadratic Ease In-Out
            return clampedT < 0.5f
                ? 2.0f * clampedT * clampedT
                : -1.0f + (4.0f - 2.0f * clampedT) * clampedT;

        default:
            return clampedT;
    }
}

float SceneTimeline::evaluateTrack(const SceneTrack& track, uint32_t frame, float defaultValue) {
    if (track.keyframeCount == 0 || track.keyframes == nullptr) {
        return defaultValue;
    }

    if (track.keyframeCount == 1) {
        return track.keyframes[0].value;
    }

    // Before or at first keyframe
    if (frame <= track.keyframes[0].frame) {
        return track.keyframes[0].value;
    }

    // After or at last keyframe
    const SceneKeyframe& last = track.keyframes[track.keyframeCount - 1];
    if (frame >= last.frame) {
        return last.value;
    }

    // Binary / Linear interval search
    for (uint16_t i = 0; i < track.keyframeCount - 1; ++i) {
        const SceneKeyframe& k0 = track.keyframes[i];
        const SceneKeyframe& k1 = track.keyframes[i + 1];

        if (frame >= k0.frame && frame <= k1.frame) {
            if (k0.frame == k1.frame) {
                return k0.value;
            }

            const float t = static_cast<float>(frame - k0.frame) / static_cast<float>(k1.frame - k0.frame);
            const float progress = evaluateProgress(t, k0.interpolation);

            if (track.propertyId == PropertyId::Visible) {
                return progress < 0.5f ? k0.value : k1.value;
            }

            return k0.value + (k1.value - k0.value) * progress;
        }
    }

    return last.value;
}

void SceneTimeline::evaluateNodeLocal(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const {
    if (nodeIndex >= m_scene.nodeCount || m_scene.nodes == nullptr) return;

    const SceneNodeData& node = m_scene.nodes[nodeIndex];

    outTransform.x = node.x;
    outTransform.y = node.y;
    outTransform.width = node.width;
    outTransform.height = node.height;
    outTransform.scaleX = node.scaleX;
    outTransform.scaleY = node.scaleY;
    outTransform.rotation = node.rotation;
    outTransform.opacity = node.opacity;
    outVisible = node.visible;

    // Evaluate all active tracks targeting this node
    for (uint16_t t = 0; t < m_scene.trackCount; ++t) {
        const SceneTrack& track = m_scene.tracks[t];
        if (track.nodeHash != node.idHash) continue;
        if (std::strcmp(track.nodeId, node.id) != 0) continue;

        switch (track.propertyId) {
            case PropertyId::X:
                outTransform.x = evaluateTrack(track, frame, outTransform.x);
                break;
            case PropertyId::Y:
                outTransform.y = evaluateTrack(track, frame, outTransform.y);
                break;
            case PropertyId::ScaleX:
                outTransform.scaleX = evaluateTrack(track, frame, outTransform.scaleX);
                break;
            case PropertyId::ScaleY:
                outTransform.scaleY = evaluateTrack(track, frame, outTransform.scaleY);
                break;
            case PropertyId::Rotation:
                outTransform.rotation = evaluateTrack(track, frame, outTransform.rotation);
                break;
            case PropertyId::Opacity:
                outTransform.opacity = evaluateTrack(track, frame, outTransform.opacity);
                if (outTransform.opacity < 0.0f) outTransform.opacity = 0.0f;
                if (outTransform.opacity > 1.0f) outTransform.opacity = 1.0f;
                break;
            case PropertyId::Visible:
                outVisible = evaluateTrack(track, frame, outVisible ? 1.0f : 0.0f) >= 0.5f;
                break;
            default:
                break;
        }
    }
}

void SceneTimeline::evaluateNodeWorld(uint32_t nodeIndex, uint32_t frame, EvaluatedTransform& outTransform, bool& outVisible) const {
    evaluateNodeLocal(nodeIndex, frame, outTransform, outVisible);
    if (nodeIndex >= m_scene.nodeCount || m_scene.nodes == nullptr) return;

    int32_t parentIdx = m_scene.nodes[nodeIndex].parentIndex;
    while (parentIdx >= 0 && parentIdx < static_cast<int32_t>(m_scene.nodeCount)) {
        EvaluatedTransform parentTransform;
        bool parentVisible = true;
        evaluateNodeLocal(static_cast<uint32_t>(parentIdx), frame, parentTransform, parentVisible);

        // Accumulate transforms
        outTransform.x += parentTransform.x;
        outTransform.y += parentTransform.y;
        outTransform.scaleX *= parentTransform.scaleX;
        outTransform.scaleY *= parentTransform.scaleY;
        outTransform.rotation += parentTransform.rotation;
        outTransform.opacity *= parentTransform.opacity;
        outVisible = outVisible && parentVisible;

        parentIdx = m_scene.nodes[parentIdx].parentIndex;
    }
}

bool SceneTimeline::hasMarkerAt(uint32_t frame, const char** outName, const char** outType) const {
    for (uint16_t i = 0; i < m_scene.markerCount; ++i) {
        if (m_scene.markers[i].frame == frame) {
            if (outName) *outName = m_scene.markers[i].name;
            if (outType) *outType = m_scene.markers[i].type;
            return true;
        }
    }
    return false;
}

bool SceneTimeline::hasAudioCueAt(uint32_t frame, const char** outAsset, float* outVol, uint8_t* outChan) const {
    for (uint16_t i = 0; i < m_scene.audioCueCount; ++i) {
        if (m_scene.audioCues[i].frame == frame) {
            if (outAsset) *outAsset = m_scene.audioCues[i].asset;
            if (outVol) *outVol = m_scene.audioCues[i].volume;
            if (outChan) *outChan = m_scene.audioCues[i].channel;
            return true;
        }
    }
    return false;
}

} // namespace Citro2D
