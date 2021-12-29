#ifndef RAYTRACER_MATERIAL_BASE_HPP
#define RAYTRACER_MATERIAL_BASE_HPP

#include "../vec3.hpp"
#include "../texture.hpp"

namespace Raytracer::Material {
  struct BaseMaterial {
    bool isNEE = true;
    virtual Raytracer::Vec3 sample(const Raytracer::Vec3& wo, Raytracer::Vec3& wi, double &pdf, Raytracer::Vec3& uv, Raytracer::Texture &textures) = 0;
  };
}

#endif