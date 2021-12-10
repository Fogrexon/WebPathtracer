import { Vector3, Quaternion } from "../..";

export class Camera {
  private pos: Vector3;
  private forward: Vector3;
  private top: Vector3;

  constructor(angle: number, pos: Vector3){
    this.pos = pos;
    this.forward = new Vector3(1.0, 0.0, 0.0);
    this.top = new Vector3(0.0, 1.0, 0.0);

    const dist = 0.5 / Math.tan(angle / 2);

    
  }
}
