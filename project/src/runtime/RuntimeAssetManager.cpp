#include "runtime/RuntimeAssetManager.hpp"
#include "screens/SceneAssets.hpp"
#include <cstring>

namespace Citro2D {

RuntimeAssetManager::RuntimeAssetManager()
    : m_metrics{0, 0, 0, 0, 0, 0, 0}
    , m_lastError(AssetError::None)
    , m_lastErrorDetail("")
    , m_initialized(false)
{
}

RuntimeAssetManager::~RuntimeAssetManager() {
    fini();
}

bool RuntimeAssetManager::init() {
    if (m_initialized) return true;
    m_cache.clear();
    resetMetrics();
    m_initialized = true;
    return true;
}

void RuntimeAssetManager::fini() {
    releaseAll();
    m_initialized = false;
}

void RuntimeAssetManager::resetMetrics() {
    m_metrics = {
        static_cast<uint32_t>(m_cache.size()),
        0, 0, 0, 0, 0, 0
    };
    m_lastError = AssetError::None;
    m_lastErrorDetail = "";
}

bool RuntimeAssetManager::preload(const char* assetId) {
    if (!assetId || assetId[0] == '\0') {
        m_lastError = AssetError::AssetNotFound;
        m_lastErrorDetail = "Asset ID is null or empty";
        return false;
    }

    std::string key(assetId);

    // 1. Deduplication: check if already loaded in cache
    auto it = m_cache.find(key);
    if (it != m_cache.end()) {
        it->second.refCount++;
        m_metrics.cacheHitCount++;
        return true;
    }

    m_metrics.cacheMissCount++;

    // 2. Lookup manifest
    const Citro2D::AssetEntry* entry = Citro2D::findSceneAsset(assetId);
    if (!entry) {
        m_lastError = AssetError::AssetNotFound;
        m_lastErrorDetail = "Asset not declared in SceneAssets: " + key;
        return false;
    }

    if (!entry->romfsPath || entry->romfsPath[0] == '\0') {
        m_lastError = AssetError::AssetFileMissing;
        m_lastErrorDetail = "Asset has no romfs destination path: " + key;
        return false;
    }

    // 3. Physical C2D load once
    C2D_SpriteSheet sheet = C2D_SpriteSheetLoad(entry->romfsPath);
    if (!sheet) {
        m_lastError = AssetError::AssetLoadFailed;
        m_lastErrorDetail = "C2D_SpriteSheetLoad failed for path: " + std::string(entry->romfsPath);
        return false;
    }

    C2D_Image img = C2D_SpriteSheetGetImage(sheet, 0);

    CachedAsset cached;
    cached.assetId = key;
    cached.romfsPath = entry->romfsPath;
    cached.spriteSheet = sheet;
    cached.image = img;
    cached.width = (img.subtex) ? img.subtex->width : 64;
    cached.height = (img.subtex) ? img.subtex->height : 64;
    cached.refCount = 1;
    cached.loaded = true;

    m_cache[key] = cached;

    m_metrics.physicalLoadCount++;
    m_metrics.loadedAssetCount = static_cast<uint32_t>(m_cache.size());

    return true;
}

const CachedAsset* RuntimeAssetManager::get(const char* assetId) const {
    if (!assetId) return nullptr;
    auto it = m_cache.find(assetId);
    if (it != m_cache.end() && it->second.loaded) {
        return &(it->second);
    }
    return nullptr;
}

void RuntimeAssetManager::retain(const char* assetId) {
    if (!assetId) return;
    auto it = m_cache.find(assetId);
    if (it != m_cache.end()) {
        it->second.refCount++;
    }
}

void RuntimeAssetManager::release(const char* assetId) {
    if (!assetId) return;
    auto it = m_cache.find(assetId);
    if (it != m_cache.end()) {
        if (it->second.refCount > 1) {
            it->second.refCount--;
        } else {
            if (it->second.spriteSheet) {
                C2D_SpriteSheetFree(it->second.spriteSheet);
            }
            m_cache.erase(it);
            m_metrics.loadedAssetCount = static_cast<uint32_t>(m_cache.size());
        }
    }
}

void RuntimeAssetManager::releaseAll() {
    for (auto& pair : m_cache) {
        if (pair.second.spriteSheet) {
            C2D_SpriteSheetFree(pair.second.spriteSheet);
            pair.second.spriteSheet = nullptr;
        }
    }
    m_cache.clear();
    m_metrics.loadedAssetCount = 0;
}

RuntimeAssetManager& getRuntimeAssetManager() {
    static RuntimeAssetManager s_instance;
    return s_instance;
}

} // namespace Citro2D
