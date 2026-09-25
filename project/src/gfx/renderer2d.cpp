#include "gfx/renderer2d.hpp"

Renderer2D::Renderer2D()
    : m_drawCalls(0)
    , m_initialized(false)
{
}

Renderer2D::~Renderer2D() {
    fini();
}

bool Renderer2D::init() {
    m_initialized = true;
    m_drawCalls = 0;
    return true;
}

void Renderer2D::fini() {
    m_initialized = false;
}

void Renderer2D::beginTop() {
}

void Renderer2D::beginBottom() {
}

void Renderer2D::endFrame() {
}

void Renderer2D::clear(uint32_t color) {
    (void)color;
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
    (void)assetId;
    (void)x;
    (void)y;
    (void)width;
    (void)height;
    (void)rotation;
    (void)opacity;
    (void)flipX;
    (void)flipY;
    (void)tintColor;
    m_drawCalls++;
}

void Renderer2D::drawRect(
    float x, float y,
    float width, float height,
    uint32_t color,
    float opacity
) {
    (void)x;
    (void)y;
    (void)width;
    (void)height;
    (void)color;
    (void)opacity;
    m_drawCalls++;
}

void Renderer2D::drawText(
    const char* text,
    float x, float y,
    uint32_t color,
    float opacity
) {
    (void)text;
    (void)x;
    (void)y;
    (void)color;
    (void)opacity;
    m_drawCalls++;
}
