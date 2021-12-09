import { Matrix4 } from './Matrix4';
import { Vector3 } from './Vector3';
import { Vector4 } from './Vector4';

export class Quaternion {
  v: Vector3;

  w: number;

  constructor(v?: Vector3, w?: number) {
    this.v = v || new Vector3(0, 0, 0);
    this.w = w || 1;
  }

  // 設定
  set(v: Vector3, w: number): Quaternion {
    this.v = v;
    this.w = w;
    return this;
  }

  angleAxis(angle: number, _axis: Vector3): Quaternion {
    const axis: Vector3 = _axis.normalize();
    this.v = new Vector3(
      axis.x * Math.sin(angle / 2),
      axis.y * Math.sin(angle / 2),
      axis.z * Math.sin(angle / 2)
    );
    this.w = Math.cos(angle / 2);
    return this;
  }

  eularAngle(rot: Vector3): Quaternion {
    const { x, y, z } = rot;
    const xc = Math.cos(x);
    const xs = Math.sin(x);
    const yc = Math.cos(y);
    const ys = Math.sin(y);
    const zc = Math.cos(z);
    const zs = Math.sin(z);
    this.v = new Vector3(
      xc * yc * zc + xs * ys * zs,
      xs * yc * zc - xc * ys * zs,
      xc * ys * zc + xs * yc * zs
    );
    this.w = xc * yc * zs - xs * ys * zc;
    return this;
  }

  matrix(): Matrix4 {
    const { x, y, z } = this.v;
    const { w } = this;
    return new Matrix4([
      x ** 2 - y ** 2 - z ** 2 + w ** 2,
      2 * (x * y + z * w),
      2 * (x * z - y * w),
      0,
      2 * (x * y - z * w),
      y ** 2 - x ** 2 - z ** 2 + w ** 2,
      2 * (y * z + x * w),
      0,
      2 * (x * z + y * w),
      2 * (y * z - x * w),
      z ** 2 + w ** 2 - x ** 2 - y ** 2,
      0,
      0,
      0,
      0,
      1,
    ]);
  }

  fromMatrix(mat: Matrix4): Quaternion {
    const m00: number = mat.matrix[0];
    const m10: number = mat.matrix[1];
    const m20: number = mat.matrix[2];
    const m01: number = mat.matrix[4];
    const m11: number = mat.matrix[5];
    const m21: number = mat.matrix[6];
    const m02: number = mat.matrix[8];
    const m12: number = mat.matrix[9];
    const m22: number = mat.matrix[10];
    const element = [
      m00 - m11 - m22 + 1,
      -m00 + m11 - m22 + 1,
      -m00 - m11 + m22 + 1,
      m00 + m11 + m22 + 1,
    ];

    let maxIndex: number = 0;
    maxIndex = element[maxIndex] < element[1] ? 1 : maxIndex;
    maxIndex = element[maxIndex] < element[2] ? 2 : maxIndex;
    maxIndex = element[maxIndex] < element[3] ? 3 : maxIndex;

    if (element[maxIndex] < 0) {
      this.v = new Vector3(0, 0, 0);
      this.w = 1;
      console.error('Wrong matrix');
      return this;
    }

    const q: number[] = [0, 0, 0, 0];
    let v: number = Math.sqrt(element[maxIndex]) * 0.5 + 0.00001;
    q[maxIndex] = v;
    v = 0.25 / v;

    switch (maxIndex) {
      case 0: {
        q[1] = (m10 + m01) * v;
        q[2] = (m02 + m20) * v;
        q[3] = (m21 - m12) * v;
        break;
      }
      case 1: {
        q[0] = (m10 + m01) * v;
        q[2] = (m21 + m12) * v;
        q[3] = (m02 - m20) * v;
        break;
      }
      case 2: {
        q[0] = (m02 + m20) * v;
        q[1] = (m21 + m12) * v;
        q[3] = (m10 - m01) * v;
        break;
      }
      case 3: {
        q[0] = (m21 - m12) * v;
        q[1] = (m02 - m20) * v;
        q[2] = (m10 - m01) * v;
        break;
      }
      default: {
        break;
      }
    }

    return new Quaternion(new Vector3(q[0], q[1], q[2]), q[3]).normalize();
  }

  normalize(): Quaternion {
    const len = Math.sqrt(this.v.x ** 2 + this.v.y ** 2 + this.v.z ** 2 + this.w ** 2);
    return new Quaternion(
      new Vector3(this.v.x / len, this.v.y / len, this.v.z / len),
      this.w / len
    );
  }

  // 計算
  multiply(a: Quaternion | Vector4): Quaternion | Vector4 {
    if (a instanceof Quaternion) {
      return new Quaternion(
        this.v.cross(a.v).add(this.v.multiply(a.w)).add(a.v.multiply(this.w)),
        this.w * a.w - this.v.dot(a.v)
      );
    }
    return <Vector4>this.matrix().multiply(a);
  }

  public equal(a: Quaternion): boolean {
    return this.v.equal(a.v) && this.w === a.w;
  }

  public copy(): Quaternion {
    return new Quaternion(this.v.copy(), this.w);
  }
}
