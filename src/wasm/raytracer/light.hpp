#ifndef RAYTRACER_LIGHT_HPP
#define RAYTRACER_LIGHT_HPP

namespace Raytracer {
  class Light {
    public:
      Vec3 color;

      Light(const Vec3& _color): color(_color) {};

      Vec3 Le() const {
        return color;
      }
  }
}

#endif