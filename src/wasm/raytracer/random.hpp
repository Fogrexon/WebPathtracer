#ifndef RAYTRACER_RANDOM_H
#define RAYTRACER_RANDOM_H

#include <random>
#define SEED 

namespace Raytracer {
  std::mt19937 mt(1183276428);
  std::uniform_real_distribution<> dist(0, 1);

  inline double rnd() {
    return dist(mt);
  }
}

#endif