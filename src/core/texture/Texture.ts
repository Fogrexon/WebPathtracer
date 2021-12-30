/* eslint-disable no-console */
import { WasmBuffer } from '../wasm/WasmBuffer';
import { WasmManager } from '../wasm/WasmManager';

const IMAGE_SIZE = 1024;

export class Texture {
  private image: HTMLImageElement | null;

  private needsUpdate: boolean;

  private imageArray: Uint8ClampedArray | null = null;

  private valid: boolean = false;

  private _buffer: WasmBuffer | null = null;

  public id: number = -1;

  get buffer() {
    return this._buffer;
  }

  constructor(image?: HTMLImageElement) {
    this.image = image || null;
    this.needsUpdate = true;
  }

  private createPixelArray(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('cannot create texture.');
      return;
    }

    if (this.image) ctx.drawImage(this.image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    this.imageArray = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
    this.valid = true;
  }

  createBuffer(wasm: WasmManager, canvas: HTMLCanvasElement | OffscreenCanvas) {
    if (this.needsUpdate) this.createPixelArray(canvas);
    if (this._buffer) return;
    this._buffer = wasm.createBuffer('i32', IMAGE_SIZE * IMAGE_SIZE * 4);

    this._buffer.setArray(this.imageArray as Uint8ClampedArray);
  }

  isValid() {
    return this.valid;
  }

  release() {
    this._buffer?.release();
  }
}
