#include "screens/ExampleScreen.hpp"
#include "gfx/renderer2d.hpp"
#include "core/input_manager.hpp"

ExampleScreen::ExampleScreen() {
    init();
}

void ExampleScreen::init() {
    buildUI();
}

void ExampleScreen::enter() {
    // Called when screen becomes active
}

void ExampleScreen::exit() {
    // Called when screen transitions away
}

void ExampleScreen::buildUI() {
    m_focus_manager.clear();

    // ----------------------------------------------------
    // 1. TOP SCREEN (400x240)
    // ----------------------------------------------------
    m_top_banner_box = std::make_unique<Panel>(40.0f, 28.0f, 320.0f, 184.0f, PanelStyle::ROGUE_BOX);
    m_top_banner_box->backgroundColor = 0xFF30221E;
    m_top_banner_box->borderColor = 0xFF3438C8;
    m_title_text = std::make_unique<Text>(80.0f, 64.0f, "ROGUE 3DS TEST", 0xFF05CBFF, true);
    m_start_button = std::make_unique<Button>(130.0f, 128.0f, 140.0f, 36.0f, "[ START ]", 0);
    m_focus_manager.addElement(m_start_button.get());

    // ----------------------------------------------------
    // 2. BOTTOM SCREEN (320x240)
    // ----------------------------------------------------
    m_bottom_menu_box = std::make_unique<Panel>(30.0f, 20.0f, 260.0f, 200.0f, PanelStyle::ROGUE_BOX);
    m_bottom_menu_box->backgroundColor = 0xFF2A1F24;
    m_bottom_menu_box->borderColor = 0xFF35289E;
    m_btn_play = std::make_unique<Button>(60.0f, 56.0f, 200.0f, 44.0f, "PLAY", 1);
    m_focus_manager.addElement(m_btn_play.get());
    m_btn_settings = std::make_unique<Button>(60.0f, 124.0f, 200.0f, 44.0f, "SETTINGS", 2);
    m_focus_manager.addElement(m_btn_settings.get());
}

void ExampleScreen::handleInput(const InputManager& input) {
    m_focus_manager.handleInput(input);
}

void ExampleScreen::update(float dt) {
    m_focus_manager.update(dt);
}

void ExampleScreen::drawTop(Renderer2D& renderer) {
    renderer.clear(0xFF1C1412);
    if (m_top_banner_box) m_top_banner_box->draw(renderer);
    if (m_title_text) m_title_text->draw(renderer);
    if (m_start_button) m_start_button->draw(renderer);
}

void ExampleScreen::drawBottom(Renderer2D& renderer) {
    renderer.clear(0xFF24181A);
    if (m_bottom_menu_box) m_bottom_menu_box->draw(renderer);
    if (m_btn_play) m_btn_play->draw(renderer);
    if (m_btn_settings) m_btn_settings->draw(renderer);
}
