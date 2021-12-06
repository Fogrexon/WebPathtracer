#include <iostream>
#include <stdio.h>
#include <math.h>
#include <emscripten/emscripten.h>
#include "BVH.hpp"

int main(int argc, char **argv) {
  printf("Hello WASM World\n");
}

#ifdef __cplusplus
extern "C" {
#endif

ModelBVH bvh;

int EMSCRIPTEN_KEEPALIVE createBounding(float* position, int posCount, int* indicies, int indexCount) {
  std::vector<point3> vertex(posCount);
  for (int i=0;i<posCount * 3;i += 3) {
    point3 p{(double)position[i+0], (double)position[i+1], (double)position[i+2]};
    vertex.push_back(p);
  }
  
  std::vector<std::array<int,3>> polygon(indexCount);
  for (int i=0;i<indexCount * 3;i += 3) {
    std::array<int, 3> p{indicies[i+0], indicies[i+1], indicies[i+2]};
    polygon.push_back(p);
  }

  bvh.construct(vertex, polygon);

  return 0;
}

int EMSCRIPTEN_KEEPALIVE pathTracer(int* a, int width, int height){
    
    point3 C = {0,-10,0};
    vec3 d = {0,1,0};

    int index = 0;

    for(int j=-height/2;j<=height / 2;j++){
        for(int i=-width/2;i<=width/2;i++){
            point3 O = C;
            O.x += (long double)(i) / width * 8.0;
            O.z += (long double)(j) / height * 8.0;

            std::pair<bool,point3> t = bvh.intersectModel(O,d);
            if(t.first){
                a[index * 4 + 0] = 255;
                a[index * 4 + 1] = 255;
                a[index * 4 + 2] = 255;
                a[index * 4 + 3] = 255;
            }else{
                a[index * 4 + 0] = 0;
                a[index * 4 + 1] = 0;
                a[index * 4 + 2] = 0;
                a[index * 4 + 3] = 255;
            }
            index ++;
        }
    }
    
    return 0;
}

#ifdef __cplusplus
}
#endif