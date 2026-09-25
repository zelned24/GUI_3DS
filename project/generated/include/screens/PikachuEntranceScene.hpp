#pragma once

#include "screens/screen.hpp"
#include "screens/SceneData.hpp"
#include "screens/SceneTimeline.hpp"
#include "screens/SceneAssets.hpp"

class PikachuEntranceScene : public Screen {
public:
    explicit PikachuEntranceScene(const Citro2D::SceneDefinition& def = Citro2D::g_SceneDefinition);
    ~PikachuEntranceScene() override = default;

    void init();
    void enter() override;
    void exit() override;
    void handleInput(const InputManager& input) override;
    void update(float dt) override;
    void drawTop(Renderer2D& renderer) override;
    void drawBottom(Renderer2D& renderer) override;

    Citro2D::SceneTimeline& getTimeline() { return m_timeline; }
    const Citro2D::SceneTimeline& getTimeline() const { return m_timeline; }

private:
    void renderScreen(Renderer2D& renderer, Citro2D::ScreenTarget targetScreen);
    void renderNode(Renderer2D& renderer, uint32_t nodeIndex);

    Citro2D::SceneDefinition m_sceneDef;
    Citro2D::SceneTimeline m_timeline;
};
