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

  // partial rendering context
  private renderCtx: {
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D,
    pixelData: WasmBuffer,
    imageData: ImageData,
  } | null = null;

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
    console.log('start calc');
    
    let result2;
    while((result2 = this.wasmManager.callReadStream(this.pixelData)) == 1){}

    console.log('end calc');

    for (let i = 0; i < pixels.length; i += 1) {
      imagedata.data[i] = this.pixelData.get(i);
    }

    this.pixelData.release();
    ctx.putImageData(imagedata, 0, 0);

    return 1;
  }

  public preparePartialRendering(canvas: HTMLCanvasElement, camera: Camera) {
    if(this.renderCtx !== null){
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
    if(this.renderCtx == null){
      return -1;
    }

    const { width, height, ctx, pixelData, imageData } = this.renderCtx;

    const pixels = imageData.data;
    
    const result = this.wasmManager.callReadStream(pixelData);
    
    if (result < 0) {
      console.error('Path trace failed.');
      return -1;
    }

    for (let i = 0; i < pixels.length; i += 1) {
      imageData.data[i] = pixelData.get(i);
    }
    if(result == 0) {
      pixelData.release();
    }
    if(update || result == 0){
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
