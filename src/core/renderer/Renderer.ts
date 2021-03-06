/* eslint-disable no-console */
import { Model } from '../model/Model';
import { WasmBuffer } from '../wasm/WasmBuffer';
import { WasmManager } from '../wasm/WasmManager';
import { Camera } from '../camera/Camera';

const TEXTURE_SIZE = 1024;

/**
 * Image renderer. pass model and render image.
 *
 * @export
 * @class Renderer
 */
export class Renderer {
  private wasmManager: WasmManager;

  private textureCanvas: HTMLCanvasElement | OffscreenCanvas;

  private isWorker: boolean;

  private pixelData: WasmBuffer | null = null;

  private cameraBuf: WasmBuffer | null = null;

  // partial rendering context
  private renderCtx: {
    width: number;
    height: number;
    ctx: CanvasRenderingContext2D;
    pixelData: WasmBuffer;
    imageData: ImageData;
  } | null = null;

  /**
   * Creates an instance of Renderer.
   * @param {WasmManager} wasmManager
   * @param {Model} model
   * @memberof Renderer
   */
  constructor(wasmManager: WasmManager) {
    this.wasmManager = wasmManager;
    this.isWorker = typeof window === 'undefined';
    this.textureCanvas = this.isWorker
      ? new OffscreenCanvas(TEXTURE_SIZE, TEXTURE_SIZE)
      : document.createElement('canvas');
    this.textureCanvas.width = TEXTURE_SIZE;
    this.textureCanvas.height = TEXTURE_SIZE;
  }

  /**
   * Create BVH.
   *
   * @return {*}
   * @memberof Renderer
   */
  public createBound(model: Model) {
    model.createBuffers(this.wasmManager, this.textureCanvas);

    const { texture } = model.material;

    if (texture && texture.isValid() && texture.id < 0 && texture.buffer) {
      const id = this.wasmManager.callFunction('createTexture', texture.buffer);
      texture.id = id;
      model.material.createBuffers(this.wasmManager, this.textureCanvas);
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
      model.matrixBuffer as WasmBuffer,
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
  public render(canvas: HTMLCanvasElement | OffscreenCanvas, camera: Camera): Promise<void> | void {
    const { width, height } = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('cannot get context');
      return;
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
      return;
    }

    let result2 = this.wasmManager.callReadStream(this.pixelData);
    const renderfunc = async () => {
      if (!this.pixelData) return;

      const { pixelData } = this;
      const timer = setInterval(() => {
        result2 = this.wasmManager.callReadStream(pixelData);
        for (let i = 0; i < pixels.length; i += 1) {
          imagedata.data[i] = pixelData.get(i);
        }
        ctx.putImageData(imagedata, 0, 0);
        if (result2 === 0) {
          clearInterval(timer);
        }
      }, 100);

      for (let i = 0; i < pixels.length; i += 1) {
        imagedata.data[i] = this.pixelData.get(i);
      }

      // this.pixelData.release();
      ctx.putImageData(imagedata, 0, 0);
    };

    // eslint-disable-next-line consistent-return
    return renderfunc();
  }

  public preparePartialRendering(canvas: HTMLCanvasElement, camera: Camera) {
    if (this.renderCtx !== null) {
      return -1;
    }

    const { width, height } = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('canvas is failed');
      return -1;
    }

    const imageData = ctx.createImageData(width, height);

    const pixelData = this.wasmManager.createBuffer('i32', imageData.data.length);

    this.renderCtx = {
      width,
      height,
      ctx,
      pixelData,
      imageData,
    };

    if (!this.cameraBuf) this.cameraBuf = this.wasmManager.createBuffer('float', 13);
    this.cameraBuf.setArray(camera.dumpAsArray());
    this.wasmManager.callSetCamera(this.cameraBuf);

    const result = this.wasmManager.callPathTracer(pixelData, width, height);

    if (result < 0) {
      console.error('Path trace failed.');
      return -1;
    }

    return 1;
  }

  public partialRendering(update: boolean = true) {
    if (this.renderCtx == null) {
      return -1;
    }

    const { ctx, pixelData, imageData } = this.renderCtx;

    const pixels = imageData.data;

    const result = this.wasmManager.callReadStream(pixelData);

    if (result < 0) {
      console.error('Path trace failed.');
      return -1;
    }

    for (let i = 0; i < pixels.length; i += 1) {
      imageData.data[i] = pixelData.get(i);
    }
    if (result === 0) {
      pixelData.release();
    }
    if (update || result === 0) {
      ctx.putImageData(imageData, 0, 0);
    }

    return result;
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
