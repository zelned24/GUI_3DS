#pragma once

#include <cstdint>

/**
 * InputManager - Abstraction for 3DS D-Pad, Buttons, Circle Pad, and Touch Screen.
 */
class InputManager {
public:
    InputManager()
        : m_kDown(0)
        , m_kHeld(0)
        , m_kUp(0)
        , m_touchX(0)
        , m_touchY(0)
        , m_touchHeld(false)
    {}

    void update() {}

    bool isKeyDown(uint32_t key) const { return (m_kDown & key) != 0; }
    bool isKeyHeld(uint32_t key) const { return (m_kHeld & key) != 0; }
    bool isKeyUp(uint32_t key) const { return (m_kUp & key) != 0; }

    bool isTouchHeld() const { return m_touchHeld; }
    uint16_t getTouchX() const { return m_touchX; }
    uint16_t getTouchY() const { return m_touchY; }

    void setMockKeys(uint32_t down, uint32_t held, uint32_t up) {
        m_kDown = down;
        m_kHeld = held;
        m_kUp = up;
    }

private:
    uint32_t m_kDown;
    uint32_t m_kHeld;
    uint32_t m_kUp;
    uint16_t m_touchX;
    uint16_t m_touchY;
    bool m_touchHeld;
};
