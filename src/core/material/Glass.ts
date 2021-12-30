import { Material } from './Material';

export type GlassUniformArray = [materialType: number, reflectRate: number];

export class Glass extends Material {
  private _rho: number;

  constructor(rho: number) {
    super();
    this._rho = rho;
  }

  createOptionArray(): number[] {
    return [1, this._rho] as GlassUniformArray;
  }
}
