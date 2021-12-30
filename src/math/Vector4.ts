/* eslint-disable no-console */
export class Vector4 {
  public x: number;

  public y: number;

  public z: number;

  public w: number;

  constructor(_x: number = 0, _y: number = 0, _z: number = 0, _w: number = 0) {
    this.x = _x;
    this.y = _y;
    this.z = _z;
    this.w = _w;
  }

  public set(x: number, y: number, z: number, w: number): Vector4 {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  public length2(): number {
    return this.x ** 2.0 + this.y ** 2.0 + this.z ** 2.0 + this.w ** 2.0;
  }

  public length(): number {
    return Math.sqrt(this.length2());
  }

  public distance(a: Vector4): number {
    return Math.sqrt(
      (this.x - a.x) ** 2 + (this.y - a.y) ** 2 + (this.z - a.z) ** 2 + (this.w - a.w) ** 2
    );
  }

  public add(a: Vector4 | number): Vector4 {
    if (a instanceof Vector4) {
      return new Vector4(this.x + a.x, this.y + a.y, this.z + a.z, this.w + a.w);
    }
    return new Vector4(this.x + a, this.y + a, this.z + a, this.w + a);
  }

  public subtract(a: Vector4 | number): Vector4 {
    if (a instanceof Vector4) {
      return new Vector4(this.x - a.x, this.y - a.y, this.z - a.z, this.w - a.w);
    }
    return new Vector4(this.x - a, this.y - a, this.z - a, this.w - a);
  }

  public multiply(a: Vector4 | number): Vector4 {
    if (a instanceof Vector4) {
      return new Vector4(this.x * a.x, this.y * a.y, this.z * a.z, this.w * a.w);
    }
    return new Vector4(this.x * a, this.y * a, this.z * a, this.w * a);
  }

  public divide(a: Vector4 | number): Vector4 {
    if (a instanceof Vector4) {
      console.assert(!(a.x === 0 || a.y === 0 || a.z === 0 || a.w === 0), 'cannot divide by zero');
      return new Vector4(this.x / a.x, this.y / a.y, this.z / a.z, this.w / a.w);
    }
    console.assert(a !== 0, 'cannot divide by zero');
    return new Vector4(this.x / a, this.y / a, this.z / a, this.w / a);
  }

  public normalize(): Vector4 {
    return this.divide(this.length());
  }

  public dot(a: Vector4): number {
    return this.x * a.x + this.y * a.y + this.z * a.z + this.w * a.w;
  }

  public equal(a: Vector4): boolean {
    return this.x === a.x && this.y === a.y && this.z === a.z && this.w === a.w;
  }

  public copy(): Vector4 {
    return new Vector4(this.x, this.y, this.z, this.w);
  }

  public getArray(): Float32Array {
    return new Float32Array([this.x, this.y, this.z, this.w]);
  }
}
