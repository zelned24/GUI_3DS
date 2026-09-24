#pragma once

#include "screens/screen.hpp"
#include "ui/panel.hpp"
#include "ui/button.hpp"
#include "ui/text.hpp"
#include "ui/focus_manager.hpp"
#include <memory>
#include <vector>

class ExampleScreen : public Screen {
public:
    ExampleScreen();
    ~ExampleScreen() override = default;

    void init();
    void enter() override;
    void exit() override;
    void handleInput(const InputManager& input) override;
    void update(float dt) override;
    void drawTop(Renderer2D& renderer) override;
    void drawBottom(Renderer2D& renderer) override;

private:
    void buildUI();

    // Top screen elements (400x240)
    std::unique_ptr<Panel> m_top_banner_box;
    std::unique_ptr<Text> m_title_text;
    std::unique_ptr<Button> m_start_button;

    // Bottom screen elements (320x240)
    std::unique_ptr<Panel> m_bottom_menu_box;
    std::unique_ptr<Button> m_btn_play;
    std::unique_ptr<Button> m_btn_settings;

    FocusManager m_focus_manager;
};
