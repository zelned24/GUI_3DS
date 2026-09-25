#pragma once

#include "3ds.h"
#include <cstddef>

#define C3D_DEFAULT_CMDBUF_SIZE 0x40000
#define C3D_FRAME_SYNCDRAW 1

typedef struct {
    void* tex;
    const struct {
        u16 width;
        u16 height;
        u16 left;
        u16 top;
        u16 right;
        u16 bottom;
    }* subtex;
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

typedef void* C2D_SpriteSheet;

#ifdef __cplusplus
extern "C" {
#endif

bool C3D_Init(size_t cmdBufSize);
void C3D_Fini(void);
bool C3D_FrameBegin(u8 flags);
void C3D_FrameEnd(u8 flags);

bool C2D_Init(size_t maxObjects);
void C2D_Fini(void);
void C2D_Prepare(void);
C3D_RenderTarget* C2D_CreateScreenTarget(gfxScreen_t screen, gfx3dSide_t side);
void C2D_SceneBegin(C3D_RenderTarget* target);
void C2D_TargetClear(C3D_RenderTarget* target, u32 clr);
void C2D_DrawRectSolid(float x, float y, float z, float w, float h, u32 clr);
void C2D_DrawImageAt(C2D_Image img, float x, float y, float z, const C2D_ImageTint* tint, float scaleX, float scaleY);
void C2D_DrawImageAtRotatedScaled(C2D_Image img, float x, float y, float z, float rotation, const C2D_ImageTint* tint, float scaleX, float scaleY);
void C2D_PlainImageTint(C2D_ImageTint* tint, u32 color, float blend);
void C2D_DrawText(const C2D_Text* text, u32 flags, float x, float y, float z, float scaleX, float scaleY);

C2D_SpriteSheet C2D_SpriteSheetLoad(const char* filename);
C2D_Image C2D_SpriteSheetGetImage(C2D_SpriteSheet sheet, size_t index);
void C2D_SpriteSheetFree(C2D_SpriteSheet sheet);

#ifdef __cplusplus
}
#endif
