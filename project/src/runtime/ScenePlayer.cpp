#include "runtime/ScenePlayer.hpp"
#include <algorithm>

namespace Citro2D {

ScenePlayer::ScenePlayer()
    : m_sceneDef{}
    , m_timeline{}
    , m_state(PlaybackState::Stopped)
    , m_currentFrame(0)
    , m_frameTimer(0.0f)
    , m_loop(false)
{
}

ScenePlayer::ScenePlayer(const SceneDefinition& def)
    : m_sceneDef(def)
    , m_timeline(def)
    , m_state(PlaybackState::Stopped)
    , m_currentFrame(0)
    , m_frameTimer(0.0f)
    , m_loop(false)
{
    collectReferencedAssets();
}

ScenePlayer::~ScenePlayer() {
    exit();
}

void ScenePlayer::load(const SceneDefinition& def) {
    m_sceneDef = def;
    m_timeline = SceneTimeline(def);
    m_state = PlaybackState::Stopped;
    m_currentFrame = 0;
    m_frameTimer = 0.0f;
    collectReferencedAssets();
}

void ScenePlayer::collectReferencedAssets() {
    m_referencedAssets.clear();
    for (uint16_t i = 0; i < m_sceneDef.nodeCount; ++i) {
        const auto& node = m_sceneDef.nodes[i];
        if (node.asset && node.asset[0] != '\0') {
            std::string assetId(node.asset);
            if (std::find(m_referencedAssets.begin(), m_referencedAssets.end(), assetId) == m_referencedAssets.end()) {
                m_referencedAssets.push_back(assetId);
            }
        }
    }
}

void ScenePlayer::enter() {
    // Preload all referenced assets once during scene enter
    RuntimeAssetManager& assetMgr = getRuntimeAssetManager();
    for (const auto& assetId : m_referencedAssets) {
        assetMgr.preload(assetId.c_str());
    }

    seek(0);
    play();
}

void ScenePlayer::play() {
    m_state = PlaybackState::Playing;
}

void ScenePlayer::pause() {
    m_state = PlaybackState::Paused;
}

void ScenePlayer::stop() {
    m_state = PlaybackState::Stopped;
    seek(0);
    m_frameTimer = 0.0f;
}

void ScenePlayer::seek(uint32_t frame) {
    if (frame > m_sceneDef.durationFrames) {
        frame = m_sceneDef.durationFrames;
    }
    m_currentFrame = frame;
    m_timeline.seek(frame);
}

void ScenePlayer::update(float dt) {
    if (m_state != PlaybackState::Playing) return;

    float fps = (m_sceneDef.fps > 0) ? static_cast<float>(m_sceneDef.fps) : 60.0f;
    float frameDuration = 1.0f / fps;
    m_frameTimer += dt;

    while (m_frameTimer >= frameDuration) {
        m_frameTimer -= frameDuration;
        m_currentFrame++;

        if (m_currentFrame >= m_sceneDef.durationFrames) {
            if (m_loop) {
                m_currentFrame = 0;
            } else {
                m_currentFrame = m_sceneDef.durationFrames;
                m_state = PlaybackState::Stopped;
                break;
            }
        }
    }

    m_timeline.seek(m_currentFrame);
}

void ScenePlayer::calculateTextureScale(
    float nodeWidth, float nodeHeight,
    float textureWidth, float textureHeight,
    float scaleX, float scaleY,
    float& outScaleX, float& outScaleY
) {
    float baseScaleX = (textureWidth > 0.0f) ? (nodeWidth / textureWidth) : 1.0f;
    float baseScaleY = (textureHeight > 0.0f) ? (nodeHeight / textureHeight) : 1.0f;

    outScaleX = baseScaleX * scaleX;
    outScaleY = baseScaleY * scaleY;
}

void ScenePlayer::renderTop(Renderer2D& renderer) {
    renderer.clear(m_sceneDef.topBgColor);
    renderScreen(renderer, ScreenTarget::Top);
}

void ScenePlayer::renderBottom(Renderer2D& renderer) {
    renderer.clear(m_sceneDef.bottomBgColor);
    renderScreen(renderer, ScreenTarget::Bottom);
}

void ScenePlayer::renderScreen(Renderer2D& renderer, ScreenTarget targetScreen) {
    for (uint16_t i = 0; i < m_sceneDef.nodeCount; ++i) {
        const auto& node = m_sceneDef.nodes[i];
        if (node.screen == targetScreen || node.screen == ScreenTarget::Global) {
            renderNode(renderer, i);
        }
    }
}

void ScenePlayer::renderNode(Renderer2D& renderer, uint32_t nodeIndex) {
    if (nodeIndex >= m_sceneDef.nodeCount) return;
    const auto& node = m_sceneDef.nodes[nodeIndex];

    EvaluatedTransform worldTransform;
    bool isVisible = false;
    m_timeline.evaluateNodeWorld(nodeIndex, m_currentFrame, worldTransform, isVisible);

    if (!isVisible || worldTransform.opacity <= 0.001f) {
        return;
    }

    switch (node.type) {
        case NodeType::Image:
        case NodeType::PokemonSprite: {
            if (node.asset && node.asset[0] != '\0') {
                RuntimeAssetManager& assetMgr = getRuntimeAssetManager();
                const CachedAsset* cached = assetMgr.get(node.asset);

                float texW = (cached && cached->width > 0) ? static_cast<float>(cached->width) : worldTransform.width;
                float texH = (cached && cached->height > 0) ? static_cast<float>(cached->height) : worldTransform.height;

                float finalScaleX = 1.0f;
                float finalScaleY = 1.0f;
                calculateTextureScale(
                    worldTransform.width, worldTransform.height,
                    texW, texH,
                    worldTransform.scaleX, worldTransform.scaleY,
                    finalScaleX, finalScaleY
                );

                if (cached && cached->loaded) {
                    renderer.drawImageDirect(
                        cached->image,
                        worldTransform.x,
                        worldTransform.y,
                        finalScaleX,
                        finalScaleY,
                        worldTransform.rotation,
                        worldTransform.opacity,
                        node.flipX,
                        node.flipY,
                        node.tintColor
                    );
                } else {
                    renderer.drawImage(
                        node.asset,
                        worldTransform.x,
                        worldTransform.y,
                        finalScaleX,
                        finalScaleY,
                        worldTransform.rotation,
                        worldTransform.opacity,
                        node.flipX,
                        node.flipY,
                        node.tintColor
                    );
                }
            }
            break;
        }
        case NodeType::Panel: {
            renderer.drawRect(
                worldTransform.x,
                worldTransform.y,
                worldTransform.width * worldTransform.scaleX,
                worldTransform.height * worldTransform.scaleY,
                node.tintColor,
                worldTransform.opacity
            );
            break;
        }
        case NodeType::Text: {
            if (node.text) {
                renderer.drawText(
                    node.text,
                    worldTransform.x,
                    worldTransform.y,
                    node.tintColor,
                    worldTransform.opacity
                );
            }
            break;
        }
        default:
            break;
    }
}

void ScenePlayer::exit() {
    pause();
    RuntimeAssetManager& assetMgr = getRuntimeAssetManager();
    for (const auto& assetId : m_referencedAssets) {
        assetMgr.release(assetId.c_str());
    }
}

} // namespace Citro2D
