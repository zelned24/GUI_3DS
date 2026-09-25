#pragma once

#include "3ds.h"
#include <cstddef>

typedef struct {
    void* tex;
    const void* subtex;
} C2D_Image;

typedef struct {
    u32 solid[4];
} C2D_ImageTint;

typedef void* C3D_RenderTarget;

typedef struct {
    void* buf;
    float width;
    float height;
} C2D_Text;

typedef void* C2D_TextBuf;

#ifdef __cplusplus
extern "C" {
#endif

bool C2D_Init(size_t maxObjects);
void C2D_Fini(void);
void C2D_SceneBegin(C3D_RenderTarget* target);
void C2D_DrawRectSolid(float x, float y, float z, float w, float h, u32 clr);
void C2D_DrawImageAt(C2D_Image img, float x, float y, float z, const C2D_ImageTint* tint, float scaleX, float scaleY);
void C2D_DrawText(const C2D_Text* text, u32 flags, float x, float y, float z, float scaleX, float scaleY);

#ifdef __cplusplus
}
#endif
