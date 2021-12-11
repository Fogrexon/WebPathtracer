import { Vector3 } from "../../math/Vector3";
import { Texture } from "../texture/Texture";
import { WasmBuffer } from "../wasm/WasmBuffer";

export interface MaterialUniforms {
  color: Vector3;
  texture: WasmBuffer | null;
}

export class Material {
  private color: Vector3;

  public texture: Texture | null = null;

  constructor(color: Vector3 = new Vector3(1.0), texture: Texture | null = null) {
    this.color = color;
    this.texture = texture;
  }
}