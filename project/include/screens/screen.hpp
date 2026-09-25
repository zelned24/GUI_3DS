#pragma once

#include <cstdint>

class Renderer2D;
class InputManager;

/**
 * Screen - Abstract base class for 3DS Dual Screen views.
 */
class Screen {
public:
    virtual ~Screen() = default;

    virtual void enter() {}
    virtual void exit() {}
    virtual void handleInput(const InputManager& input) { (void)input; }
    virtual void update(float dt) { (void)dt; }
    virtual void drawTop(Renderer2D& renderer) { (void)renderer; }
    virtual void drawBottom(Renderer2D& renderer) { (void)renderer; }
};
