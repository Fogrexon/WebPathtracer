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

  private position: WasmBuffer | null = null;

  private indicies: WasmBuffer | null = null;

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
    if (!this.position) this.position = this.wasmManager.createBuffer(this.model.position);
    if (!this.indicies) this.indicies = this.wasmManager.createBuffer(this.model.indicies);

    return this.wasmManager.callCreateBounding(
      this.position,
      this.model.position.length / 3,
      this.indicies,
      this.model.indicies.length / 3
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

    const pixels = new Int32Array(imagedata.data);

    this.pixelData = this.wasmManager.createBuffer(pixels);

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
