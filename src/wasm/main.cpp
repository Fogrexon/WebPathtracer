#include <stdio.h>
#include <math.h>
#include <emscripten/emscripten.h>
#include "BVH.hpp"

int main(int argc, char **argv) {
  printf("Hello WASM World\n");
}

/*typedef struct {
  float x;
  float y;
  float z;
} vec3;*/

typedef struct {
  float r;
  float g;
  float b;
  float a;
} color;

float length(vec3 v) {
  return sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

vec3 normalize(vec3 v) {
  float len = length(v);

  vec3 norm;
  norm.x = v.x / len;
  norm.y = v.y / len;
  norm.z = v.z / len;

  return norm;
}

vec3 sub(vec3 a, vec3 b) {
  vec3 r;
  r.x = a.x - b.x;
  r.y = a.y - b.y;
  r.z = a.z - b.z;
  return r;
}

vec3 add(vec3 a, vec3 b) {
  vec3 r;
  r.x = a.x + b.x;
  r.y = a.y + b.y;
  r.z = a.z + b.z;
  return r;
}

vec3 mul(vec3 a, float b) {
  vec3 r;
  r.x = a.x * b;
  r.y = a.y * b;
  r.z = a.z * b;
  return r;
}

float map(vec3 pos) {
  return length(pos) - 10.0;
}

color rayCast(vec3 ori, vec3 dir) {
  vec3 pos = ori;
  float dist = 0;
  color res;

  for(int i=0;i<100;i++) {
    float d = map(pos);
    dist += d;
    pos = add(pos, mul(dir, d));
    if (d < 0.001) {
      res.r = exp(- dist / 20.0);
      res.g = exp(- dist / 20.0);
      res.b = exp(- dist / 20.0);
      res.a = 1.0;
      return res;
    }
  }

  res.r = 0.0;
  res.g = 0.0;
  res.b = 0.0;
  res.a = 0.0;
  return res;
}

#ifdef __cplusplus
extern "C" {
#endif

void EMSCRIPTEN_KEEPALIVE pathTracing(int* a, int width, int height)
{
  for(int y=0;y<height;y++) {
    printf("loading... : %d\n", 100 * y / height);
    for(int x=0;x<width;x++) {
      int base = (y * width + x) * 4;

      vec3 pos;
      pos.x = 0.0;
      pos.y = 0.0;
      pos.z = 30.0;

      vec3 dir;
      dir.x = (float)x / (float)width - 0.5;
      dir.y = (float)y / (float)height - 0.5;
      dir.z = -1.0;

      dir = normalize(dir);

      color col = rayCast(pos, dir);

      a[base+0] = col.r * 256;
      a[base+1] = col.g * 256;
      a[base+2] = col.b * 256;
      a[base+3] = 256;
    }
  }

  
}

#ifdef __cplusplus
}
#endif