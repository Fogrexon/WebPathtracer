import { WasmValueType } from '../../types/wasm';
import { WasmBuffer } from './WasmBuffer';
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
   * @memberof WasmManager
   */
  constructor() {
    super();
    this.module = WasmModuleGenerator();
    this.module.onRuntimeInitialized = () => {
      this.dispatchEvent(new Event('initialized'));
    };
  }

  /**
   * Create array argment
   *
   * @param {WasmArrayType} array
   * @return {*}
   * @memberof WasmManager
   */
  public createBuffer(type: WasmValueType, size: number) {
    return new WasmBuffer(this.module, type, size);
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

  public callSetCamera(...args: (number | WasmBuffer)[]) {
    return this.callFunction('setCamera', ...args);
  }

  public callReadStream(...args: (number | WasmBuffer)[]) {
    return this.callFunction('readStream', ...args);
  }

  public callFunction(funcname: string, ...args: (number | WasmBuffer)[]) {
    const rawArgs = args.map((v) => (v instanceof WasmBuffer ? v.getPointer() : v));
    const argTypes = args.map((v) => (v instanceof WasmBuffer ? 'pointer' : 'number'));
    return this.module.ccall(funcname, 'number', argTypes, rawArgs);
  }
}
