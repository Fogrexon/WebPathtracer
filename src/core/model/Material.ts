import { Vector3 } from "../../math/Vector3";
import { Texture } from "../texture/Texture";
import { WasmBuffer } from "../wasm/WasmBuffer";
import { WasmManager } from "../wasm/WasmManager";

const MATERIAL_UNIFORM_LENGTH = 10;

export type MaterialUniformsArray = [
  materialType: number,
  textureID: number,
  color_r: number,
  color_g: number,
  color_b: number,
]

export class Material {
  private color: Vector3;

  public texture: Texture | null = null;

  private _materialBuffer: WasmBuffer | null = null;

  get buffer() {
    return this._materialBuffer;
  }

  constructor(color: Vector3 = new Vector3(1.0), texture: Texture | null = null) {
    this.color = color;
    this.texture = texture;
  }

  createBuffers(manager: WasmManager) {
    this.texture?.createBuffer(manager);
    if(!this._materialBuffer) this._materialBuffer = manager.createBuffer('float', MATERIAL_UNIFORM_LENGTH);

    this._materialBuffer?.setArray(
      [
        0,
        this.texture ? this.texture.id : -1,
        this.color.x,
        this.color.y,
        this.color.z,
      ] as MaterialUniformsArray
    );
  }

  release() {
    this._materialBuffer?.release();
    this._materialBuffer = null;
  }
}