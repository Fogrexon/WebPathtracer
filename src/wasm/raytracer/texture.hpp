#ifndef RAYTRACER_TEXTURE_HPP
#define RAYTRACER_TEXTURE_HPP

#include <cmath>
#include "vec3.hpp"

#define TEXTURE_SIZE 1024

namespace Raytracer {

  class Texture {
    public:
    Texture() {};
    private:
      std::vector<int*> textures;

    public:
      int set(int* texture) {
        textures.push_back(texture);
        return textures.size() - 1;
      }

      Vec3 get(int id, Vec3& uv) {
        assert(id < (int)textures.size()/*, "texture id is invalid."*/);
        if (id < 0) return Vec3(1.0);
        int* texture = textures[id];

        double ux = uv.x;
        double uy = uv.y;
        int fx = std::max(0, (int)std::floor(ux * TEXTURE_SIZE));
        int fy = std::max(0, (int)std::floor(uy * TEXTURE_SIZE));
        int cx = std::min((int)std::ceil(ux * TEXTURE_SIZE), TEXTURE_SIZE - 1);
        int cy = std::min((int)std::ceil(uy * TEXTURE_SIZE), TEXTURE_SIZE - 1);

        int ltindex = fy * TEXTURE_SIZE + fx;
        int lbindex = cy * TEXTURE_SIZE + fx;
        int rtindex = fy * TEXTURE_SIZE + cx;
        int rbindex = cy * TEXTURE_SIZE + cx;

        Vec3 lt((double)texture[ltindex * 4 + 0] / 255.0, (double)texture[ltindex * 4 + 1] / 255.0, (double)texture[ltindex * 4 + 2] / 255.0);
        Vec3 lb((double)texture[lbindex * 4 + 0] / 255.0, (double)texture[lbindex * 4 + 1] / 255.0, (double)texture[lbindex * 4 + 2] / 255.0);
        Vec3 rt((double)texture[rtindex * 4 + 0] / 255.0, (double)texture[rtindex * 4 + 1] / 255.0, (double)texture[rtindex * 4 + 2] / 255.0);
        Vec3 rb((double)texture[rbindex * 4 + 0] / 255.0, (double)texture[rbindex * 4 + 1] / 255.0, (double)texture[rbindex * 4 + 2] / 255.0);

        double dx = ux * TEXTURE_SIZE - fx;
        double dy = uy * TEXTURE_SIZE - fy;

        return lerp(lerp(lt, lb, dy), lerp(rt, rb, dy), dx);
        
      }

  };
}

#endif