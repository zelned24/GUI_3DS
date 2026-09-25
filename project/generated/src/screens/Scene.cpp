#include "screens/Scene.hpp"

namespace Citro2D {

Screen* createScene() {
    static PikachuEntranceScene s_scene;
    return &s_scene;
}

} // namespace Citro2D
