#pragma once

#include <cstdint>

typedef uint8_t  u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef uint64_t u64;

typedef int8_t   s8;
typedef int16_t  s16;
typedef int32_t  s32;
typedef int64_t  s64;

#define BIT(n) (1U << (n))

enum {
    KEY_A       = BIT(0),
    KEY_B       = BIT(1),
    KEY_SELECT  = BIT(2),
    KEY_START   = BIT(3),
    KEY_DRIGHT  = BIT(4),
    KEY_DLEFT   = BIT(5),
    KEY_DUP     = BIT(6),
    KEY_DDOWN   = BIT(7),
    KEY_R       = BIT(8),
    KEY_L       = BIT(9),
    KEY_X       = BIT(10),
    KEY_Y       = BIT(11),
    KEY_TOUCH   = BIT(20)
};

typedef enum {
    GFX_TOP = 0,
    GFX_BOTTOM = 1
} gfxScreen_t;

typedef enum {
    GFX_LEFT = 0,
    GFX_RIGHT = 1
} gfx3dSide_t;

typedef struct {
    u16 px;
    u16 py;
} touchPosition;

#ifdef __cplusplus
extern "C" {
#endif

void hidScanInput(void);
u32 hidKeysDown(void);
u32 hidKeysHeld(void);
u32 hidKeysUp(void);
void hidTouchRead(touchPosition* pos);

#ifdef __cplusplus
}
#endif
