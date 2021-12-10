#include "raytracer/vec3.hpp"

class camera {
  int w, h;
  double dist;
  Raytracer::Vec3 pos, to;
  Raytracer::Vec3 camUp;
public:
  camera(int _w, int _h, double _dist) : w(_w), h(_h), dist(_dist) {}
  void setPos(Raytracer::Vec3 _pos) { pos = _pos; }
  void lookAt(Raytracer::Vec3 _to) { to = _to; }
  
  Raytracer::Vec3 getRay(double u, double v) {
    Raytracer::Vec3 camForward = Raytracer::normalize(to - pos);
    Raytracer::Vec3 cameraRightDir = Raytracer::normalize(Raytracer::cross(camForward, Raytracer::Vec3{0, 1, 0}));
    Raytracer::Vec3 cameraTopDir = Raytracer::normalize(Raytracer::cross(camForward, cameraRightDir));
    Raytracer::Vec3 sensPos = pos + normalize(sub(to, pos)) * dist - cameraTopDir * v - cameraRightDir * u;
    return Raytracer::normalize(pos - sensPos);
  }
};
