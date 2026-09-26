#include "screens/SceneData.hpp"

namespace Citro2D {

// -------------------------------------------------------------
// 1. KEYFRAME ARRAYS (Deterministic Static Compact Data)
// -------------------------------------------------------------
static const SceneKeyframe s_keyframes_pikachu_sprite_Opacity_0[] = {
    { 0, 0.0f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
    { 15, 0.5f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
    { 30, 1.0f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
};

static const SceneKeyframe s_keyframes_pikachu_sprite_X_1[] = {
    { 0, 320.0f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
    { 15, 280.0f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
    { 30, 240.0f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
    { 60, 220.0f, InterpolationType::EaseInOut, 0.25f, 0.1f, 0.25f, 1.0f },
};

static const SceneKeyframe s_keyframes_title_banner_Y_2[] = {
    { 0, -40.0f, InterpolationType::EaseOut, 0.25f, 0.1f, 0.25f, 1.0f },
    { 25, 20.0f, InterpolationType::Linear, 0.25f, 0.1f, 0.25f, 1.0f },
};

// -------------------------------------------------------------
// 2. ANIMATION TRACKS
// -------------------------------------------------------------
static const SceneTrack s_tracks[] = {
    { 0x0020114C, "pikachu_sprite", PropertyId::Opacity, 3, s_keyframes_pikachu_sprite_Opacity_0 },
    { 0x0020114C, "pikachu_sprite", PropertyId::X, 4, s_keyframes_pikachu_sprite_X_1 },
    { 0x01CE1A28, "title_banner", PropertyId::Y, 2, s_keyframes_title_banner_Y_2 },
};

// -------------------------------------------------------------
// 3. SCENE NODES (Hierarchy & Base Transforms)
// -------------------------------------------------------------
static const SceneNodeData s_nodes[] = {
    {
        0x7DBFC222, "bg_arena", NodeType::Image, ScreenTarget::Top, -1,
        0.0f, 0.0f, 400.0f, 240.0f,
        1.0f, 1.0f, 0.0f, 1.0f,
        true, 1,
        "bg_arena_plains", false, false,
        0xFFFFFFFF, nullptr,
        false,
        { nullptr, 0, 0, 0, 1.0f, false }
    },
    {
        0x0020114C, "pikachu_sprite", NodeType::PokemonSprite, ScreenTarget::Top, -1,
        320.0f, 60.0f, 112.0f, 112.0f,
        1.0f, 1.0f, 0.0f, 0.0f,
        true, 2,
        "pokemon_sprite_25_front", false, false,
        0xFFFFFFFF, nullptr,
        false,
        { nullptr, 0, 0, 0, 1.0f, false }
    },
    {
        0x01CE1A28, "title_banner", NodeType::Text, ScreenTarget::Top, -1,
        20.0f, 20.0f, 360.0f, 32.0f,
        1.0f, 1.0f, 0.0f, 1.0f,
        true, 3,
        nullptr, false, false,
        0xFFFFFFFF, "WILD PIKACHU APPEARED!",
        false,
        { nullptr, 0, 0, 0, 1.0f, false }
    },
};

// -------------------------------------------------------------
// 4. TIMELINE MARKERS
// -------------------------------------------------------------
[[maybe_unused]] static const SceneMarker* s_markers = nullptr;

// -------------------------------------------------------------
// 5. AUDIO CUES
// -------------------------------------------------------------
[[maybe_unused]] static const SceneAudioCue* s_audioCues = nullptr;

// -------------------------------------------------------------
// 6. ANIMATION CLIPS
// -------------------------------------------------------------
[[maybe_unused]] static const SceneClip* s_clips = nullptr;

// -------------------------------------------------------------
// 7. SEQUENCER PLACEMENT
// -------------------------------------------------------------
[[maybe_unused]] static const SceneSequenceItem* s_sequence = nullptr;

// -------------------------------------------------------------
// 8. CANONICAL SCENE DEFINITION
// -------------------------------------------------------------
const SceneDefinition g_SceneDefinition = {
    "PikachuEntrance",
    90,
    60,
    0xFF1C1412,
    0xFF24181A,
    3,
    s_nodes,
    3,
    s_tracks,
    0,
    nullptr,
    0,
    nullptr,
    0,
    nullptr,
    0,
    nullptr
};

} // namespace Citro2D
