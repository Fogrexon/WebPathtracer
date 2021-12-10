#ifndef RAYTRACER_RAY_HPP
#define RAYTRACER_RAY_HPP

#include "vec3.hpp"

namespace Raytracer {
  class Ray {
    public:
      Vec3 origin;
      Vec3 direction;

      Ray(Vec3 _origin, Vec3 _direction): origin(_origin), direction(_direction) {};
  };
}

#endif