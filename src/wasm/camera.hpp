#include "simpleIntersect.hpp"

inline void orthonormalBasis(const vec3& n, vec3& vx, vec3& vz) {
  if(std::abs(n.x) > 0.9) vx = Vec3(0, 1, 0);
  else vx = Vec3(1, 0, 0);

  vx = normalize(vx - n*dot(vx, n));
  vz = cross(n, vx);
}

class camera {
  int w, h;
  double dist;
  vec3 pos, to;
  vec3 camUp;
public:
  camera(int _w, int _h, double _dist) : w(_w), h(_h), dist(_dist) {}
  void setPos(vec3 _pos) { pos = _pos; }
  void lookAt(vec3 _to) { to = _to; }
  
  vec3 getRay(double u, double v) {
    vec3 camForward = normalize(sub(to, pos));
    vec3 cameraRightDir = normalize(crossProduct(camForward, vec3{0, 1, 0}));
    vec3 cameraTopDir = normalize(crossProduct(camForward, cameraRightDir));
    vec3 sensLocalPos = add(mul(cameraTopDir, -v), mul(cameraRightDir, -u));
    vec3 sensPos = add(pos, add(mul(normalize(sub(to, pos)), dist), sensLocalPos));
    return normalize(sub(pos, sensPos));
  }
};
