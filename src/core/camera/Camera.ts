import { Vector3 } from "../../math/Vector3";
import { Quaternion } from "../../math/Quaternion";

export class Camera {
  private _pos: Vector3;
  private _forward: Vector3;
  private _top: Vector3;
  private _dist: number;

  constructor(viewAngle: number){
    this._pos = new Vector3(0.0, 0.0, 0.0);
    this._forward = new Vector3(1.0, 0.0, 0.0);
    this._top = new Vector3(0.0, 1.0, 0.0);
    this._dist = 0.5 / Math.tan(viewAngle / 2);
  }

  get pos(): Vector3 {
    return this._pos;
  }
  set pos(pos: Vector3) {
    this._pos = pos;
  }

  get forward(): Vector3 {
    return this._forward;
  }
  set forward(forward: Vector3) {
    this._forward = forward.normalize();
    const right = this._forward.cross(this._top);
    this._top = right.cross(this._forward).normalize();
  }

  get top(): Vector3 {
    return this._top;
  }
  set top(top: Vector3) {
    this._top = top.normalize();
    const right = this._forward.cross(this._top);
    this._forward = this._top.cross(right).normalize();
  }

  get dist(): number {
    return this._dist;
  }
  set dist(dist: number) {
    this._dist = dist;
  }

  get viewAngle(): number {
    return 2 * Math.atan(0.5 / this._dist);
  }
  set viewAngle(viewAngle: number) {
    this._dist = 0.5 / Math.tan(viewAngle / 2);
  }
}
