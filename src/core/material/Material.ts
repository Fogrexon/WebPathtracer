import { WasmBuffer } from "../wasm/WasmBuffer";
import { WasmManager } from "../wasm/WasmManager";

export const MATERIAL_UNIFORM_LENGTH = 10;

export abstract class Material {

  private _materialBuffer: WasmBuffer | null = null;

  get buffer() {
    return this._materialBuffer;
  }

  abstract createOptionArray(): number[];

  createBuffers(manager: WasmManager) {
    if(!this._materialBuffer) this._materialBuffer = manager.createBuffer('float', MATERIAL_UNIFORM_LENGTH);

    this._materialBuffer?.setArray(
      this.createOptionArray()
    );
  }

  release() {
    this._materialBuffer?.release();
    this._materialBuffer = null;
  }
}