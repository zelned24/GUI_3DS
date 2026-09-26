#pragma once

#include "screens/SceneData.hpp"
#include "screens/SceneTimeline.hpp"
#include "gfx/renderer2d.hpp"
#include "runtime/RuntimeAssetManager.hpp"
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace Citro2D {

enum class PlaybackState : uint8_t {
    Stopped = 0,
    Playing,
    Paused
};

class ScenePlayer {
public:
    ScenePlayer();
    explicit ScenePlayer(const SceneDefinition& def);
    ~ScenePlayer();

    void load(const SceneDefinition& def);
    void enter();
    void play();
    void pause();
    void stop();
    void seek(uint32_t frame);
    void setLoop(bool loop) { m_loop = loop; }
    bool isLooping() const { return m_loop; }
    PlaybackState getState() const { return m_state; }
    bool isPlaying() const { return m_state == PlaybackState::Playing; }
    uint32_t getCurrentFrame() const { return m_currentFrame; }
    uint32_t getDurationFrames() const { return m_sceneDef.durationFrames; }

    void update(float dt);
    void renderTop(Renderer2D& renderer);
    void renderBottom(Renderer2D& renderer);
    void exit();

    // Texture scaling normalization contract (Requirement 35)
    static void calculateTextureScale(
        float nodeWidth, float nodeHeight,
        float textureWidth, float textureHeight,
        float scaleX, float scaleY,
        float& outScaleX, float& outScaleY
    );

    // Diagnostics
    size_t getReferencedAssetCount() const { return m_referencedAssets.size(); }
    const std::vector<std::string>& getReferencedAssets() const { return m_referencedAssets; }

private:
    void collectReferencedAssets();
    void renderScreen(Renderer2D& renderer, ScreenTarget targetScreen);
    void renderNode(Renderer2D& renderer, uint32_t nodeIndex);

    SceneDefinition m_sceneDef;
    std::unique_ptr<SceneTimeline> m_timeline;
    PlaybackState m_state;
    uint32_t m_currentFrame;
    float m_frameTimer;
    bool m_loop;
    std::vector<std::string> m_referencedAssets;
};

} // namespace Citro2D
