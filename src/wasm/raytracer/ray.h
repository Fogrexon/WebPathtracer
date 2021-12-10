#ifndef RAYTRACER_RAY_H
#define RAYTRACER_RAY_H

#include <vec3.h>

namespace raytracer {
  class Ray {
    public:
      Vec3 origin;
      Vec3 direction;

      Ray(vec3 _origin, Vec3 _direction): origin(_origin), direction(_direction) {};
  }
}

#endif