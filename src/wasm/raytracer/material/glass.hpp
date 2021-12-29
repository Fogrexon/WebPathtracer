#ifndef RAYTRACER_MATERIAL_GLASS_HPP
#define RAYTRACER_MATERIAL_GLASS_HPP

#include "base.hpp"
#include "../random.hpp"
#include "../texture.hpp"
#include "../vec3.hpp"

namespace Raytracer::Material {
  struct Glass: BaseMaterial {
    public:
      Raytracer::Vec3 rho;
      int texId;
      double ior;
      
      // Glass(const Raytracer::Vec3& _rho, int _texId): rho(_rho), texId(_texId) {};
      Glass(double _ior): ior(_ior) {
        isNEE = false;
      };

      double fresnel(const Raytracer::Vec3& v, const Raytracer::Vec3& n, double n1, double n2) {
        double f0 = std::pow((n1 - n2)/(n1 + n2), 2.0);
        double cos = absCosTheta(v);
        return f0 + (1 - f0)*std::pow(1 - cos, 5.0);
      }

      bool refract(const Raytracer::Vec3& v, Raytracer::Vec3& r, const Raytracer::Vec3& n, double n1, double n2) {
        double cos = absCosTheta(v);
        double sin = std::sqrt(std::max(1 - cos*cos, 0.0));
        double alpha = n1/n2 * sin;

        if(alpha*alpha > 1.0) return false;

        r = n1/n2 * (-v + dot(v, n)*n) - std::sqrt(1 - alpha*alpha)*n;

        return true;
      }

      Raytracer::Vec3 sample(const Raytracer::Vec3& wo, Raytracer::Vec3& wi, double &pdf, Raytracer::Vec3& uv, Texture &textures) override {
        bool isEntering = cosTheta(wo) > 0;

        double n1;
        double n2;
        Raytracer::Vec3 normal;

        if(isEntering) {
          n1 = 1.0;
          n2 = ior;
          normal = Raytracer::Vec3(0, 1, 0);
        } else {
          n1 = ior;
          n2 = 1.0;
          normal = Raytracer::Vec3(0, -1, 0);
        }

        double fr = fresnel(wo, normal, n1, n2);

        if(rnd() < fr) {
          wi = reflect(wo, normal);
          pdf = fr;
          return fr / absCosTheta(wi) * Raytracer::Vec3(1.0);
        } else {
          if(refract(wo, wi, normal, n1, n2)) {
            pdf = 1 - fr;
            return std::pow(n1 / n2, 2.0) * (1 - fr) / absCosTheta(wi) * Raytracer::Vec3(1.0);
          } else {
            wi = reflect(wo, normal);
            pdf = 1 - fr;
            return (1 - fr) / absCosTheta(wi) * Raytracer::Vec3(1.0);
          }
        }
      };
  };
}

#endif
