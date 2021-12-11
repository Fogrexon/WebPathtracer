import { WasmArrayType, WasmValueType } from '../../types/wasm';
import { WasmModule } from './WasmModule';

/**
 * Wrapper of wasm array buffer
 *
 * @export
 * @class WasmBuffer
 */
export class WasmBuffer {
  protected _module: WasmModule;

  protected _base: number;

  protected _type: WasmValueType | null = null;

  protected _stride: number = -1;

  protected _length: number = 0;

  get length() {
    return this._length;
  }

  get type() {
    return this._type;
  }

  /**
   * Creates an instance of WasmBuffer.
   * @param {WasmModule} module
   * @param {WasmValueType} type
   * @param {number} size
   * @memberof WasmBuffer
   */
  constructor(module: WasmModule, type: WasmValueType, size: number) {
    if (type === 'i32') this._stride = 4;
    else if (type === 'i64') this._stride = 8;
    else if (type === 'float') this._stride = 4;
    else if (type === 'double') this._stride = 8;
    else throw Error('Invalid buffer type');

    this._type = type;

    this._module = module;

    this._base = this._module._malloc(this._stride * size);
  }

  /**
   * Get value at index
   *
   * @param {number} index
   * @return {*}
   * @memberof WasmBuffer
   */
  public get(index: number): number {
    if (!this.type) return -1;
    return this._module.getValue(this._base + this._stride * index, this.type);
  }

  /**
   * Set value to index
   *
   * @param {number} index
   * @param {(number | bigint)} value
   * @return {*}
   * @memberof WasmBuffer
   */
  public set(index: number, value: number | bigint) {
    if (!this.type) return;
    this._module.setValue(this._base + this._stride * index, value as number, this.type);
  }

  /**
   * Set array to buffer
   *
   * @param {(WasmArrayType | Array<number>)} array
   * @memberof WasmBuffer
   */
  public setArray(array: WasmArrayType | Array<number>) {
    array.forEach((value, index) => this.set(index, value));
  }

  /**
   * Get array pointer
   *
   * @return {*}
   * @memberof WasmBuffer
   */
  public getPointer() {
    return this._base;
  }

  /**
   * Release array buffer
   *
   * @memberof WasmBuffer
   */
  public release() {
    this._module._free(this._base);
  }
}
