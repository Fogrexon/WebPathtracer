#include <iostream>
#include <stdio.h>
#include <math.h>
#include <emscripten/emscripten.h>
#include "BVH.hpp"
#include "raytracer/raytracer.hpp"
#include "raytracer/vec3.hpp"
#include "raytracer/color.hpp"
#include "raytracer/ray.hpp"

int main(int argc, char **argv) {
  printf("Hello WASM World\n");
}

#ifdef __cplusplus
extern "C" {
#endif

ModelBVH bvh;

int EMSCRIPTEN_KEEPALIVE createBounding(float* position, int posCount, int* indicies, int indexCount, float* normal, int normCount, float* texCoord, int texCoordCount) {
  std::vector<vert> vertex;
  assert(posCount==normCount);
  for (int i=0;i<posCount * 3;i += 3) {
    point3 p{(double)position[i+0], (double)position[i+1], (double)position[i+2]};
    vec3 n{(double)normal[i+0], (double)normal[i+1], (double)normal[i+2]};
    vertex.push_back({p,n});
  }
  
  std::vector<std::array<int,3>> polygon;
  for (int i=0;i<indexCount * 3;i += 3) {
    std::array<int, 3> p{indicies[i+0], indicies[i+1], indicies[i+2]};
    polygon.push_back(p);
  }

  bvh.construct(vertex, polygon);

  return 0;
}

int EMSCRIPTEN_KEEPALIVE pathTracer(int* a, int width, int height){
    
    Raytracer::Vec3 C(0,-10,0);
    Raytracer::Vec3 d(0,1,0);

    int index = 0;

    for(int j=-height/2;j<height - height/2;j++){
        for(int i=-width/2;i<width - width/2;i++){
            Raytracer::Vec3 O = C;
            O.x += (double)(i) / width * 2.0;
            O.z += (double)(j) / height * 2.0;

            Raytracer::Ray ray = Raytracer::Ray(O, d);


            Raytracer::Color result = Raytracer::raytrace(&ray, &bvh);

              a[index * 4 + 0] = result.rgb.x * 255;
              a[index * 4 + 1] = result.rgb.y * 255;
              a[index * 4 + 2] = result.rgb.z * 255;
              a[index * 4 + 3] = 255;
            index ++;
        }
    }
    
    return 0;
}

#ifdef __cplusplus
}
#endif