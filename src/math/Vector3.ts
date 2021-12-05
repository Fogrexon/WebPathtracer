export class Vector3 {
  public x: number;

  public y: number;

  public z: number;

  constructor(_x: number, _y: number, _z: number) {
    this.x = _x;
    this.y = _y;
    this.z = _z;
  }

  public set(x: number, y: number, z: number): Vector3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  public length2(): number {
    return this.x ** 2.0 + this.y ** 2.0 + this.z ** 2.0;
  }

  public length(): number {
    return Math.sqrt(this.length2());
  }

  public distance(a: Vector3): number {
    return Math.sqrt(
      (this.x - a.x) ** 2 + (this.y - a.y) ** 2 + (this.z - a.z) ** 2,
    );
  }

  public add(a: Vector3 | number): Vector3 {
    if (a instanceof Vector3) return new Vector3(this.x + a.x, this.y + a.y, this.z + a.z);
    return new Vector3(this.x + a, this.y + a, this.z + a);
  }

  public subtract(a: Vector3 | number): Vector3 {
    if (a instanceof Vector3) return new Vector3(this.x - a.x, this.y - a.y, this.z - a.z);
    return new Vector3(this.x - a, this.y - a, this.z - a);
  }

  public multiply(a: Vector3 | number): Vector3 {
    if (a instanceof Vector3) return new Vector3(this.x * a.x, this.y * a.y, this.z * a.z);
    return new Vector3(this.x * a, this.y * a, this.z * a);
  }

  public divide(a: Vector3 | number): Vector3 {
    if (a instanceof Vector3) {
      console.assert(!(a.x === 0 || a.y === 0 || a.z === 0), 'cannot divide by zero');
      return new Vector3(this.x / a.x, this.y / a.y, this.z / a.z);
    }

    console.assert(a !== 0, 'cannot divide by zero');
    return new Vector3(this.x / a, this.y / a, this.z / a);
  }

  public normalize(): Vector3 {
    return this.divide(this.length());
  }

  public dot(a: Vector3): number {
    return this.x * a.x + this.y * a.y + this.z * a.z;
  }

  public cross(a: Vector3): Vector3 {
    return new Vector3(
      this.y * a.z - this.z * a.y,
      this.z * a.x - this.x * a.z,
      this.x * a.y - this.y * a.x,
    );
  }

  public equal(a: Vector3): boolean {
    return this.x === a.x && this.y === a.y && this.z === a.z;
  }

  public copy(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  public getArray(): Float32Array {
    return new Float32Array([this.x, this.y, this.z]);
  }
}

