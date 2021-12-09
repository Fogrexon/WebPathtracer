export interface GLTFJsonScene {
  nodes: number[] | string[];
}

export interface GLTFJsonNode {
  children: number[] | string[];
  matrix?: number[];
  rotation?: number[];
  scale?: number[];
  translation?: number[];
  meshes: number[] | string[];
  camera: number | string;
  name: string;
}

export interface GLTFJsonMesh {
  name: string;
  primitives: {
    attibutes: {
      NORMAL: number | string;
      POSITION: number | string;
      [key: string]: number | string;
    };
    indices: number | string;
  };
}

export interface GLTFJsonAccessor {
  bufferView: number | string;
  max?: number[];
  min?: number[];
  type: string;
  count: number;
}

export interface GLTFJsonBufferView {
  buffer: number | string;
  byteLength: number;
  byteOffset: number;
}

export interface GLTFJsonBuffer {
  byteLength: number;
  type: string;
  uri: string;
}

/**
 * GLTFのJsonの型
 *
 * @export
 * @interface GLTFJson
 */
export interface GLTFJson {
  scene: number;
  scenes: GLTFJsonScene[] | { [key: string]: GLTFJsonScene };
  nodes: GLTFJsonNode[] | { [key: string]: GLTFJsonNode };
  meshes: GLTFJsonMesh[] | { [key: string]: GLTFJsonMesh };
  accessors: GLTFJsonAccessor[] | { [key: string]: GLTFJsonAccessor };
  bufferViews: GLTFJsonBufferView[] | { [key: string]: GLTFJsonBufferView };
  buffers: GLTFJsonBuffer[] | { [key: string]: GLTFJsonBuffer };
}
