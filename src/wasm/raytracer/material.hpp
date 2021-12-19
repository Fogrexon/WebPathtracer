#ifndef RAYTRACER_MATERIAL_HPP
#define RAYTRACER_MATERIAL_HPP

#include "random.hpp"
#include "texture.hpp"
#include <cassert>

namespace Raytracer {
  struct Material {
    virtual Vec3 sample(const Vec3& wo, Vec3& wi, double &pdf, Vec3& uv, Texture &textures) = 0;
  };

  // Diffuse
  struct Diffuse : Material {
    public:
      Vec3 rho;
      int texId;

      Diffuse(const Vec3& _rho, int _texId) : rho(_rho), texId(_texId) {};

      Vec3 sample(const Vec3& wo, Vec3& wi, double &pdf, Vec3& uv, Texture &textures) override {
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

  struct Glass: Material {
    public:
      Vec3 rho;
      int texId;
      double ior;
      
      // Glass(const Vec3& _rho, int _texId): rho(_rho), texId(_texId) {};
      Glass(double _ior): ior(_ior) {};

      double fresnel(const Vec3& v, const Vec3& n, double n1, double n2) {
        double f0 = std::pow((n1 - n2) / (n1 + n2), 2.0);
        double cos = absCosTheta(v);
        return f0 + (1 - f0) * std::pow(1 - cos, 5.0);
      }

      bool refract(const Vec3& v, Vec3& r, const Vec3& n, double n1, double n2) {
        double cos = absCosTheta(v);
        double sin = std::sqrt(std::max(1 - cos * cos, 0.0));
        double alpha = n1 / n2 * sin;

        if(alpha * alpha > 1.0) return false;

        r = n1 / n2 * (-v + dot(v, n) * n) - std::sqrt(1 - alpha * alpha) * n;
        
        return true;
      }

      Vec3 sample(const Vec3& wo, Vec3& wi, double &pdf, Vec3& uv, Texture &textures) override {
        bool isEntering = cosTheta(wo) > 0;

        double n1;
        double n2;
        Vec3 normal;

        if(isEntering) {
          n1 = 1.0;
          n2 = ior;
          normal = Vec3(0, -1, 0);
        }

        double fr = fresnel(wo, normal, n1, n2);

        if(rnd() < fr) {
          wi = reflect(wo, normal);
          pdf = fr;
          return fr / absCosTheta(wi) * Vec3(1);
        } else {
          if(refract(wo, wi, normal, n1, n2)) {
            pdf = 1 - fr;
            return std::pow(n1 / n2, 2.0) * (1 - fr) / absCosTheta(wi) * Vec3(1.0);
          } else {
            wi = reflect(wo, normal);
            pdf = 1 - fr;
            return (1 - fr) / absCosTheta(wi) * Vec3(1);
          }
        }
      };
  };


  
  Material* createMaterial(float* params) {
    int type = (int)params[0];
    if (type == 1) {
      return new Glass(params[1]);
    }
    int texId = (int)params[1];
    Vec3 rho(params[2], params[3], params[4]);

    return new Diffuse(rho, texId);
  }

}

#endif