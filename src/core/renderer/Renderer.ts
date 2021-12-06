import { Model } from "../model/Model";
import { WasmBuffer } from "../wasm/WasmBuffer";
import { WasmManager } from "../wasm/WasmManager";

export class Renderer {
  private wasmManager: WasmManager;

  private model: Model;

  private position: WasmBuffer | null = null;

  private indicies: WasmBuffer | null = null;

  private pixelData: WasmBuffer | null = null;;

  constructor(wasmManager: WasmManager, model: Model) {
    this.model = model;
    this.wasmManager = wasmManager;
  }

  public createBound() {
    this.position = this.wasmManager.createBuffer(this.model.position);
    this.indicies = this.wasmManager.createBuffer(this.model.indicies);

    return this.wasmManager.callCreateBounding(this.position, this.indicies);
  }

  public render(canvas: HTMLCanvasElement): number {
    const {width, height} = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('canvas is failed');
      return -1;
    }

    const imagedata = ctx.createImageData(width, height);

    const pixels = new Int32Array(imagedata.data);

    this.pixelData = this.wasmManager.createBuffer(pixels);

    const result = this.wasmManager.callPathTracer(this.pixelData, width, height);

    if (result < 0) {
      console.error('Path trace failed.');
      return -1;
    }
    
    for(let i=0;i<pixels.length;i+=1) {
      imagedata.data[i] = this.pixelData.get(i);
    }

    ctx.putImageData(imagedata, 0, 0);

    return 1;
  }

  public release() {
    if (this.position) {
      this.position.release();
      this.position = null;
    }
    if (this.indicies) {
      this.indicies.release();
      this.indicies = null;
    }
    if (this.pixelData) {
      this.pixelData.release();
      this.pixelData = null;
    }
  }
}