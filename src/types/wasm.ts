export type WasmValueType = 'i32' | 'i64' | 'float' | 'double';

export type WasmArrayType = Float32Array | Float64Array | Int32Array | BigInt64Array;

/**
 * Wasm default module
 *
 * @export
 * @interface WasmRawModule
 */
export interface WasmRawModule {
  /**
   * Allocate memory
   *
   * @memberof WasmModule
   */
  _malloc: (size: number) => number;
  /**
   * Deallocate memory
   *
   * @memberof WasmModule
   */
  _free: (size: number) => number;
  /**
   * Set value to pointer
   *
   * @memberof WasmModule
   */
  setValue: (pointer: number, value: number, type: WasmValueType) => number;
  /**
   * Get value of pointer
   *
   * @type {(pointer: number, type: WasmValueType)}
   * @memberof WasmModule
   */
  getValue: (pointer: number, type: WasmValueType) => number;

  /**
   * Path tracer function
   *
   * @memberof WasmRawModule
   */
  _pathTracer: (...args: number[]) => number;

  /**
   * Create Bounding volume
   *
   * @memberof WasmRawModule
   */
  _createBounding: (...args: number[]) => number;
}
