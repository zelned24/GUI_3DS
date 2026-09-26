#include "gfx/renderer2d.hpp"
#include "screens/SceneAssets.hpp"
#if !defined(__wasm__)
#include "runtime/RuntimeAssetManager.hpp"
#endif
#include <cmath>

#if defined(__arm__) || defined(__3DS__) || defined(_3DS)
// Citro2D C2D_DrawImageAtRotatedScaled bridge to real C2D_DrawImageAtRotated
static inline void C2D_DrawImageAtRotatedScaled(
    C2D_Image img,
    float x, float y,
    float depth,
    float angle,
    const C2D_ImageTint* tint,
    float scaleX, float scaleY
) {
    C2D_DrawImageAtRotated(img, x, y, depth, angle, tint, scaleX, scaleY);
}
#endif

Renderer2D::Renderer2D()
    : m_topTarget(nullptr)
    , m_bottomTarget(nullptr)
    , m_currentTarget(nullptr)
    , m_textBuf(nullptr)
    , m_initialized(false)
    , m_frameActive(false)
{
}

Renderer2D::~Renderer2D() {
    fini();
}

bool Renderer2D::init(size_t maxObjects) {
    if (m_initialized) return true;

    // 1. Initialize Citro3D and Citro2D
    if (!C3D_Init(C3D_DEFAULT_CMDBUF_SIZE)) {
        return false;
    }
    if (!C2D_Init(maxObjects)) {
        C3D_Fini();
        return false;
    }
    C2D_Prepare();

    // 2. Create hardware render targets for Top (400x240) and Bottom (320x240)
    m_topTarget = C2D_CreateScreenTarget(GFX_TOP, GFX_LEFT);
    m_bottomTarget = C2D_CreateScreenTarget(GFX_BOTTOM, GFX_LEFT);

    if (!m_topTarget || !m_bottomTarget) {
        fini();
        return false;
    }

    // 3. Pre-allocate static text buffer to eliminate dynamic allocation per frame (Requirement 36)
    m_textBuf = C2D_TextBufNew(1024);

#if !defined(__wasm__)
    // 4. Initialize global RuntimeAssetManager
    Citro2D::getRuntimeAssetManager().init();
#endif

    m_initialized = true;
    return true;
}

void Renderer2D::fini() {
    if (!m_initialized) return;

    if (m_frameActive) {
        endFrame();
    }

    if (m_textBuf) {
        C2D_TextBufDelete(m_textBuf);
        m_textBuf = nullptr;
    }

#if !defined(__wasm__)
    Citro2D::getRuntimeAssetManager().fini();
#endif

    C2D_Fini();
    C3D_Fini();

    m_topTarget = nullptr;
    m_bottomTarget = nullptr;
    m_currentTarget = nullptr;
    m_initialized = false;
}

void Renderer2D::beginFrame() {
    if (!m_initialized || m_frameActive) return;
    C3D_FrameBegin(C3D_FRAME_SYNCDRAW);
    m_frameActive = true;
}

void Renderer2D::endFrame() {
    if (!m_frameActive) return;
    C3D_FrameEnd(0);
    m_frameActive = false;
    m_currentTarget = nullptr;
}

void Renderer2D::beginTop() {
    if (!m_frameActive) beginFrame();
    m_currentTarget = m_topTarget;
    C2D_SceneBegin(m_topTarget);
}

void Renderer2D::beginBottom() {
    if (!m_frameActive) beginFrame();
    m_currentTarget = m_bottomTarget;
    C2D_SceneBegin(m_bottomTarget);
}

void Renderer2D::clear(uint32_t color) {
    if (m_currentTarget) {
        C2D_TargetClear(m_currentTarget, color);
    }
}

void Renderer2D::drawRect(
    float x, float y,
    float width, float height,
    uint32_t color,
    float opacity
) {
    if (!m_currentTarget || opacity <= 0.001f) return;

    // Modulate alpha
    uint32_t a = (color >> 24) & 0xFF;
    a = static_cast<uint32_t>(a * opacity);
    uint32_t finalColor = (color & 0x00FFFFFF) | (a << 24);

    C2D_DrawRectSolid(x, y, 0.5f, width, height, finalColor);
}

void Renderer2D::drawImageDirect(
    C2D_Image img,
    float x, float y,
    float width, float height,
    float rotation,
    float opacity,
    bool flipX,
    bool flipY,
    uint32_t tintColor
) {
    if (!m_currentTarget || opacity <= 0.001f || !img.tex) return;

    float scaleX = width;
    float scaleY = height;
    if (flipX) scaleX = -scaleX;
    if (flipY) scaleY = -scaleY;

    // Configure tint & alpha modulation using official Citro2D API
    C2D_ImageTint tint;
    uint32_t a = (tintColor >> 24) & 0xFF;
    a = static_cast<uint32_t>(a * opacity);
    uint32_t modulatedTint = (tintColor & 0x00FFFFFF) | (a << 24);
    C2D_PlainImageTint(&tint, modulatedTint, opacity);

    // Call real Citro2D rotated & scaled image renderer
    C2D_DrawImageAtRotatedScaled(
        img,
        x, y,
        0.5f,
        rotation,
        &tint,
        scaleX,
        scaleY
    );
}

void Renderer2D::drawImage(
    const char* assetId,
    float x, float y,
    float width, float height,
    float rotation,
    float opacity,
    bool flipX,
    bool flipY,
    uint32_t tintColor
) {
    if (!assetId || !m_currentTarget || opacity <= 0.001f) return;

#if !defined(__wasm__)
    Citro2D::RuntimeAssetManager& assetMgr = Citro2D::getRuntimeAssetManager();
    assetMgr.recordDrawCall();

    const Citro2D::CachedAsset* cached = assetMgr.get(assetId);
    if (cached && cached->loaded) {
        drawImageDirect(cached->image, x, y, width, height, rotation, opacity, flipX, flipY, tintColor);
        return;
    }

    // Load once into cache rather than alloc/free per draw frame (Requirement 11)
    if (assetMgr.preload(assetId)) {
        const Citro2D::CachedAsset* newlyCached = assetMgr.get(assetId);
        if (newlyCached && newlyCached->loaded) {
            drawImageDirect(newlyCached->image, x, y, width, height, rotation, opacity, flipX, flipY, tintColor);
        }
    }
#else
    const Citro2D::AssetEntry* entry = Citro2D::findSceneAsset(assetId);
    if (!entry || !entry->romfsPath) return;

    C2D_SpriteSheet sheet = C2D_SpriteSheetLoad(entry->romfsPath);
    if (sheet) {
        C2D_Image img = C2D_SpriteSheetGetImage(sheet, 0);
        drawImageDirect(img, x, y, width, height, rotation, opacity, flipX, flipY, tintColor);
        C2D_SpriteSheetFree(sheet);
    }
#endif
}

void Renderer2D::drawText(
    const char* text,
    float x, float y,
    uint32_t color,
    float opacity
) {
    if (!text || !m_currentTarget || opacity <= 0.001f) return;

    uint32_t a = (color >> 24) & 0xFF;
    a = static_cast<uint32_t>(a * opacity);
    uint32_t finalColor = (color & 0x00FFFFFF) | (a << 24);

    if (m_textBuf) {
        C2D_Text c2dText;
        C2D_TextParse(&c2dText, m_textBuf, text);
        C2D_TextOptimize(&c2dText);
        C2D_DrawText(&c2dText, C2D_WithColor, x, y, 0.5f, 1.0f, 1.0f, finalColor);
    }
}
