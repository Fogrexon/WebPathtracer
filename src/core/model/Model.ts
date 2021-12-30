import { Matrix4 } from '../../math/Matrix4';
import { Vector3 } from '../../math/Vector3';
import { Vector4 } from '../../math/Vector4';
import { WasmBuffer } from '../wasm/WasmBuffer';
import { WasmManager } from '../wasm/WasmManager';
import { Material } from '../material/Material';
import { Transform } from './Transform';

/**
 * Data for passing to wasm
 *
 * @export
 * @interface MeshData
 */
export interface MeshData {
  vertexBuffer: number;
  vertexCount: number;
  indexBuffer: number;
  indexCount: number;
}

/**
 * model bounding box
 *
 * @export
 * @interface BoundingBox
 */
export interface BoundingBox {
  /**
   * x, y, z min value
   *
   * @type {Vector3}
   * @memberof BoundingBox
   */
  max: Vector3;
  min: Vector3;
}

/**
 * abstract class of Model
 *
 * @export
 * @class Model
 */
export abstract class Model {
  protected _position: Float32Array = new Float32Array();

  protected _positionBuffer: WasmBuffer | null = null;

  protected _normal: Float32Array = new Float32Array();

  protected _normalBuffer: WasmBuffer | null = null;

  protected _texcoord: Float32Array = new Float32Array();

  protected _texcoordBuffer: WasmBuffer | null = null;

  protected _indicies: Int32Array = new Int32Array();

  protected _indiciesBuffer: WasmBuffer | null = null;

  protected _boundingBox: BoundingBox = { min: new Vector3(), max: new Vector3() };

  protected _matrix: Matrix4 = new Matrix4();

  protected _matrixBuffer: WasmBuffer | null = null;

  protected _transform: Transform = new Transform();

  protected _material: Material;

  constructor(material: Material) {
    this._material = material;
  }

  /**
   * create bounding box from default vertex and matrix
   *
   * @protected
   * @memberof Model
   */
  protected createBoundingBox() {
    const max = new Vector3();
    const min = new Vector3();
    for (let i = 0; i < this._position.length; i += 3) {
      const pos = new Vector4(
        this._position[i + 0],
        this._position[i + 1],
        this._position[i + 2],
        1.0
      );

      max.set(Math.max(max.x, pos.x), Math.max(max.y, pos.y), Math.max(max.z, pos.z));
      min.set(Math.min(min.x, pos.x), Math.min(min.y, pos.y), Math.min(min.z, pos.z));
    }
    this._boundingBox.min = min;
    this._boundingBox.max = max;
  }

  /**
   * model transform.
   *
   * @readonly
   * @memberof Model
   */
  get transform() {
    return this._transform;
  }

  /**
   * Vertex position vector array
   *
   * @readonly
   * @type {Float32Array}
   * @memberof Model
   */
  get position(): Float32Array {
    return this._position;
  }

  /**
   * Vertex normal vector array
   *
   * @readonly
   * @type {Float32Array}
   * @memberof Model
   */
  get normal(): Float32Array {
    return this._normal;
  }

  /**
   * Texcoord vector array
   *
   * @readonly
   * @type {Float32Array}
   * @memberof Model
   */
  get texcoord(): Float32Array {
    return this._texcoord;
  }

  /**
   * Indicies array
   *
   * @readonly
   * @type {Int32Array}
   * @memberof Model
   */
  get indicies(): Int32Array {
    return this._indicies;
  }

  /**
   * Get transform matrix.
   *
   * @readonly
   * @type {Matrix4}
   * @memberof Model
   */
  get matrix(): Matrix4 {
    return this._transform.matrix.multiply(this._matrix) as Matrix4;
  }

  get material(): Material {
    return this._material;
  }

  // buffers
  get positionBuffer() { return this._positionBuffer };

  get normalBuffer() { return this._normalBuffer };

  get texcoordBuffer() { return this._texcoordBuffer };

  get indiciesBuffer() { return this._indiciesBuffer };

  get matrixBuffer() { return this._matrixBuffer };

  createBuffers(manager: WasmManager, canvas: HTMLCanvasElement | OffscreenCanvas) {
    if(!this._positionBuffer) this._positionBuffer = manager.createBuffer('float', this._position.length);
    if(!this._normalBuffer) this._normalBuffer = manager.createBuffer('float', this._normal.length);
    if(!this._texcoordBuffer) this._texcoordBuffer = manager.createBuffer('float', this._texcoord.length);
    if(!this._indiciesBuffer) this._indiciesBuffer = manager.createBuffer('i32', this._indicies.length);
    if(!this._matrixBuffer) this._matrixBuffer = manager.createBuffer('float', this._matrix.matrix.length * 2);

    this._positionBuffer.setArray(this._position);
    this._normalBuffer.setArray(this._normal);
    this._texcoordBuffer.setArray(this._texcoord);
    this._indiciesBuffer.setArray(this._indicies);

    const {matrix} = this;
    this._matrixBuffer.setArray(matrix.matrix.concat(matrix.inverse().matrix));

    this._material.createBuffers(manager, canvas);
  }

  release() {
    if(this._positionBuffer) {
      this._positionBuffer.release();
      this._positionBuffer = null;
    }
    if(this._normalBuffer)  {
      this._normalBuffer.release();
      this._normalBuffer = null;
    }
    if(this._texcoordBuffer)  {
      this._texcoordBuffer.release();
      this._texcoordBuffer = null;
    }
    if(this._indiciesBuffer)  {
      this._indiciesBuffer.release();
      this._indiciesBuffer = null;
    }

    this._material.release();
  }

  /**
   * get bounding box(you should use this after get position)
   *
   * @readonly
   * @memberof Model
   */
  get boundingBox() {
    return this._boundingBox;
  }
}
