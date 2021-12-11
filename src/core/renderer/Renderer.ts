import { Model } from '../model/Model';
import { WasmBuffer } from '../wasm/WasmBuffer';
import { WasmManager } from '../wasm/WasmManager';
import { Camera } from '../camera/Camera';

/**
 * Image renderer. pass model and render image.
 *
 * @export
 * @class Renderer
 */
export class Renderer {
  private wasmManager: WasmManager;

  private pixelData: WasmBuffer | null = null;

  private cameraBuf: WasmBuffer | null = null;

  /**
   * Creates an instance of Renderer.
   * @param {WasmManager} wasmManager
   * @param {Model} model
   * @memberof Renderer
   */
  constructor(wasmManager: WasmManager) {
    this.wasmManager = wasmManager;
  }

  /**
   * Create BVH.
   *
   * @return {*}
   * @memberof Renderer
   */
  public createBound(model: Model) {
    model.createBuffers(this.wasmManager);

    const {texture} = model.material;

    if(texture && texture.isValid() && texture.id < 0 && texture.buffer ) {
      const id = this.wasmManager.callFunction('createTexture', texture.buffer);
      texture.id = id;
      model.material.createBuffers(this.wasmManager);
    }

    return this.wasmManager.callCreateBounding(
      model.positionBuffer as WasmBuffer,
      (model.positionBuffer as WasmBuffer).length / 3,
      model.indiciesBuffer as WasmBuffer,
      (model.indiciesBuffer as WasmBuffer).length / 3,
      model.normalBuffer as WasmBuffer,
      (model.normalBuffer as WasmBuffer).length / 3,
      model.texcoordBuffer as WasmBuffer,
      (model.texcoordBuffer as WasmBuffer).length / 2,
      model.matrixBuffer as  WasmBuffer,
      model.material.buffer as WasmBuffer
    );
  }

  

  /**
   * Render image to canvas
   *
   * @param {HTMLCanvasElement} canvas
   * @return {*}  {number}
   * @memberof Renderer
   */
  public render(canvas: HTMLCanvasElement, camera: Camera): number {
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
    if (!this.pixelData)
      this.pixelData = this.wasmManager.createBuffer('i32', imagedata.data.length);

    if (!this.cameraBuf) this.cameraBuf = this.wasmManager.createBuffer('float', 13);
    this.cameraBuf.setArray(camera.dumpAsArray());
    this.wasmManager.callSetCamera(this.cameraBuf);

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
    if (this.pixelData) {
      this.pixelData.release();
      this.pixelData = null;
    }
    if (this.cameraBuf) {
      this.cameraBuf.release();
      this.cameraBuf = null;
    }
  }
}
