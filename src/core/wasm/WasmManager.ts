import { WasmArrayType, WasmRawModule } from "../../types/wasm";
import { WasmBuffer } from "./WasmBuffer";

interface WindowIncludeWasm extends Window {
  Module? : WasmRawModule;
}

/**
 * Wasm module wrapper
 *
 * @export
 * @class WasmManager
 */
export class WasmManager {
  private module: WasmRawModule;

  /**
   * Creates an instance of WasmManager.
   * @memberof WasmManager
   */
  constructor() {
    const win = window as WindowIncludeWasm;
    if (!win.Module) throw new Error('Wasm module is not loaded.');
    this.module = win.Module;
  }

  /**
   * Create array argment
   *
   * @param {WasmArrayType} array
   * @return {*} 
   * @memberof WasmManager
   */
  createBuffer(array: WasmArrayType) {
    return new WasmBuffer(this.module, array);
  }

  /**
   * Call pathTracer function in wasm
   *
   * @param {(...(number | WasmBuffer)[])} args
   * @return {*} 
   * @memberof WasmManager
   */
  callPathTracer(...args: (number | WasmBuffer)[]) {
    const rawArgs = args.map((v) => v instanceof WasmBuffer ? v.getPointer() : v);
    return this.module._pathTracer(...rawArgs);
  }
}