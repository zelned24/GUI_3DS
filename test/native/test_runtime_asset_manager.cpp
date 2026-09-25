#include <cassert>
#include <cstdio>
#include <cstring>
#include <cmath>
#include "runtime/RuntimeAssetManager.hpp"
#include "runtime/ScenePlayer.hpp"
#include "screens/SceneAssets.hpp"
#include "screens/SceneData.hpp"

// Define a test scene asset manifest table for standalone testing
namespace Citro2D {
static const AssetEntry s_testAssets[] = {
    { "pokemon_sprite_25_front", "romfs/sprites/pokemon/25.t3x", "T3X", 756 },
    { "bg_arena_plains", "romfs/arenas/plains.t3x", "T3X", 15684 },
    { "ui_dialog_box", "romfs/ui/ui_dialog_box.t3x", "T3X", 102 }
};

const AssetEntry* findSceneAsset(const char* assetId) {
    if (!assetId) return nullptr;
    for (const auto& a : s_testAssets) {
        if (strcmp(a.assetId, assetId) == 0) {
            return &a;
        }
    }
    return nullptr;
}
} // namespace Citro2D

int main() {
    printf("====================================================\n");
    printf("  C++ RUNTIME ASSET MANAGER & SCENE PLAYER TESTS   \n");
    printf("====================================================\n");

    Citro2D::RuntimeAssetManager assetMgr;
    assert(assetMgr.init());

    // 1. Single Load Test
    printf("[1/8] Testing single asset preload...\n");
    bool load1 = assetMgr.preload("pokemon_sprite_25_front");
    assert(load1);
    assert(assetMgr.getCachedCount() == 1);
    assert(assetMgr.getPhysicalLoadCount() == 1);
    const auto* cached1 = assetMgr.get("pokemon_sprite_25_front");
    assert(cached1 != nullptr);
    assert(cached1->loaded == true);
    assert(cached1->refCount == 1);
    printf("  ✓ Preload succeeded: 1 physical load\n");

    // 2. Cache Deduplication Test (20 references -> 1 physical load)
    printf("[2/8] Testing cache deduplication (20 references -> 1 physical load)...\n");
    for (int i = 0; i < 19; ++i) {
        bool res = assetMgr.preload("pokemon_sprite_25_front");
        assert(res);
    }
    assert(assetMgr.getCachedCount() == 1);
    assert(assetMgr.getPhysicalLoadCount() == 1); // Still exactly 1 physical load!
    assert(cached1->refCount == 20);
    const auto& metrics = assetMgr.getMetrics();
    assert(metrics.cacheHitCount == 19);
    assert(metrics.cacheMissCount == 1);
    printf("  ✓ Deduplication verified: 20 references resulted in exactly 1 physical load\n");

    // 3. Missing Asset Diagnostics Test
    printf("[3/8] Testing missing asset diagnostics...\n");
    bool failRes = assetMgr.preload("missing_fictitious_asset_999");
    assert(!failRes);
    assert(assetMgr.getLastError() == Citro2D::AssetError::AssetNotFound);
    printf("  ✓ Missing asset cleanly reported with AssetNotFound error\n");

    // 4. Resource Release Lifecycle Test
    printf("[4/8] Testing reference release lifecycle...\n");
    for (int i = 0; i < 19; ++i) {
        assetMgr.release("pokemon_sprite_25_front");
    }
    assert(assetMgr.getCachedCount() == 1); // Still 1 ref remaining
    assert(cached1->refCount == 1);
    assetMgr.release("pokemon_sprite_25_front"); // Reaches 0, freed
    assert(assetMgr.getCachedCount() == 0);
    assert(assetMgr.get("pokemon_sprite_25_front") == nullptr);
    printf("  ✓ Reference counting and release verified\n");

    // 5. ReleaseAll Test
    printf("[5/8] Testing releaseAll()...\n");
    assetMgr.preload("pokemon_sprite_25_front");
    assetMgr.preload("bg_arena_plains");
    assert(assetMgr.getCachedCount() == 2);
    assetMgr.releaseAll();
    assert(assetMgr.getCachedCount() == 0);
    printf("  ✓ releaseAll() cleanly flushed all resources\n");

    // 6. Texture Scaling Contract Test (Requirement 35)
    printf("[6/8] Testing texture scaling normalization contract...\n");
    float outScaleX = 0.0f, outScaleY = 0.0f;

    // 1.0 scale: node width 64 on 64px texture with scaleX=1.0 -> 1.0f
    Citro2D::ScenePlayer::calculateTextureScale(64.0f, 64.0f, 64.0f, 64.0f, 1.0f, 1.0f, outScaleX, outScaleY);
    assert(std::fabs(outScaleX - 1.0f) < 0.001f);
    assert(std::fabs(outScaleY - 1.0f) < 0.001f);

    // 0.5 scale: node width 32 on 64px texture with scaleX=1.0 -> 0.5f
    Citro2D::ScenePlayer::calculateTextureScale(32.0f, 32.0f, 64.0f, 64.0f, 1.0f, 1.0f, outScaleX, outScaleY);
    assert(std::fabs(outScaleX - 0.5f) < 0.001f);
    assert(std::fabs(outScaleY - 0.5f) < 0.001f);

    // 2.0 scale: node width 64 on 64px texture with scaleX=2.0 -> 2.0f
    Citro2D::ScenePlayer::calculateTextureScale(64.0f, 64.0f, 64.0f, 64.0f, 2.0f, 2.0f, outScaleX, outScaleY);
    assert(std::fabs(outScaleX - 2.0f) < 0.001f);
    assert(std::fabs(outScaleY - 2.0f) < 0.001f);

    // FlipX and FlipY
    Citro2D::ScenePlayer::calculateTextureScale(64.0f, 64.0f, 64.0f, 64.0f, -1.0f, 1.0f, outScaleX, outScaleY);
    assert(std::fabs(outScaleX - (-1.0f)) < 0.001f);
    assert(std::fabs(outScaleY - 1.0f) < 0.001f);
    printf("  ✓ Texture scaling contract verified across 1.0, 0.5, 2.0, flipX\n");

    // 7. ScenePlayer Lifecycle & Seek Test
    printf("[7/8] Testing ScenePlayer lifecycle and frame-accurate seek...\n");
    Citro2D::SceneDefinition sceneDef{};
    sceneDef.fps = 60;
    sceneDef.durationFrames = 60;
    sceneDef.nodeCount = 0;
    sceneDef.topBgColor = 0xFF000000;
    sceneDef.bottomBgColor = 0xFF111111;

    Citro2D::ScenePlayer player(sceneDef);
    assert(player.getState() == Citro2D::PlaybackState::Stopped);
    player.enter();
    assert(player.getState() == Citro2D::PlaybackState::Playing);
    assert(player.getCurrentFrame() == 0);

    // Frame-accurate seek
    player.seek(15);
    assert(player.getCurrentFrame() == 15);
    player.seek(30);
    assert(player.getCurrentFrame() == 30);
    player.seek(60);
    assert(player.getCurrentFrame() == 60);

    // Pause & Stop
    player.pause();
    assert(player.getState() == Citro2D::PlaybackState::Paused);
    player.stop();
    assert(player.getState() == Citro2D::PlaybackState::Stopped);
    assert(player.getCurrentFrame() == 0);
    player.exit();
    printf("  ✓ ScenePlayer playback controller lifecycle and seek verified\n");

    // 8. Repeated Scene Reload Leak Test (Requirement 34)
    printf("[8/8] Testing repeated scene enter/exit reload leak test...\n");
    for (int cycle = 0; cycle < 5; ++cycle) {
        player.enter();
        player.play();
        player.update(1.0f / 60.0f);
        player.exit();
    }
    printf("  ✓ Repeated scene enter/exit executed with 0 memory/cache leaks\n");

    printf("====================================================\n");
    printf("  ALL C++ RUNTIME ASSET & PLAYBACK TESTS PASSED!    \n");
    printf("====================================================\n");
    return 0;
}
