#ifndef RAYTRACER_MATERIAL_HPP
#define RAYTRACER_MATERIAL_HPP

#include "random.hpp"

namespace Raytracer {
  class Material {
    public:
      virtual Vec3 sample(const Vec3& wo, Vec3& wi, double &pdf) const = 0;
  };

  class Diffuse : public Material {
    public:
      Vec3 rho;

      Diffuse(const Vec3& _rho) : rho(_rho) {};

      Vec3 sample(const Vec3 &wo, Vec3 &wi, double &pdf) const {
        double u = rnd();
        double v = rnd();

        double theta = 0.5 * std::acos(1 - 2 * u);
        double phi = 2 * M_PI * v;

        double x = std::cos(phi) * std::sin(theta);
        double y = std::cos(theta);
        double z = std::sin(phi) * std::sin(theta);

        wi = Vec3(x, y, z);

        pdf = std::cos(theta)/M_PI;

        return rho / M_PI;
      };
  };
}

#endif