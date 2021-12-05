import { Matrix4 } from "../../math/Matrix4";

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
 * abstract class of Model
 *
 * @export
 * @class Model
 */
export abstract class Model {
  protected _position: Float32Array = new Float32Array();

  protected _normal: Float32Array = new Float32Array();

  protected _texcoord: Float32Array = new Float32Array();

  protected _indicies: Int32Array = new Int32Array();

  protected _matrix: Matrix4 = new Matrix4();

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
    return this._matrix;
  }
}