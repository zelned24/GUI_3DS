#pragma once

#include <cstdint>
#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

#if defined(__arm__) || defined(__3DS__) || defined(_3DS)
#include <citro2d.h>
#else
#include "citro2d.h"
#endif

namespace Citro2D {

enum class AssetError : uint8_t {
    None = 0,
    AssetNotFound,
    AssetManifestInvalid,
    AssetFileMissing,
    AssetLoadFailed,
    UnsupportedFormat
};

struct CachedAsset {
    std::string assetId;
    std::string romfsPath;
    C2D_SpriteSheet spriteSheet;
    C2D_Image image;
    uint32_t width;
    uint32_t height;
    uint32_t refCount;
    bool loaded;
};

struct RuntimeMetrics {
    uint32_t loadedAssetCount;
    uint32_t cacheHitCount;
    uint32_t cacheMissCount;
    uint32_t physicalLoadCount;
    uint32_t drawCallCount;
    uint32_t activeNodeCount;
    uint32_t activeTrackCount;
};

class RuntimeAssetManager {
public:
    RuntimeAssetManager();
    ~RuntimeAssetManager();

    bool init();
    void fini();

    // Preload an asset by ID (manifest lookup -> load once -> cache C2D resource)
    bool preload(const char* assetId);

    // Lookup cached resource
    const CachedAsset* get(const char* assetId) const;

    // Retain reference
    void retain(const char* assetId);

    // Release an asset reference
    void release(const char* assetId);

    // Release all cached assets (safe for scene exit or reset)
    void releaseAll();

    // Diagnostics & Metrics
    AssetError getLastError() const { return m_lastError; }
    const char* getLastErrorDetail() const { return m_lastErrorDetail.c_str(); }
    const RuntimeMetrics& getMetrics() const { return m_metrics; }
    void resetMetrics();

    // Recording metrics for render pipeline
    void recordDrawCall() { m_metrics.drawCallCount++; }
    void recordActiveCounts(uint32_t nodes, uint32_t tracks) {
        m_metrics.activeNodeCount = nodes;
        m_metrics.activeTrackCount = tracks;
    }

    size_t getCachedCount() const { return m_cache.size(); }
    size_t getPhysicalLoadCount() const { return m_metrics.physicalLoadCount; }

private:
    std::unordered_map<std::string, CachedAsset> m_cache;
    RuntimeMetrics m_metrics;
    AssetError m_lastError;
    std::string m_lastErrorDetail;
    bool m_initialized;
};

// Global shared runtime asset manager instance
RuntimeAssetManager& getRuntimeAssetManager();

} // namespace Citro2D
