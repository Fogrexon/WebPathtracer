#ifndef RAYTRACER_COLOR_HPP
#define RAYTRACER_COLOR_HPP

#include "vec3.hpp"

namespace Raytracer {
  struct Color {
    Vec3 rgb;
    double a;
  };
}

#endif
