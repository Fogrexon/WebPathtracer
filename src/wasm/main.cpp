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

struct renderingStream {
  bool working = false;
  struct {
    int width, height;
    camera cam;
    Stage stage;
    Raytracer::Texture textureManager;
  } settings;
  struct {
    int j;
    std::vector<std::vector<Raytracer::Vec3>> rawPixels;
  } progress;
};
renderingStream stream;

int EMSCRIPTEN_KEEPALIVE createTexture(int* texture) {
  return stream.settings.textureManager.set(texture);
}

int EMSCRIPTEN_KEEPALIVE createBounding(
  float* position,
  int posCount,
  int* indicies,
  int indexCount,
  float* normal,
  int normCount,
  float* texCoord,
  int texCoordCount,
  float* matrixs,
  float* material
) {
  std::vector<vert> vertex;
  assert(posCount==normCount);
  for (int i=0;i<posCount;i += 1) {
    point3 p{(double)position[3*i+0], (double)position[3*i+1], (double)position[3*i+2]};
    vec3 n{(double)normal[3*i+0], (double)normal[3*i+1], (double)normal[3*i+2]};
    texpoint t{(double)texCoord[2*i+0], (double)texCoord[2*i+1]};
    vertex.push_back({p,n,t});
  }
  
  std::vector<std::array<int,3>> polygon;
  for (int i=0;i<indexCount * 3;i += 3) {
    std::array<int, 3> p{indicies[i+0], indicies[i+1], indicies[i+2]};
    polygon.push_back(p);
  }

  std::array<double,16> matr,matrinv;
  for (int i=0;i < 16;i++) {
    matr[i] = matrixs[i];
    matrinv[i] = matrixs[16+i];
  }

  Raytracer::Material *mat = Raytracer::createMaterial(material);
  stream.settings.stage.add(vertex, polygon,matr,matrinv,mat);


  return 0;
}

int EMSCRIPTEN_KEEPALIVE setCamera(float* camData) {
  // printf("pos %f %f %f\n", camData[0], camData[1], camData[2]);
  // printf("forward %f %f %f\n", camData[3], camData[4], camData[5]);
  // printf("camUp %f %f %f\n", camData[6], camData[7], camData[8]);
  // printf("camRight %f %f %f\n", camData[9], camData[10], camData[11]);
  // printf("dist %f\n", camData[12]);

  stream.settings.cam.pos = Raytracer::Vec3{camData[0], camData[1], camData[2]};
  stream.settings.cam.forward = Raytracer::Vec3{camData[3], camData[4], camData[5]};
  stream.settings.cam.camUp = Raytracer::Vec3{camData[6], camData[7], camData[8]};
  stream.settings.cam.camRight = Raytracer::Vec3{camData[9], camData[10], camData[11]};
  stream.settings.cam.dist = camData[12];
  return 0;
}

int EMSCRIPTEN_KEEPALIVE readStream(int* a){
  if(!stream.working) {
    return -1;
  }

  int width = stream.settings.width, height = stream.settings.height;
  const int lineperupdate = 10;

  if(stream.progress.j < stream.settings.height){
      int j;
      for(j = stream.progress.j; j < height && j < stream.progress.j + lineperupdate; j++){
          for(int i = 0; i < width; i++){
              const int spp = 10;
              Raytracer::Vec3 resultRgb{};
              for(int s = 0; s < spp; s++) {
                  // heightを1とした正規化
                  Raytracer::Ray ray = stream.settings.cam.getRay(
                    (double(i) + Raytracer::rnd() - width / 2) / height,
                    -(double(j) + Raytracer::rnd() - height / 2) / height);
                  resultRgb += Raytracer::raytrace(ray, stream.settings.stage,stream.settings.textureManager).rgb;
              }
              resultRgb *= (double(1.0) / spp);

              stream.progress.rawPixels[j][i] = resultRgb;
              int index = j * width + i;
              a[index * 4 + 0] = resultRgb.x * 255;
              a[index * 4 + 1] = resultRgb.y * 255;
              a[index * 4 + 2] = resultRgb.z * 255;
              a[index * 4 + 3] = 255;
          }
      }
      stream.progress.j = j;
      return 1;
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
          resultRgb += filterKernel[dx][dy] * stream.progress.rawPixels[sy][sx];
        }
      }
      resultRgb.x = pow(resultRgb.x, gamma);
      resultRgb.y = pow(resultRgb.y, gamma);
      resultRgb.z = pow(resultRgb.z, gamma);

      int index = j * width + i;
      a[index * 4 + 0] = resultRgb.x * 255;
      a[index * 4 + 1] = resultRgb.y * 255;
      a[index * 4 + 2] = resultRgb.z * 255;
      a[index * 4 + 3] = 255;
    }
  }
  
  stream.working = false;
  return 0;
}

int EMSCRIPTEN_KEEPALIVE pathTracer(int* a, int width, int height){
    if(stream.working){
      return -1;
    }
    stream.working = true;

    stream.settings.width = width;
    stream.settings.height = height;
    stream.progress.rawPixels.clear();
    stream.progress.rawPixels.assign(height, std::vector<Raytracer::Vec3>(width));
    stream.progress.j = 0;

    for(int i = 0; i < width * height * 4; i++)
      a[i] = 255;

    return 0;
}

#ifdef __cplusplus
}
#endif