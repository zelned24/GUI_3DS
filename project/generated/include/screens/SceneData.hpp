#pragma once

#include <cstdint>
#include <cstddef>

namespace Citro2D {

enum class PropertyId : uint16_t {
    None = 0,
    X = 1,
    Y = 2,
    ScaleX = 3,
    ScaleY = 4,
    Rotation = 5,
    Opacity = 6,
    Visible = 7
};

enum class InterpolationType : uint8_t {
    Step = 0,
    Linear = 1,
    EaseIn = 2,
    EaseOut = 3,
    EaseInOut = 4,
    Bezier = 5
};

enum class ScreenTarget : uint8_t {
    Top = 0,     // 400x240
    Bottom = 1,  // 320x240
    Global = 2
};

enum class NodeType : uint8_t {
    Image = 0,
    PokemonSprite = 1,
    Text = 2,
    Panel = 3,
    Button = 4,
    Group = 5
};

struct SceneKeyframe {
    uint16_t frame;
    float value;
    InterpolationType interpolation;
    float cp1x;
    float cp1y;
    float cp2x;
    float cp2y;
};

struct SceneTrack {
    uint32_t nodeHash;
    const char* nodeId;
    PropertyId propertyId;
    uint16_t keyframeCount;
    const SceneKeyframe* keyframes;
};

struct SceneClipTrack {
    const char* targetNodeId;
    PropertyId propertyId;
    uint16_t keyframeCount;
    const SceneKeyframe* keyframes;
};

struct SceneClip {
    const char* id;
    const char* name;
    uint16_t durationFrames;
    uint16_t trackCount;
    const SceneClipTrack* tracks;
};

struct SceneSequenceItem {
    const char* id;
    const char* clipId;
    const char* targetNodeId;
    uint32_t nodeHash;
    int32_t startFrame;
    uint16_t durationFrames;
    uint16_t trimStart;
    uint16_t loopCount;
    bool muted;
};

struct SceneMarker {
    uint16_t frame;
    const char* name;
    const char* type;
};

struct SceneAudioCue {
    uint16_t frame;
    const char* asset;
    float volume;
    uint8_t channel;
};

struct SceneNodeData {
    uint32_t idHash;
    const char* id;
    NodeType type;
    ScreenTarget screen;
    int32_t parentIndex; // -1 if root node
    // Base transform
    float x;
    float y;
    float width;
    float height;
    float scaleX;
    float scaleY;
    float rotation;
    float opacity;
    bool visible;
    int16_t zIndex;
    // Node-specific properties
    const char* asset;
    bool flipX;
    bool flipY;
    uint32_t tintColor;
    const char* text;
};

struct SceneDefinition {
    const char* id;
    uint16_t durationFrames;
    uint16_t fps;
    uint32_t topBgColor;
    uint32_t bottomBgColor;
    uint16_t nodeCount;
    const SceneNodeData* nodes;
    uint16_t trackCount;
    const SceneTrack* tracks;
    uint16_t markerCount;
    const SceneMarker* markers;
    uint16_t audioCueCount;
    const SceneAudioCue* audioCues;
    // BETA-UI-6: Clips & Sequence
    uint16_t clipCount;
    const SceneClip* clips;
    uint16_t sequenceCount;
    const SceneSequenceItem* sequence;
};

extern const SceneDefinition g_SceneDefinition;

} // namespace Citro2D
