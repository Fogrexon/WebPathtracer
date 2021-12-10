import { Model } from '../model/Model';
import { WasmBuffer } from '../wasm/WasmBuffer';
import { WasmManager } from '../wasm/WasmManager';

/**
 * Image renderer. pass model and render image.
 *
 * @export
 * @class Renderer
 */
export class Renderer {
  private wasmManager: WasmManager;

  private model: Model;

  private position: WasmBuffer| null = null;

  private indicies: WasmBuffer| null = null;

  private normal: WasmBuffer| null = null;

  private texcoord: WasmBuffer| null = null;

  private pixelData: WasmBuffer | null = null;

  /**
   * Creates an instance of Renderer.
   * @param {WasmManager} wasmManager
   * @param {Model} model
   * @memberof Renderer
   */
  constructor(wasmManager: WasmManager, model: Model) {
    this.model = model;
    this.wasmManager = wasmManager;
  }

  /**
   * Create BVH.
   *
   * @return {*}
   * @memberof Renderer
   */
  public createBound() {
    if (!this.position) this.position = this.wasmManager.createBuffer('float', this.model.position.length);
    if (!this.indicies) this.indicies = this.wasmManager.createBuffer('i32', this.model.indicies.length);
    if (!this.normal) this.normal = this.wasmManager.createBuffer('float', this.model.normal.length);
    if (!this.texcoord) this.texcoord = this.wasmManager.createBuffer('float', this.model.texcoord.length);

    this.position.setArray(this.model.position);
    this.indicies.setArray(this.model.indicies);
    this.normal.setArray(this.model.normal);
    this.texcoord.setArray(this.model.texcoord);

    return this.wasmManager.callCreateBounding(
      this.position,
      this.model.position.length / 3,
      this.indicies,
      this.model.indicies.length / 3,
      this.normal,
      this.model.normal.length / 3,
      this.texcoord,
      this.model.texcoord.length / 2,
    );
  }

  /**
   * Render image to canvas
   *
   * @param {HTMLCanvasElement} canvas
   * @return {*}  {number}
   * @memberof Renderer
   */
  public render(canvas: HTMLCanvasElement): number {
    const { width, height } = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('canvas is failed');
      return -1;
    }

    const imagedata = ctx.createImageData(width, height);

    const pixels = imagedata.data;

    if (this.pixelData && this.pixelData.length < imagedata.data.length) {
      this.pixelData.release();
      this.pixelData = null;
    } 
    if (!this.pixelData) this.pixelData = this.wasmManager.createBuffer('i32', imagedata.data.length);

    const result = this.wasmManager.callPathTracer(this.pixelData, width, height);

    if (result < 0) {
      console.error('Path trace failed.');
      return -1;
    }

    for (let i = 0; i < pixels.length; i += 1) {
      imagedata.data[i] = this.pixelData.get(i);
    }

    this.pixelData.release();

    ctx.putImageData(imagedata, 0, 0);

    return 1;
  }

  /**
   * Release buffers.
   *
   * @memberof Renderer
   */
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
