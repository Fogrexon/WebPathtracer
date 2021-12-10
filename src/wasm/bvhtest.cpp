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

    //   std::vector<point3> vertex = {
    //     {0,0,5},
    //     {-2,-2,2},
    //     {2,-2,2},
    //     {-2,2,2},
    //     {2,2,2},
    //     {-2,-2,-2},
    //     {2,-2,-2},
    //     {-2,2,-2},
    //     {2,2,-2},
    //     {0,0,-5},
    // };

    // std::vector<std::array<int,3>> polygon = {
    //     {0,1,2},
    //     {0,1,3},
    //     {0,3,4},
    //     {0,2,4},
    //     {1,2,4},
    //     {1,3,4},

    //     {1,2,5},
    //     {6,2,5},
    //     {1,3,5},
    //     {7,3,5},
    //     {2,4,6},
    //     {8,4,6},
    //     {3,4,7},
    //     {8,4,7},

    //     {5,6,8},
    //     {5,7,8},
    //     {5,6,9},
    //     {5,7,9},
    //     {6,8,9},
    //     {7,8,9},
    // };

  bvh.construct(vertex, polygon);

  return 0;
}

int EMSCRIPTEN_KEEPALIVE pathTracer(int* a, int width, int height, float rot){
    
    point3 C = {0,-10,0};
    vec3 d = {0,1,0};

    int index = 0;

    // for(int j=-15;j<=15;j++){
    //     index = (j+15) * width;
    //     for(int i=-15;i<=15;i++){
    //         point3 O = C;
    //         O.x += (long double)(i)/2.0;
    //         O.z += (long double)(j)/2.0;

    //         std::pair<bool,point3> t = bvh.intersectModel(O,d);
    //         if(t.first){
    //             a[index * 4 + 0] = 255;
    //             a[index * 4 + 1] = 255;
    //             a[index * 4 + 2] = 255;
    //             a[index * 4 + 3] = 255;
    //         }else{
    //             a[index * 4 + 0] = 0;
    //             a[index * 4 + 1] = 0;
    //             a[index * 4 + 2] = 0;
    //             a[index * 4 + 3] = 255;
    //         }

    //         index ++;
    //     }
    //     std::cout << std::endl;
    // }

    for(int j=-height/2;j<height - height/2;j++){
        for(int i=-width/2;i<width - width/2;i++){
            point3 O = C;
            O.x += (long double)(i) / width * 6.0;
            O.z += (long double)(j) / height * 6.0;

            rayHit hit = bvh.intersectModel(O,d);
            if(hit.isHit){
                int dist = (hit.point.y + 10.0) * 25.0;
                a[index * 4 + 0] = dist;
                a[index * 4 + 1] = dist;
                a[index * 4 + 2] = dist;
                a[index * 4 + 3] = 255;
                a[index * 4 + 0] = (hit.normal.x + 1.0) * 127;
                a[index * 4 + 1] = (hit.normal.y + 1.0) * 127;
                a[index * 4 + 2] = (hit.normal.z + 1.0) * 127;
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