#include "screens/PikachuEntranceScene.hpp"
#include "gfx/renderer2d.hpp"
#include "core/input_manager.hpp"

PikachuEntranceScene::PikachuEntranceScene(const Citro2D::SceneDefinition& def)
    : m_sceneDef(def)
    , m_timeline(def)
{
    init();
}

void PikachuEntranceScene::init() {
    m_timeline.seek(0);
}

void PikachuEntranceScene::enter() {
    m_timeline.play();
}

void PikachuEntranceScene::exit() {
    m_timeline.pause();
}

void PikachuEntranceScene::handleInput(const InputManager& input) {
    (void)input;
}

void PikachuEntranceScene::update(float dt) {
    m_timeline.update(dt);
}

void PikachuEntranceScene::drawTop(Renderer2D& renderer) {
    renderer.clear(m_sceneDef.topBgColor);
    renderScreen(renderer, Citro2D::ScreenTarget::Top);
}

void PikachuEntranceScene::drawBottom(Renderer2D& renderer) {
    renderer.clear(m_sceneDef.bottomBgColor);
    renderScreen(renderer, Citro2D::ScreenTarget::Bottom);
}

void PikachuEntranceScene::renderScreen(Renderer2D& renderer, Citro2D::ScreenTarget targetScreen) {
    for (uint16_t i = 0; i < m_sceneDef.nodeCount; ++i) {
        const auto& node = m_sceneDef.nodes[i];
        if (node.screen == targetScreen || node.screen == Citro2D::ScreenTarget::Global) {
            renderNode(renderer, i);
        }
    }
}

void PikachuEntranceScene::renderNode(Renderer2D& renderer, uint32_t nodeIndex) {
    if (nodeIndex >= m_sceneDef.nodeCount) return;
    const auto& node = m_sceneDef.nodes[nodeIndex];

    Citro2D::EvaluatedTransform worldTransform;
    bool isVisible = false;
    m_timeline.evaluateNodeWorld(nodeIndex, m_timeline.getCurrentFrame(), worldTransform, isVisible);

    if (!isVisible || worldTransform.opacity <= 0.001f) {
        return;
    }

    switch (node.type) {
        case Citro2D::NodeType::Image:
        case Citro2D::NodeType::PokemonSprite: {
            if (node.asset && node.asset[0] != '\0') {
                renderer.drawImage(
                    node.asset,
                    worldTransform.x,
                    worldTransform.y,
                    worldTransform.width * worldTransform.scaleX,
                    worldTransform.height * worldTransform.scaleY,
                    worldTransform.rotation,
                    worldTransform.opacity,
                    node.flipX,
                    node.flipY,
                    node.tintColor
                );
            }
            break;
        }
        case Citro2D::NodeType::Panel: {
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
        case Citro2D::NodeType::Text: {
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
