import { WasmValueType } from '../types/wasm';
import { WasmBuffer } from './WasmBuffer';

export interface WasmModule {
  /**
   * Allocate memory
   *
   * @memberof WasmModule
   */
  _malloc(size: number): number;

  /**
   * Deallocate memory
   *
   * @memberof WasmModule
   */
  _free(size: number): number;

  /**
   * Set value to pointer
   *
   * @memberof WasmModule
   */
  setValue(pointer: number, value: number, type: WasmValueType): number;

  /**
   * Get value of pointer
   *
   * @type {(pointer: number, type: WasmValueType)}
   * @memberof WasmModule
   */
  getValue(pointer: number, type: WasmValueType): number;

  /**
   * Path tracer function
   *
   * @memberof WasmRawModule
   */
  _pathTracer(...args: number[]): number;

  /**
   * Create Bounding volume
   *
   * @memberof WasmRawModule
   */
  _createBounding(...args: number[]): number;
  
  /**
   * Set Camera position
   *
   * @memberof WasmRawModule
   */
   _setCamera(...args: number[]): number;

  /**
   * call wasm function
   *
   * @param {string} funcname
   * @param {string} returntype
   * @param {string[]} argtypes
   * @param {((number | WasmBuffer)[])} args
   * @memberof WasmModule
   */
  ccall(funcname: string, returntype: string, argtypes: string[], args: (number | WasmBuffer)[]);

  onRuntimeInitialized(): void;
}

export const WasmModuleGenerator: (url: string) => WasmModule;
