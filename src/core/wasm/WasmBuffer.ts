import { WasmArrayType, WasmRawModule, WasmValueType } from "../../types/wasm";

/**
 * Wrapper of wasm array buffer
 *
 * @export
 * @class WasmBuffer
 */
export class WasmBuffer {
  protected module: WasmRawModule;

  protected base: number;

  protected type: WasmValueType | null = null;

  protected stride: number = -1;

  constructor(module: WasmRawModule, array: WasmArrayType) {
    if (array instanceof Float32Array) {this.type = 'f32'; this.stride = 4;}
    else if (array instanceof Float64Array) {this.type = 'f64'; this.stride = 8;}
    else if (array instanceof Int32Array) {this.type = 'i32'; this.stride = 4;}
    else if (array instanceof BigInt64Array) {this.type = 'i64'; this.stride = 8;}

    if (!this.type) throw Error('Buffer type is invalid.');
    this.module = module;


    this.base = this.module._malloc(this.stride * array.length);

    array.forEach((value: number | bigint, index: number) => this.set(index, value));
  }

  /**
   * Get array element
   *
   * @param {number} index
   * @return {*} 
   * @memberof WasmBuffer
   */
  public get(index: number) {
    if (!this.type) return;
    this.module.getValue(this.base + this.stride * index, this.type);
  }

  /**
   * Set array element
   *
   * @param {number} index
   * @param {(number | bigint)} value
   * @return {*} 
   * @memberof WasmBuffer
   */
  public set(index: number, value: number | bigint) {
    if (!this.type) return;
    this.module.setValue(this.base + this.stride * index, value as number, this.type);
  }

  /**
   * Get array pointer
   *
   * @return {*} 
   * @memberof WasmBuffer
   */
  public getPointer() {
    return this.base;
  }

  /**
   * Release array buffer
   *
   * @memberof WasmBuffer
   */
  public release() {
    this.module._free(this.base);
  }
}