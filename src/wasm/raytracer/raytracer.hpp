#include "vec3.hpp"
#include "ray.hpp"
#include "color.hpp"
#include "../BVH.hpp"
#include "material.hpp"
#include "light.hpp"
#include <stdio.h>

#define MAX_REFLECT 10
#define ROULETTE 0.99

// #define RAYTRACER_DEBUG


namespace Raytracer {
  #ifdef RAYTRACER_DEBUG
  
  Color raytrace(Ray& init_ray, Stage& stage, Texture& textures) {

    Ray ray = init_ray;
    ray.pos = init_ray.pos;
    ray.dir = init_ray.dir;

    Vec3 throughput(1, 1, 1);

    Color result{Vec3(0, 0, 0), 1.0};
    rayHitMat hitMat = stage.intersectStage(ray.pos.toPoint3(), ray.dir.toVec3());
    rayHit hit = hitMat.rayhit;

    if (hit.isHit) {
        Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
        Vec3 normal = normalize(Vec3(hit.normal.x, hit.normal.y, hit.normal.z));
        Vec3 uv = Vec3(hit.texcoord.x, hit.texcoord.y, 0.0);

        Vec3 rayStart = point;
        Vec3 s, t;
        orthonormalBasis(normal, s, t);

        Vec3 wo_local = worldToLocal(-ray.dir, s, normal, t);

      // material 受け取り
      Material::BaseMaterial *mat = hitMat.mat;
      // normal
      result.rgb = s * 0.5 + 0.5;
      // uv
      // result.rgb = uv;
      // texture
      // result.rgb = textures.get(mat->texId, uv);
      // isNEE
      // if(mat->isNEE) {
      //   result.rgb = Vec3(1.0, 0.0, 0.0);
      // } else {
      //   result.rgb = Vec3(0.0, 1.0, 0.0);
      // }

    } else {
      result.rgb += throughput * Vec3(0);
    }

    return result;
  };

  #else

  Color raytrace(Ray& init_ray, Stage& stage, Texture& textures) {
    Ray ray = init_ray;
    ray.pos = init_ray.pos;
    ray.dir = init_ray.dir;

    Vec3 throughput(1, 1, 1);

    PlaneLight light(Vec3(0, 3, 0), 1, Vec3(1.0, 1.0, 1.0) * 10.0);

    Color result{Vec3(0, 0, 0), 1.0};
    
    for(int i=0;i<MAX_REFLECT;i++) {
      rayHitMat hitMat = stage.intersectStage(ray.pos.toPoint3(), ray.dir.toVec3());
      rayHit hit = hitMat.rayhit;

      if (hit.isHit) {
        Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
        Vec3 normal = Vec3(hit.normal.x, hit.normal.y, hit.normal.z);
        Vec3 uv = Vec3(hit.texcoord.x, hit.texcoord.y, 0.0);

        // material 受け取り
        Material::BaseMaterial *mat = hitMat.mat;

        // transform to local cood
        Vec3 s, t;
        orthonormalBasis(normal, s, t);

        Vec3 wo_local = worldToLocal(-ray.dir, s, normal, t);

        // reflection calc
        Vec3 brdf;
        Vec3 wi_local;
        double pdf;
        brdf = mat->sample(wo_local, wi_local, pdf, uv, textures);

        double cos = absCosTheta(wi_local);

        Vec3 wi = normalize(localToWorld(wi_local, s, normal, t));

        throughput *= brdf * cos / pdf;

        // raystart
        Vec3 rayStart = point;

        if (mat->isNEE) {
          // NEE
          Vec3 toLightPos(0);
          Vec3 toLightDir(0);
          Vec3 le = light.NEE(point, normal, toLightPos, toLightDir);

          rayHit toLightHit = stage.intersectStage(rayStart.toPoint3(), toLightDir.toVec3()).rayhit;
          Vec3 toLightHitPos = Vec3(toLightHit.point.x, toLightHit.point.y, toLightHit.point.z);
          double lightDist2 = (toLightPos - rayStart).length2();
          double hitDist2 = (toLightHitPos - rayStart).length2();
          if (!toLightHit.isHit || lightDist2 < hitDist2) {
            result.rgb += le * throughput;
          }
        }


        ray = Ray(rayStart, wi);

      } else {
        result.rgb += throughput * Vec3(1.0);
        break;
      }

      if (rnd() >= ROULETTE) {
        break;
      }
      throughput /= ROULETTE;
    }

    return result;
  };

  #endif
}