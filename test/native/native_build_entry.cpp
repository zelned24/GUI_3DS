#include "screens/PikachuEntranceScene.hpp"
#include "screens/SceneAssets.hpp"
#include "screens/AssetManifest.hpp"
#include "gfx/renderer2d.hpp"
#include "core/input_manager.hpp"

int main() {
    Renderer2D renderer;
    if (!renderer.init()) return 1;

    InputManager input;

    // Instantiate generated 3DS Screen
    PikachuEntranceScene scene;
    scene.enter();
    scene.handleInput(input);
    scene.update(1.0f / 60.0f);
    scene.drawTop(renderer);
    scene.drawBottom(renderer);
    scene.exit();

    renderer.fini();
    return 0;
}
