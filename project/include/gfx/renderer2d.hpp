#pragma once

#include <cstdint>
#include <cstddef>
#include <3ds.h>
#include <citro2d.h>

/**
 * Renderer2D - Real Citro2D graphics subsystem for dual-screen Nintendo 3DS.
 * Directly integrates Citro2D / Citro3D hardware rendering pipeline.
 */
class Renderer2D {
public:
    Renderer2D();
    ~Renderer2D();

    // Hardware lifecycle
    bool init(size_t maxObjects = 4096);
    void fini();

    // Frame synchronization
    void beginFrame();
    void endFrame();

    // Screen selection (Top: 400x240, Bottom: 320x240)
    void beginTop();
    void beginBottom();

    // Render operations
    void clear(uint32_t color);

    void drawImageDirect(
        C2D_Image img,
        float x, float y,
        float width, float height,
        float rotation = 0.0f,
        float opacity = 1.0f,
        bool flipX = false,
        bool flipY = false,
        uint32_t tintColor = 0xFFFFFFFF
    );

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

    // Screen target accessors
    C3D_RenderTarget* getTopTarget() const { return m_topTarget; }
    C3D_RenderTarget* getBottomTarget() const { return m_bottomTarget; }
    C3D_RenderTarget* getCurrentTarget() const { return m_currentTarget; }
    bool isInitialized() const { return m_initialized; }

private:
    C3D_RenderTarget* m_topTarget;
    C3D_RenderTarget* m_bottomTarget;
    C3D_RenderTarget* m_currentTarget;
    C2D_TextBuf m_textBuf;
    bool m_initialized;
    bool m_frameActive;
};
