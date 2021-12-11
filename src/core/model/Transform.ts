import { Matrix4 } from '../../math/Matrix4';
import { Quaternion } from '../../math/Quaternion';
import { Vector3 } from '../../math/Vector3';

/**
 * Define 3D model transform and get matrix;
 *
 * @export
 * @class Transform
 */
export class Transform {
  public rotation: Quaternion;

  public position: Vector3;

  public scale: Vector3;

  /**
   * Creates an instance of Transform.
   * @memberof Transform
   */
  constructor() {
    this.rotation = new Quaternion();
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
  }

  /**
   * get transform matrix
   *
   * @readonly
   * @memberof Transform
   */
  get matrix() {
    const translate = new Matrix4().translateMatrix(this.position);
    const scale = new Matrix4().scaleMatrix(this.scale);
    const rotation = this.rotation.matrix();

    return translate.multiply(rotation.multiply(scale)) as Matrix4;
  }
}
