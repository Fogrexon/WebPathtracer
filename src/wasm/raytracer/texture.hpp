#ifndef RAYTRACER_TEXTURE_HPP
#define RAYTRACER_TEXTURE_HPP

#import <cmath>

#define TEXTURE_SIZE 1024

namespace Raytracer {

  class Texture {
    Texture() {};
    private:
      std::vector<int*> textures();

    public:
      int set(float* texture) {
        textures.push_back(texture);
        return textures.size() - 1;
      }

      Vec3 get(int id, Vec3& uv) {
        assert(id >= textures.size(), "texture id is invalid.");
        if (id < 0) return Vec3(1.0);
        int* texture = textures[id];

        float ux = uv.x % 1;
        float uy = uv.y % 1;
        float fx = (int)std::floor(ux * TEXTURE_SIZE);
        float fy = (int)std::floor(uy * TEXTURE_SIZE);
        float cx = (int)std::ceil(ux * TEXTURE_SIZE);
        float cy = (int)std::ceil(ux * TEXTURE_SIZE);

        Vec3 

        float dx = ux * TEXTURE_SIZE - fx;
        float dy = uy * TEXTURE_SIZE - fy;
        
      }

  }
}

#endif