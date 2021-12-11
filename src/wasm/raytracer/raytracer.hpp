#include "vec3.hpp"
#include "ray.hpp"
#include "color.hpp"
#include "../BVH.hpp"
#include "material.hpp"
#include "light.hpp"

#define MAX_REFLECT 10
#define ROULETTE 0.999
#define DELTA 0.000001

//#define RAYTRACER_DEBUG


namespace Raytracer {
  #ifdef RAYTRACER_DEBUG
  
  Color raytrace(Ray& init_ray, Stage& stage, Texture& textures) {

    Ray ray = init_ray;
    ray.pos = init_ray.pos;
    ray.dir = init_ray.dir;

    Vec3 throughput(1, 1, 1);

    //Diffuse mat(Vec3(0.4, 0.4, 0.7),-1);
    PlaneLight light(Vec3(0, 2, 0), 2, Vec3(1, 1, 1));

    Color result{Vec3(0, 0, 0), 1.0};
    rayHitMat hitMat = stage.intersectStage(ray.pos.toPoint3(), ray.dir.toVec3());
    rayHit hit = hitMat.rayhit;

    if (hit.isHit) {
      Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
      Vec3 normal = normalize(Vec3(hit.normal.x, hit.normal.y, hit.normal.z));
      Vec3 uv = Vec3(hit.texcoord.x, hit.texcoord.y, 0.0);

      // material 受け取り
      Diffuse mat = hitMat.mat;
      // normal
      // result.rgb = normal * 0.5 + 0.5;
      // uv
      // result.rgb = uv;
      // texture
      result.rgb = textures.get(mat.texId, uv);

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

    //Diffuse mat(Vec3(0.4, 0.4, 0.7),-1);
    PlaneLight light(Vec3(0, 3, 0), 7, Vec3(3.0, 10.0, 8.0));

    Color result{Vec3(0, 0, 0), 1.0};
    
    for(int i=0;i<MAX_REFLECT;i++) {
      rayHitMat hitMat = stage.intersectStage(ray.pos.toPoint3(), ray.dir.toVec3());
      rayHit hit = hitMat.rayhit;

      if (hit.isHit) {
        Vec3 point = Vec3(hit.point.x, hit.point.y, hit.point.z);
        Vec3 normal = Vec3(hit.normal.x, hit.normal.y, hit.normal.z);
        Vec3 uv = Vec3(hit.texcoord.x, hit.texcoord.y, 0.0);

        // material 受け取り
        Diffuse mat = hitMat.mat;

        Vec3 rayStart = point + DELTA * normal;
        Vec3 s, t;
        orthonormalBasis(normal, s, t);

        Vec3 wo_local = worldToLocal(-ray.dir, s, normal, t);

        // reflection calc
        Vec3 brdf;
        Vec3 wi_local;
        double pdf;
        brdf = mat.sample(wo_local, wi_local, pdf, uv, textures);

        double cos = cosTheta(wi_local);

        Vec3 wi = localToWorld(wi_local, s, normal, t);

        throughput *= brdf * cos / pdf;

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


        ray = Ray(rayStart, wi);

      } else {
        result.rgb += throughput * Vec3(0);
        break;
      }

      if (rnd() >= ROULETTE) break;
      else throughput /= ROULETTE;
    }

    return result;
  };

  #endif
}