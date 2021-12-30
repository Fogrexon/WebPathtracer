export type WasmValueType = 'i32' | 'i64' | 'float' | 'double';

// export type WasmArrayType = Float32Array | Float64Array | Int32Array | BigInt64Array;
export type WasmArrayType =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;
