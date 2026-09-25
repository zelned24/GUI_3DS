#include "screens/SceneAssets.hpp"
#include <cstring>

namespace Citro2D {

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
