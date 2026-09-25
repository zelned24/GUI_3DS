#pragma once

#include <cstdint>
#include <cstddef>
#include "citro2d.h"

/**
 * Renderer2D - 2D rendering subsystem bridging Citro2D for dual-screen Nintendo 3DS.
 */
class Renderer2D {
public:
    Renderer2D();
    virtual ~Renderer2D();

    bool init();
    void fini();

    void beginTop();
    void beginBottom();
    void endFrame();

    void clear(uint32_t color);

    void drawImage(
        const char* assetId,
        float x, float y,
        float width, float height,
        float rotation = 0.0f,
        float opacity = 1.0f,
        bool flipX = false,
        bool flipY = false,
        uint32_t tintColor = 0xFFFFFFFF
    );

    void drawRect(
        float x, float y,
        float width, float height,
        uint32_t color,
        float opacity = 1.0f
    );

    void drawText(
        const char* text,
        float x, float y,
        uint32_t color = 0xFFFFFFFF,
        float opacity = 1.0f
    );

    uint32_t getDrawCallCount() const { return m_drawCalls; }
    void resetStats() { m_drawCalls = 0; }

private:
    uint32_t m_drawCalls;
    bool m_initialized;
};
