import { Matrix4 } from "../math/Matrix4";

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

  protected _indicies: Int16Array = new Int16Array();

  protected _matrix: Matrix4 = new Matrix4();

  get position(): Float32Array {
    return this._position;
  }

  get normal(): Float32Array {
    return this._normal;
  }

  get texcoord(): Float32Array {
    return this._texcoord;
  }

  get indicies(): Int16Array {
    return this._indicies;
  }

  get matrix(): Matrix4 {
    return this._matrix;
  }
}