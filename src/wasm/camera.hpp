#include "raytracer/vec3.hpp"

struct camera {
  double dist;
  Raytracer::Vec3 pos, forward, camUp, camRight;
  camera(double _dist = 0.5) :
   dist(_dist),
    pos(0.0, 0.0, 0.0),
    forward(1.0, 0.0, 0.0),
    camUp(0.0, 1.0, 0.0),
    camRight(0.0, 0.0, 1.0)
    {}
  
  Raytracer::Ray getRay(double u, double v) {
    Raytracer::Vec3 sensPos = pos - forward * dist - camUp * v - camRight * u;
    return Raytracer::Ray(pos, normalize(pos - sensPos));
  }
};
