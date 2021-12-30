import { Texture } from '../texture/Texture';
import { WasmBuffer } from '../wasm/WasmBuffer';
import { WasmManager } from '../wasm/WasmManager';

export const MATERIAL_UNIFORM_LENGTH = 10;

export abstract class Material {
  private _materialBuffer: WasmBuffer | null = null;

  public texture: Texture | null = null;

  get buffer() {
    return this._materialBuffer;
  }

  abstract createOptionArray(): number[];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createBuffers(manager: WasmManager, canvas: HTMLCanvasElement | OffscreenCanvas) {
    if (!this._materialBuffer)
      this._materialBuffer = manager.createBuffer('float', MATERIAL_UNIFORM_LENGTH);

    this._materialBuffer?.setArray(this.createOptionArray());
  }

  release() {
    this._materialBuffer?.release();
    this._materialBuffer = null;
  }
}
