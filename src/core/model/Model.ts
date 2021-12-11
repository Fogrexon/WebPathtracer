import { Matrix4 } from '../../math/Matrix4';
import { Vector3 } from '../../math/Vector3';
import { Vector4 } from '../../math/Vector4';
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

  protected _normal: Float32Array = new Float32Array();

  protected _texcoord: Float32Array = new Float32Array();

  protected _indicies: Int32Array = new Int32Array();

  protected _boundingBox: BoundingBox = { min: new Vector3(), max: new Vector3() };

  protected _matrix: Matrix4 = new Matrix4();

  protected _transform: Transform = new Transform();

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

      const newPos = this._matrix.multiply(pos) as Vector4;

      max.set(Math.max(max.x, newPos.x), Math.max(max.y, newPos.y), Math.max(max.z, newPos.z));
      min.set(Math.min(min.x, newPos.x), Math.min(min.y, newPos.y), Math.min(min.z, newPos.z));
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
    const position = new Float32Array(this._position.length);
    const { matrix } = this;
    for (let i = 0; i < this._position.length; i += 3) {
      const pos = new Vector4(
        this._position[i + 0],
        this._position[i + 1],
        this._position[i + 2],
        1.0
      );

      const newPos = matrix.multiply(pos) as Vector4;

      position[i + 0] = newPos.x;
      position[i + 1] = newPos.y;
      position[i + 2] = newPos.z;
    }
    return position;
  }

  /**
   * Vertex normal vector array
   *
   * @readonly
   * @type {Float32Array}
   * @memberof Model
   */
  get normal(): Float32Array {
    const rot = this.matrix.getScaleRotationMatrix();
    const normal = new Float32Array(this._normal.length);
    for (let i = 0; i < this._normal.length; i += 3) {
      const pos = new Vector4(this._normal[i + 0], this._normal[i + 1], this._normal[i + 2], 1.0);

      const newPos = (rot.multiply(pos) as Vector4).normalize();

      normal[i + 0] = newPos.x;
      normal[i + 1] = newPos.y;
      normal[i + 2] = newPos.z;
    }
    return normal;
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
