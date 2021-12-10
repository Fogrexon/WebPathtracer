#include "vec3.hpp"
#include "ray.hpp"
#include "color.hpp"
#include "../BVH.hpp"

#define MAX_REFLECT 3
#define DELTA 0.000001


namespace Raytracer {
  Color raytrace(Ray *ray, ModelBVH *bvh) {
    Vec3 pos = ray->origin;
    Vec3 dir = ray->direction;

    Color result{Vec3(0, 0, 0), 1.0};
    
    for(int i=0;i<MAX_REFLECT;i++) {
      rayHit hit = bvh->intersectModel(pos.toPoint3(), dir.toVec3());

      if (!hit.isHit) {
        return result;
      }

      Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
      Vec3 normal = Vec3(hit.normal.x, hit.normal.y, hit.normal.z);

      pos = point + normal * DELTA;
      dir = reflect(dir, normal);
      result.rgb = result.rgb + (normal + 1.0) * 0.5;
    }

    return result;
  };
}