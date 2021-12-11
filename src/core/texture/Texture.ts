import { WasmBuffer } from "../wasm/WasmBuffer";
import { WasmManager } from "../wasm/WasmManager";

const IMAGE_SIZE = 1024;

export class Texture {
  private image: HTMLImageElement;

  private imageArray: Uint8ClampedArray | null = null;
  
  private valid: boolean = false;

  private _buffer: WasmBuffer | null = null;

  public id: number = -1;

  get buffer() {
    return this._buffer;
  }

  constructor(image: HTMLImageElement) {
    this.image = image;
    this.setTexture(image);
  }

  private setTexture(image: HTMLImageElement) {
    this.image = image;
    const cnv = document.createElement('canvas') as HTMLCanvasElement;
    cnv.width = IMAGE_SIZE;
    cnv.height = IMAGE_SIZE;
    const ctx = cnv.getContext('2d');
    if(!ctx) {
      console.error('cannot create texture.');
      return;
    }

    ctx.drawImage(image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    this.imageArray = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
    this.valid = true;
  }

  createBuffer(wasm: WasmManager) {
    if (this._buffer) return;
    this._buffer = wasm.createBuffer('i32', IMAGE_SIZE * IMAGE_SIZE);

    this._buffer.setArray(this.imageArray as Uint8ClampedArray);
  }

  isValid() {
    return this.valid;
  }

  release() {
    this._buffer?.release();
  }
}