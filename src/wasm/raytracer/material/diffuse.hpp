#ifndef RAYTRACER_MATERIAL_DIFFUSE_HPP
#define RAYTRACER_MATERIAL_DIFFUSE_HPP

#include "base.hpp"
#include "../random.hpp"
#include "../texture.hpp"
#include "../vec3.hpp"

namespace Raytracer::Material {
  // Diffuse
  struct Diffuse : BaseMaterial {
    public:
      Vec3 rho;
      int texId;

      Diffuse(const Raytracer::Vec3& _rho, int _texId) : rho(_rho), texId(_texId) {};

      Raytracer::Vec3 sample(const Raytracer::Vec3& wo, Raytracer::Vec3& wi, double &pdf, Raytracer::Vec3& uv, Raytracer::Texture &textures) override {
        double u = rnd();
        double v = rnd();

        double theta = 0.5 * std::acos(1 - 2 * u);
        double phi = 2 * M_PI * v;

        double x = std::cos(phi) * std::sin(theta);
        double y = std::cos(theta);
        double z = std::sin(phi) * std::sin(theta);

        wi = Raytracer::Vec3(x, y, z);

        pdf = std::cos(theta)/M_PI;

        return rho * textures.get(texId, uv) / M_PI;
      };
  };
}

#endif
