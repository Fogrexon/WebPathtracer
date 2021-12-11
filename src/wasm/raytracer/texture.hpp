#ifndef RAYTRACER_TEXTURE_HPP
#define RAYTRACER_TEXTURE_HPP

#include <cmath>

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
        assert(id >= textures.size()/*, "texture id is invalid."*/);
        if (id < 0) return Vec3(1.0);
        int* texture = textures[id];

        double ux = uv.x;
        double uy = 1.0 - uv.y;
        int fx = (int)std::floor(ux * TEXTURE_SIZE);
        int fy = (int)std::floor(uy * TEXTURE_SIZE);
        int cx = (int)std::ceil(ux * TEXTURE_SIZE);
        int cy = (int)std::ceil(ux * TEXTURE_SIZE);

        int ltindex = fy * TEXTURE_SIZE + fx;
        int lbindex = cy * TEXTURE_SIZE + fx;
        int rtindex = fy * TEXTURE_SIZE + cx;
        int rbindex = cy * TEXTURE_SIZE + cx;

        Vec3 lt((double)texture[ltindex * 3 + 0] / 255.0, (double)texture[ltindex * 3 + 1] / 255.0, (double)texture[ltindex * 3 + 2] / 255.0);
        Vec3 lb((double)texture[lbindex * 3 + 0] / 255.0, (double)texture[lbindex * 3 + 1] / 255.0, (double)texture[lbindex * 3 + 2] / 255.0);
        Vec3 rt((double)texture[rtindex * 3 + 0] / 255.0, (double)texture[rtindex * 3 + 1] / 255.0, (double)texture[rtindex * 3 + 2] / 255.0);
        Vec3 rb((double)texture[rbindex * 3 + 0] / 255.0, (double)texture[rbindex * 3 + 1] / 255.0, (double)texture[rbindex * 3 + 2] / 255.0);

        double dx = ux * TEXTURE_SIZE - fx;
        double dy = uy * TEXTURE_SIZE - fy;

        return lerp(lerp(lt, lb, dy), lerp(rt, rb, dy), dx);
        
      }

  };
}

#endif