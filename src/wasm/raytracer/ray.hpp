#ifndef RAYTRACER_RAY_HPP
#define RAYTRACER_RAY_HPP

#include "vec3.hpp"

namespace Raytracer {
  class Ray {
    public:
      Vec3 pos;
      Vec3 dir;

      Ray(Vec3 _pos, Vec3 _dir): pos(_pos), dir(_dir) {};
  };
}

#endif