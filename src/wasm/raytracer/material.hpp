#ifndef RAYTRACER_MATERIAL_HPP
#define RAYTRACER_MATERIAL_HPP

#include "random.hpp"
#include "texture.hpp"
#include "vec3.hpp"

#include "material/base.hpp"
#include "material/diffuse.hpp"
#include "material/glass.hpp"

namespace Raytracer {
  
  Material::BaseMaterial* createMaterial(float* params) {
    int type = (int)params[0];
    if (type == 1) {
      return new Material::Glass(params[1]);
    }
    int texId = (int)params[1];
    Vec3 rho(params[2], params[3], params[4]);

    return new Material::Diffuse(rho, texId);
  }

}

#endif