#ifndef RAYTRACER_VEC3_HPP
#define RAYTRACER_VEC3_HPP

#include <cmath>
#include "../BVH.hpp"

namespace Raytracer {
  class Vec3 {
    public:
      double x;
      double y;
      double z;

      Vec3() { x = y = z = 0; };
      Vec3(double _x) { x = y = z = _x; };
      Vec3(double _x, double _y, double _z): x(_x), y(_y), z(_z) {};

      double length() const {
        return std::sqrt(x*x + y*y + z*z);
      };

      double length2() const {
        return x*x + y*y + z*z;
      };

      point3 toPoint3() const {
        return point3{x, y, z};
      };

      vec3 toVec3() const {
        return vec3{x, y, z};
      };
  };

  Vec3 operator+(const Vec3 &v1, const Vec3 &v2) {
    return Vec3(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
  }

  Vec3 operator-(const Vec3 &v1, const Vec3 &v2) {
    return Vec3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
  }

  Vec3 operator*(const Vec3 &v1, const Vec3 &v2) {
    return Vec3(v1.x * v2.x, v1.y * v2.y, v1.z * v2.z);
  }

  Vec3 operator/(const Vec3 &v1, const Vec3 &v2) {
    return Vec3(v1.x / v2.x, v1.y / v2.y, v1.z / v2.z);
  }

  Vec3 operator+(const Vec3 &v, double k) {
    return Vec3(v.x + k, v.y + k, v.z + k);
  }

  Vec3 operator+(double k, const Vec3 &v) {
    return v + k;
  }

  Vec3 operator-(const Vec3 &v, double k) {
    return Vec3(v.x - k, v.y - k, v.z - k);
  }

  Vec3 operator-(double k, const Vec3 &v) {
    return Vec3(k - v.x, k - v.y, k - v.z);
  }

  Vec3 operator*(const Vec3 &v, double k) {
    return Vec3(v.x * k, v.y * k, v.z * k);
  }

  Vec3 operator*(double k, const Vec3 &v) {
    return v * k;
  }

  Vec3 operator/(const Vec3 &v, double k) {
    return Vec3(v.x / k, v.y / k, v.z / k);
  }

  Vec3 operator/(double k, const Vec3 &v) {
    return Vec3(k / v.x, k / v.y, k / v.z);
  }

  double dot(const Vec3 &v1, const Vec3 &v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  Vec3 cross(Vec3 &v1, Vec3 &v2) {
    return Vec3(
      v1.y * v2.z - v1.z * v2.y,
      v1.z * v2.x - v1.x * v2.z,
      v1.x * v2.y - v1.y * v2.x
    );
  }

  Vec3 normalize(const Vec3 &v) {
    return v / v.length();
  }

  Vec3 reflect(const Vec3 &iv, const Vec3 &n) {
    return iv - 2.0 * dot(iv, n) * n;
  }
}


#endif