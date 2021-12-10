#ifndef RAYTRACER_RANDOM_H
#define RAYTRACER_RANDOM_H

namespace Raytracer {
  std::random_device rnd_dev;
  std::mt19937 mt(rnd_dev());
  std::uniform_real_distribution<> dist(0, 1);

  inline double rnd() {
    return dist(mt);
  }
}

#endif