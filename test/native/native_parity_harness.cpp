#include "screens/SceneData.hpp"
#include "screens/SceneTimeline.hpp"

extern "C" {

struct EvaluatedResult {
    float x;
    float y;
    float scaleX;
    float scaleY;
    float rotation;
    float opacity;
    int32_t visible;
};

static EvaluatedResult s_result;
static Citro2D::SceneTimeline s_timeline(Citro2D::g_SceneDefinition);

EvaluatedResult* harness_evaluate_node(uint32_t nodeIndex, uint32_t frame) {
    Citro2D::EvaluatedTransform transform;
    bool visible = true;
    s_timeline.evaluateNodeLocal(nodeIndex, frame, transform, visible);
    s_result.x = transform.x;
    s_result.y = transform.y;
    s_result.scaleX = transform.scaleX;
    s_result.scaleY = transform.scaleY;
    s_result.rotation = transform.rotation;
    s_result.opacity = transform.opacity;
    s_result.visible = visible ? 1 : 0;
    return &s_result;
}

float harness_evaluate_track(uint32_t trackIndex, uint32_t frame, float defaultVal) {
    if (trackIndex >= Citro2D::g_SceneDefinition.trackCount) return defaultVal;
    return Citro2D::SceneTimeline::evaluateTrack(Citro2D::g_SceneDefinition.tracks[trackIndex], frame, defaultVal);
}

float harness_evaluate_progress(float t, uint32_t interpType) {
    return Citro2D::SceneTimeline::evaluateProgress(t, static_cast<Citro2D::InterpolationType>(interpType));
}

uint32_t harness_get_duration() {
    return Citro2D::g_SceneDefinition.durationFrames;
}

uint32_t harness_get_track_count() {
    return Citro2D::g_SceneDefinition.trackCount;
}

uint32_t harness_get_node_count() {
    return Citro2D::g_SceneDefinition.nodeCount;
}

}
