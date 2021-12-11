#include <iostream>
#include <stdio.h>
#include <math.h>
#include <emscripten/emscripten.h>
#include "BVH.hpp"
#include "stage.hpp"
#include "raytracer/raytracer.hpp"
#include "camera.hpp"
#include <algorithm>

int main(int argc, char **argv) {
  printf("Hello WASM World\n");
}

#ifdef __cplusplus
extern "C" {
#endif

Stage stage;
camera cam;
std::vector<int*> textures;

int EMSCRIPTEN_KEEPALIVE createTexture(int* texture) {
  textures.push_back(texture);
  return textures.size() - 1;
}

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

  std::vector<tri3> texcoord;
  for (int i=0;i<texCoordCount * 3;i += 3) {
    tri3 t{texCoord[i+0], texCoord[i+1], texCoord[i+2]};
    texcoord.push_back(t);
  }

  //bvh.construct(vertex, polygon, texcoord);
  stage.add(vertex, polygon, texcoord,{1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1},{1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1});
  stage.add(vertex, polygon, texcoord,{0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1},{0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1});
  stage.add(vertex, polygon, texcoord,{0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1},{0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1});


  return 0;
}

int EMSCRIPTEN_KEEPALIVE setCamera(float* camData) {
  // printf("pos %f %f %f\n", camData[0], camData[1], camData[2]);
  // printf("forward %f %f %f\n", camData[3], camData[4], camData[5]);
  // printf("camUp %f %f %f\n", camData[6], camData[7], camData[8]);
  // printf("camRight %f %f %f\n", camData[9], camData[10], camData[11]);
  // printf("dist %f\n", camData[12]);

  cam.pos = Raytracer::Vec3{camData[0], camData[1], camData[2]};
  cam.forward = Raytracer::Vec3{camData[3], camData[4], camData[5]};
  cam.camUp = Raytracer::Vec3{camData[6], camData[7], camData[8]};
  cam.camRight = Raytracer::Vec3{camData[9], camData[10], camData[11]};
  cam.dist = camData[12];

  return 0;
}

int EMSCRIPTEN_KEEPALIVE setTexture(float* camData) {
  // printf("pos %f %f %f\n", camData[0], camData[1], camData[2]);
  // printf("forward %f %f %f\n", camData[3], camData[4], camData[5]);
  // printf("camUp %f %f %f\n", camData[6], camData[7], camData[8]);
  // printf("camRight %f %f %f\n", camData[9], camData[10], camData[11]);
  // printf("dist %f\n", camData[12]);

  cam.pos = Raytracer::Vec3{camData[0], camData[1], camData[2]};
  cam.forward = Raytracer::Vec3{camData[3], camData[4], camData[5]};
  cam.camUp = Raytracer::Vec3{camData[6], camData[7], camData[8]};
  cam.camRight = Raytracer::Vec3{camData[9], camData[10], camData[11]};
  cam.dist = camData[12];

  return 0;
}

int EMSCRIPTEN_KEEPALIVE pathTracer(int* a, int width, int height){
    std::vector<std::vector<Raytracer::Vec3>> rawPixels(height, std::vector<Raytracer::Vec3>(width));

    int index = 0;

    for(int j = 0; j < height; j++){
        for(int i = 0; i < width; i++){
            const int spp = 3;
            Raytracer::Vec3 resultRgb{};
            for(int s = 0; s < spp; s++) {
                // heightを1とした正規化
                Raytracer::Ray ray = cam.getRay(
                  (double(i) + Raytracer::rnd() - width / 2) / height,
                  -(double(j) + Raytracer::rnd() - height / 2) / height);
                resultRgb += Raytracer::raytrace(ray, stage).rgb;
            }
            resultRgb *= (double(1.0) / spp);

            rawPixels[j][i] = resultRgb;
        }
    }
    
    // 3x3 gaussian
    // constexpr int kernelW = 3, kernelH = 3;
    // double filterKernel[kernelW][kernelH] = {
    //   {1.0/16, 2.0/16, 1.0/16},
    //   {2.0/16, 4.0/16, 2.0/16},
    //   {1.0/16, 2.0/16, 1.0/16}
    // };
    constexpr int kernelW = 1, kernelH = 1;
    double filterKernel[kernelW][kernelH] = {
      {1.0}
    };
    const double gamma = 1/2.2;
    for(int j = 0; j < height; j++){
      for(int i = 0; i < width; i++){
        Raytracer::Vec3 resultRgb{};

        for(int dx = 0; dx < kernelW; dx++){
          for(int dy = 0; dy < kernelH; dy++){
            int sx = std::clamp(i + dx - kernelW / 2, 0, width - 1);
            int sy = std::clamp(j + dy - kernelH / 2, 0, height - 1);
            resultRgb += filterKernel[dx][dy] * rawPixels[sy][sx];
          }
        }
        resultRgb.x = pow(resultRgb.x, gamma);
        resultRgb.y = pow(resultRgb.y, gamma);
        resultRgb.z = pow(resultRgb.z, gamma);

        a[index * 4 + 0] = resultRgb.x * 255;
        a[index * 4 + 1] = resultRgb.y * 255;
        a[index * 4 + 2] = resultRgb.z * 255;
        a[index * 4 + 3] = 255;
        index++;
      }
    }

    return 0;
}

#ifdef __cplusplus
}
#endif