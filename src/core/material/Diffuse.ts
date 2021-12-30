import { Vector3 } from '../../math/Vector3';
import { Texture } from '../texture/Texture';
import { WasmManager } from '../wasm/WasmManager';
import { Material } from './Material';

export type MaterialUniformsArray = [
  materialType: number,
  textureID: number,
  color_r: number,
  color_g: number,
  color_b: number
];

export class Diffuse extends Material {
  private color: Vector3;

  constructor(color: Vector3 = new Vector3(1.0), texture: Texture | null = null) {
    super();
    this.color = color;
    this.texture = texture;
  }

  createOptionArray(): number[] {
    return [
      0,
      this.texture ? this.texture.id : -1,
      this.color.x,
      this.color.y,
      this.color.z,
    ] as MaterialUniformsArray;
  }

  createBuffers(manager: WasmManager, canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.texture?.createBuffer(manager, canvas);
    super.createBuffers(manager, canvas);
  }
}
