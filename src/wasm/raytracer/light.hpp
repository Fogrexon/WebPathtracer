#ifndef RAYTRACER_LIGHT_HPP
#define RAYTRACER_LIGHT_HPP

#include <cmath>
#include "random.hpp"

namespace Raytracer {
  class Light {
    public:
      Vec3 color;

      Light(const Vec3& _color): color(_color) {};

      Vec3 Le() const {
        return color;
      };
  };

  // class SphereLight {
  //   public:
  //     Vec3 pos;
  //     Vec3 color;
  //     Light(const Vec3& _pos, const Vec3& _color): pos(_pos), color(_color) {};

  //     // next event estimation
  //     NEE(const Vec3& objpos) {

  //     }
  // }

  struct LightHit {
    bool isHit;
    Vec3& pos;
  };

  class PlaneLight {
    public:
      Vec3 pos;
      double size;
      Vec3 emission;

      PlaneLight(const Vec3& _pos, const double _size, const Vec3& _emission): pos(_pos), size(_size), emission(_emission) {};

      Vec3 NEE(const Vec3& hitPos, const Vec3& hitNorm, Vec3& outPos, Vec3& outDir) {
        // const double pa = 1/(size * size);
        const Vec3 xl = pos + Vec3(rnd() - 0.5, 0, rnd() - 0.5) * size;
        const Vec3 nl = Vec3(0, -1, 0);
        const Vec3 omega = normalize(pos - hitPos);

        const double G = std::abs(dot(omega, hitNorm)) * std::abs(dot(-omega, nl)) / (xl - hitPos).length2();

        outPos.set(xl);
        outDir.set(omega);

        return emission * G;
      };
  };
}

#endif