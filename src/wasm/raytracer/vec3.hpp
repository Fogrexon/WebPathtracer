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

      void set(const Vec3& v) {
        x = v.x;
        y = v.y;
        z = v.z;
      }
  
      Vec3 operator-() const {
        return Vec3(-x, -y, -z);
      };

      Vec3& operator+=(const Vec3& v) {
        x += v.x;
        y += v.y;
        z += v.z;
        return *this;
      };
      Vec3& operator-=(const Vec3& v) {
        x -= v.x;
        y -= v.y;
        z -= v.z;
        return *this;
      };
      Vec3& operator*=(const Vec3& v) {
        x *= v.x;
        y *= v.y;
        z *= v.z;
        return *this;
      };
      Vec3& operator/=(const Vec3& v) {
        x /= v.x;
        y /= v.y;
        z /= v.z;
        return *this;
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

  // utils
  double dot(const Vec3 &v1, const Vec3 &v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  Vec3 cross(const Vec3 &v1, const Vec3 &v2) {
    return Vec3(
      v1.y * v2.z - v1.z * v2.y,
      v1.z * v2.x - v1.x * v2.z,
      v1.x * v2.y - v1.y * v2.x
    );
  }

  Vec3 normalize(const Vec3 &v) {
    return v / v.length();
  }

  void orthonormalBasis(const Vec3& v1, Vec3& v2, Vec3& v3) {
    if(std::abs(v1.x) > 0.9) v2 = Vec3(0, 1, 0);
    else v2 = Vec3(1, 0, 0);

    v2 = normalize(v2 - dot(v1, v2) * v1);
    v3 = cross(v1, v2);
  }

  Vec3 reflect(const Vec3 &iv, const Vec3 &n) {
    return iv - 2.0 * dot(iv, n) * n;
  }

  Vec3 worldToLocal(const Vec3& v, const Vec3& s, const Vec3& t, const Vec3& n) {
    return Vec3(dot(v, s), dot(v, t), dot(v, n));
  }

  Vec3 localToWorld(const Vec3& v, const Vec3& s, const Vec3& t, const Vec3& n) {
    Vec3 a = Vec3(s.x, n.x, t.x);
    Vec3 b = Vec3(s.y, n.y, t.y);
    Vec3 c = Vec3(s.z, n.z, t.z);

    return Vec3(dot(v, a), dot(v, b), dot(v, c));
  }

  Vec3 lerp(const Vec3& v1, const Vec3& v2, double t) {
    return v1 * (1 - t) + v2 * t; 
  }

  double cosTheta(const Vec3& localv) {
    return localv.y;
  }
}


#endif