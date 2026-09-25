#include "screens/SceneAssets.hpp"
#include <cstring>

namespace Citro2D {

const AssetEntry g_SceneAssets[] = {
    { "bg_arena_plains", "romfs/arenas/plains.t3x", "RGB565", 400, 240 },
    { "pokemon_sprite_25_front", "romfs/sprites/pokemon/25.t3x", "RGBA4444", 315, 315 },
};

const size_t g_SceneAssetCount = sizeof(g_SceneAssets) / sizeof(g_SceneAssets[0]);

const AssetEntry* findSceneAsset(const char* assetId) {
    if (!assetId) return nullptr;
    for (size_t i = 0; i < g_SceneAssetCount; ++i) {
        if (std::strcmp(g_SceneAssets[i].assetId, assetId) == 0) {
            return &g_SceneAssets[i];
        }
    }
    return nullptr;
}

} // namespace Citro2D
