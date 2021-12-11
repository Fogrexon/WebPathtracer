#ifndef RAYTRACER_MATERIAL_HPP
#define RAYTRACER_MATERIAL_HPP

#include "random.hpp"
#include "texture.hpp"

namespace Raytracer {
  class Material {
    public:
      virtual Vec3 sample(const Vec3& wo, Vec3& wi, double &pdf) const = 0;
  };

  Diffuse createMaterial(float* params) {
    int type = (int)params[0];
    assert(type == 0, "material type is invalid");
    int texId = (int)params[1];
    Vec3 rho(params[2], params[3], params[4]);

    return Diffuse(rho, texId);
  }

  class Diffuse : public Material {
    public:
      Vec3 rho;
      int texId;

      Diffuse(const Vec3& _rho, int _texId) : rho(_rho), texId(_texId) {};

      Vec3 sample(const Vec3 &wo, Vec3 &wi, double &pdf, Vec3& uv, Texture &textures) const {
        double u = rnd();
        double v = rnd();

        double theta = 0.5 * std::acos(1 - 2 * u);
        double phi = 2 * M_PI * v;

        double x = std::cos(phi) * std::sin(theta);
        double y = std::cos(theta);
        double z = std::sin(phi) * std::sin(theta);

        wi = Vec3(x, y, z);

        pdf = std::cos(theta)/M_PI;

        return rho * textures.get(texId, uv) / M_PI;
      };
  };
}

#endif