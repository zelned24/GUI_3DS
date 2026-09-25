#pragma once

#include <cstdint>
#include <cstddef>

namespace Citro2D {

struct AssetEntry {
    const char* assetId;
    const char* romfsPath;
    const char* targetFormat;
    uint16_t width;
    uint16_t height;
};

extern const AssetEntry g_SceneAssets[];
extern const size_t g_SceneAssetCount;

const AssetEntry* findSceneAsset(const char* assetId);

} // namespace Citro2D
