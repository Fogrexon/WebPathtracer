import { WasmArrayType } from "../../types/wasm";
import { WasmBuffer } from "./WasmBuffer";
import { WasmModuleGenerator } from './WasmModule';

/**
 * Wasm module wrapper
 *
 * @export
 * @class WasmManager
 */
export class WasmManager extends EventTarget {
  private module: ReturnType<typeof WasmModuleGenerator>;

  /**
   * Creates an instance of WasmManager.
   * @param {string} url wasm file url
   * @memberof WasmManager
   */
  constructor(url: string) {
    super();
    this.module = WasmModuleGenerator(url);
    this.module.onRuntimeInitialized = () => {
      this.dispatchEvent(new Event('initialized'))
    }
  }

  /**
   * Create array argment
   *
   * @param {WasmArrayType} array
   * @return {*} 
   * @memberof WasmManager
   */
  public createBuffer(array: WasmArrayType) {
    return new WasmBuffer(this.module, array);
  }

  /**
   * Call pathTracer function in wasm
   *
   * @param {(...(number | WasmBuffer)[])} args
   * @return {*} 
   * @memberof WasmManager
   */
  public callPathTracer(...args: (number | WasmBuffer)[]) {
    return this.callFunction('pathTracer', ...args);
  }

  public callCreateBounding(...args: (number | WasmBuffer)[]) {
    return this.callFunction('createBounding', ...args);
  }

  public callFunction(funcname: string, ...args: (number | WasmBuffer)[]) {
    const rawArgs = args.map((v) => v instanceof WasmBuffer ? v.getPointer() : v);
    const argTypes = args.map((v) => v instanceof WasmBuffer ? 'pointer' : 'number')
    return this.module.ccall(funcname, 'number', argTypes, rawArgs);
  }
}