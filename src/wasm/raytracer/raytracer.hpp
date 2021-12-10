#include "vec3.hpp"
#include "ray.hpp"
#include "color.hpp"
#include "../BVH.hpp"
#include "material.hpp"
#include "light.hpp"

#define MAX_REFLECT 2
#define ROULETTE 0.9
#define DELTA 0.000001

#define RAYTRACER_DEBUG


namespace Raytracer {
  #ifdef RAYTRACER_DEBUG
  
  Color raytrace(Ray& init_ray, ModelBVH& bvh) {

    Ray ray = init_ray;
    ray.pos = init_ray.pos;
    ray.dir = init_ray.dir;

    Vec3 throughput(1, 1, 1);

    Diffuse mat(Vec3(0.4, 0.4, 0.9));
    Light light(Vec3(0));

    Color result{Vec3(0, 0, 0), 1.0};
    
    for(int i=0;i<MAX_REFLECT;i++) {
      rayHit hit = bvh.intersectModel(ray.pos.toPoint3(), ray.dir.toVec3());

      if (hit.isHit) {
        Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
        Vec3 normal = normalize(Vec3(hit.normal.x, hit.normal.y, hit.normal.z));
        result.rgb = normal * 0.5 + 0.5;
        break;

      } else {
        result.rgb += throughput * Vec3(1, 1, 1);
        break;
      }
    }

    return result;
  };
  #else
  Color raytrace(Ray& init_ray, ModelBVH& bvh) {

    Ray ray = init_ray;
    ray.pos = init_ray.pos;
    ray.dir = init_ray.dir;

    Vec3 throughput(1, 1, 1);

    Diffuse mat(Vec3(0.4, 0.4, 0.9));
    Light light(Vec3(0));

    Color result{Vec3(0, 0, 0), 1.0};
    
    for(int i=0;i<MAX_REFLECT;i++) {
      rayHit hit = bvh.intersectModel(ray.pos.toPoint3(), ray.dir.toVec3());

      if (hit.isHit) {
        Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
        Vec3 normal = normalize(Vec3(hit.normal.x, hit.normal.y, hit.normal.z));
        Vec3 s, t;
        orthonormalBasis(normal, s, t);

        Vec3 wo_local = worldToLocal(-ray.dir, s, normal, t);

        result.rgb += throughput * light.Le();

        Vec3 brdf;
        Vec3 wi_local;
        double pdf;
        brdf = mat.sample(wo_local, wi_local, pdf);

        double cos = cosTheta(wi_local);

        Vec3 wi = localToWorld(wi_local, s, normal, t);

        throughput *= brdf * cos / pdf;

        ray = Ray(point + DELTA * normal, wi);

      } else {
        result.rgb += throughput * Vec3(1, 1, 1);
        break;
      }

      if (rnd() >= ROULETTE) break;
      else throughput /= ROULETTE;
    }

    return result;
  };

  #endif
}