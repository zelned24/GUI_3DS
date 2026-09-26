#include "screens/PikachuEntranceScene.hpp"
#include "screens/SceneAssets.hpp"
#include "screens/AssetManifest.hpp"
#include "gfx/renderer2d.hpp"
#if !defined(__wasm__)
#include "runtime/RuntimeAssetManager.hpp"
#include "runtime/ScenePlayer.hpp"
#endif
#include "core/input_manager.hpp"

int main() {
    Renderer2D renderer;
    if (!renderer.init()) return 1;

    InputManager input;

    // 1. Generated 3DS Screen
    PikachuEntranceScene scene;
    scene.enter();
    scene.handleInput(input);
    scene.update(1.0f / 60.0f);
    scene.drawTop(renderer);
    scene.drawBottom(renderer);
    scene.exit();

#if !defined(__wasm__)
    // 2. Production ScenePlayer playback controller
    Citro2D::ScenePlayer player(Citro2D::g_SceneDefinition);
    player.enter();
    player.play();
    player.update(1.0f / 60.0f);
    player.renderTop(renderer);
    player.renderBottom(renderer);
    player.pause();
    player.seek(15);
    player.exit();
#endif

    renderer.fini();
    return 0;
}
