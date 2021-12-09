import { Vector4 } from '../..';
import { Matrix4 } from '../../math/Matrix4';
import { Vector3 } from '../../math/Vector3';

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

export interface BoundingBox {
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

  protected _normal: Float32Array = new Float32Array();

  protected _texcoord: Float32Array = new Float32Array();

  protected _indicies: Int32Array = new Int32Array();

  protected _boundingBox: BoundingBox = { min: new Vector3(), max: new Vector3() };

  protected _matrix: Matrix4 = new Matrix4();

  protected transformPosition() {
    const max = new Vector3();
    const min = new Vector3();
    for (let i = 0; i < this._position.length; i += 3) {
      const pos = new Vector4(
        this._position[i + 0],
        this.position[i + 1],
        this._position[i + 3],
        1.0
      );

      const newPos = this._matrix.multiply(pos) as Vector4;

      max.set(Math.max(max.x, newPos.x), Math.max(max.y, newPos.y), Math.max(max.z, newPos.z));
      min.set(Math.min(min.x, newPos.x), Math.min(min.y, newPos.y), Math.min(min.z, newPos.z));

      this._position[i + 0] = newPos.x;
      this._position[i + 1] = newPos.y;
      this._position[i + 2] = newPos.z;
    }
  }

  protected transformNormal() {
    const rot = this._matrix.getScaleRotationMatrix();
    for (let i = 0; i < this._position.length; i += 3) {
      const pos = new Vector4(
        this._position[i + 0],
        this.position[i + 1],
        this._position[i + 3],
        1.0
      );

      const newPos = rot.multiply(pos) as Vector4;

      this._position[i + 0] = newPos.x;
      this._position[i + 1] = newPos.y;
      this._position[i + 2] = newPos.z;
    }
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
    return this._matrix;
  }
}
