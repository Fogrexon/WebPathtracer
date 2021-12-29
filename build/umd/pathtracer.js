
  /**
   * @license
   * PathTracer.js v0.1.0
   * Released under the MIT License.
   */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.PathTracer = {}));
})(this, (function (exports) { 'use strict';

    /**
     * Image renderer. pass model and render image.
     *
     * @export
     * @class Renderer
     */
    class Renderer {
      wasmManager;
      pixelData = null;
      cameraBuf = null; // partial rendering context

      renderCtx = null;
      /**
       * Creates an instance of Renderer.
       * @param {WasmManager} wasmManager
       * @param {Model} model
       * @memberof Renderer
       */

      constructor(wasmManager) {
        this.wasmManager = wasmManager;
      }
      /**
       * Create BVH.
       *
       * @return {*}
       * @memberof Renderer
       */


      createBound(model) {
        model.createBuffers(this.wasmManager);
        const {
          texture
        } = model.material;

        if (texture && texture.isValid() && texture.id < 0 && texture.buffer) {
          const id = this.wasmManager.callFunction('createTexture', texture.buffer);
          texture.id = id;
          model.material.createBuffers(this.wasmManager);
        }

        return this.wasmManager.callCreateBounding(model.positionBuffer, model.positionBuffer.length / 3, model.indiciesBuffer, model.indiciesBuffer.length / 3, model.normalBuffer, model.normalBuffer.length / 3, model.texcoordBuffer, model.texcoordBuffer.length / 2, model.matrixBuffer, model.material.buffer);
      }
      /**
       * Render image to canvas
       *
       * @param {HTMLCanvasElement} canvas
       * @return {*}  {number}
       * @memberof Renderer
       */


      render(canvas, camera) {
        const {
          width,
          height
        } = canvas;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('canvas is failed');
          return;
        }

        const imagedata = ctx.createImageData(width, height);
        const pixels = imagedata.data;

        if (this.pixelData && this.pixelData.length < imagedata.data.length) {
          this.pixelData.release();
          this.pixelData = null;
        }

        if (!this.pixelData) this.pixelData = this.wasmManager.createBuffer('i32', imagedata.data.length);
        if (!this.cameraBuf) this.cameraBuf = this.wasmManager.createBuffer('float', 13);
        this.cameraBuf.setArray(camera.dumpAsArray());
        this.wasmManager.callSetCamera(this.cameraBuf);
        const result = this.wasmManager.callPathTracer(this.pixelData, width, height);

        if (result < 0) {
          console.error('Path trace failed.');
          return;
        }

        let result2 = this.wasmManager.callReadStream(this.pixelData);

        const renderfunc = async () => {
          if (!this.pixelData) return;
          const {
            pixelData
          } = this;
          const timer = setInterval(() => {
            result2 = this.wasmManager.callReadStream(pixelData);

            for (let i = 0; i < pixels.length; i += 1) {
              imagedata.data[i] = pixelData.get(i);
            }

            ctx.putImageData(imagedata, 0, 0);

            if (result2 === 0) {
              clearInterval(timer);
            }
          }, 100);

          for (let i = 0; i < pixels.length; i += 1) {
            imagedata.data[i] = this.pixelData.get(i);
          } // this.pixelData.release();


          ctx.putImageData(imagedata, 0, 0);
        }; // eslint-disable-next-line consistent-return


        return renderfunc();
      }

      preparePartialRendering(canvas, camera) {
        if (this.renderCtx !== null) {
          return -1;
        }

        const {
          width,
          height
        } = canvas;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('canvas is failed');
          return -1;
        }

        const imageData = ctx.createImageData(width, height);
        const pixelData = this.wasmManager.createBuffer('i32', imageData.data.length);
        this.renderCtx = {
          width,
          height,
          ctx,
          pixelData,
          imageData
        };
        if (!this.cameraBuf) this.cameraBuf = this.wasmManager.createBuffer('float', 13);
        this.cameraBuf.setArray(camera.dumpAsArray());
        this.wasmManager.callSetCamera(this.cameraBuf);
        const result = this.wasmManager.callPathTracer(pixelData, width, height);

        if (result < 0) {
          console.error('Path trace failed.');
          return -1;
        }

        return 1;
      }

      partialRendering(update = true) {
        if (this.renderCtx == null) {
          return -1;
        }

        const {
          ctx,
          pixelData,
          imageData
        } = this.renderCtx;
        const pixels = imageData.data;
        const result = this.wasmManager.callReadStream(pixelData);

        if (result < 0) {
          console.error('Path trace failed.');
          return -1;
        }

        for (let i = 0; i < pixels.length; i += 1) {
          imageData.data[i] = pixelData.get(i);
        }

        if (result === 0) {
          pixelData.release();
        }

        if (update || result === 0) {
          ctx.putImageData(imageData, 0, 0);
        }

        return result;
      }
      /**
       * Release buffers.
       *
       * @memberof Renderer
       */


      release() {
        if (this.pixelData) {
          this.pixelData.release();
          this.pixelData = null;
        }

        if (this.cameraBuf) {
          this.cameraBuf.release();
          this.cameraBuf = null;
        }
      }

    }

    class Vector3 {
      x;
      y;
      z;

      constructor(_x = 0, _y = 0, _z = 0) {
        this.x = _x;
        this.y = _y;
        this.z = _z;
      }

      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }

      length2() {
        return this.x ** 2.0 + this.y ** 2.0 + this.z ** 2.0;
      }

      length() {
        return Math.sqrt(this.length2());
      }

      distance(a) {
        return Math.sqrt((this.x - a.x) ** 2 + (this.y - a.y) ** 2 + (this.z - a.z) ** 2);
      }

      add(a) {
        if (a instanceof Vector3) return new Vector3(this.x + a.x, this.y + a.y, this.z + a.z);
        return new Vector3(this.x + a, this.y + a, this.z + a);
      }

      subtract(a) {
        if (a instanceof Vector3) return new Vector3(this.x - a.x, this.y - a.y, this.z - a.z);
        return new Vector3(this.x - a, this.y - a, this.z - a);
      }

      multiply(a) {
        if (a instanceof Vector3) return new Vector3(this.x * a.x, this.y * a.y, this.z * a.z);
        return new Vector3(this.x * a, this.y * a, this.z * a);
      }

      divide(a) {
        if (a instanceof Vector3) {
          console.assert(!(a.x === 0 || a.y === 0 || a.z === 0), 'cannot divide by zero');
          return new Vector3(this.x / a.x, this.y / a.y, this.z / a.z);
        }

        console.assert(a !== 0, 'cannot divide by zero');
        return new Vector3(this.x / a, this.y / a, this.z / a);
      }

      normalize() {
        return this.divide(this.length());
      }

      dot(a) {
        return this.x * a.x + this.y * a.y + this.z * a.z;
      }

      cross(a) {
        return new Vector3(this.y * a.z - this.z * a.y, this.z * a.x - this.x * a.z, this.x * a.y - this.y * a.x);
      }

      equal(a) {
        return this.x === a.x && this.y === a.y && this.z === a.z;
      }

      copy() {
        return new Vector3(this.x, this.y, this.z);
      }

      getArray() {
        return new Float32Array([this.x, this.y, this.z]);
      }

    }

    class Vector4 {
      x;
      y;
      z;
      w;

      constructor(_x = 0, _y = 0, _z = 0, _w = 0) {
        this.x = _x;
        this.y = _y;
        this.z = _z;
        this.w = _w;
      }

      set(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
      }

      length2() {
        return this.x ** 2.0 + this.y ** 2.0 + this.z ** 2.0 + this.w ** 2.0;
      }

      length() {
        return Math.sqrt(this.length2());
      }

      distance(a) {
        return Math.sqrt((this.x - a.x) ** 2 + (this.y - a.y) ** 2 + (this.z - a.z) ** 2 + (this.w - a.w) ** 2);
      }

      add(a) {
        if (a instanceof Vector4) {
          return new Vector4(this.x + a.x, this.y + a.y, this.z + a.z, this.w + a.w);
        }

        return new Vector4(this.x + a, this.y + a, this.z + a, this.w + a);
      }

      subtract(a) {
        if (a instanceof Vector4) {
          return new Vector4(this.x - a.x, this.y - a.y, this.z - a.z, this.w - a.w);
        }

        return new Vector4(this.x - a, this.y - a, this.z - a, this.w - a);
      }

      multiply(a) {
        if (a instanceof Vector4) {
          return new Vector4(this.x * a.x, this.y * a.y, this.z * a.z, this.w * a.w);
        }

        return new Vector4(this.x * a, this.y * a, this.z * a, this.w * a);
      }

      divide(a) {
        if (a instanceof Vector4) {
          console.assert(!(a.x === 0 || a.y === 0 || a.z === 0 || a.w === 0), 'cannot divide by zero');
          return new Vector4(this.x / a.x, this.y / a.y, this.z / a.z, this.w / a.w);
        }

        console.assert(a !== 0, 'cannot divide by zero');
        return new Vector4(this.x / a, this.y / a, this.z / a, this.w / a);
      }

      normalize() {
        return this.divide(this.length());
      }

      dot(a) {
        return this.x * a.x + this.y * a.y + this.z * a.z + this.w * a.w;
      }

      equal(a) {
        return this.x === a.x && this.y === a.y && this.z === a.z && this.w === a.w;
      }

      copy() {
        return new Vector4(this.x, this.y, this.z, this.w);
      }

      getArray() {
        return new Float32Array([this.x, this.y, this.z, this.w]);
      }

    }

    /**
     * 4x4 matrix
     *
     * @export
     * @class Matrix4
     */

    class Matrix4 {
      matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      /**
       *
       * @param {number[]} [numArray] Matrix elements(16 length)
       * @memberof Matrix4
       */

      constructor(numArray) {
        if (numArray) this.set(numArray);
      }
      /**
       * Identity matrix
       *
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      eye() {
        this.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        return this;
      }
      /**
       * Set matrix elements
       *
       * @param {number[]} numArray Matrix elements(16 length)
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      set(numArray) {
        this.matrix = numArray;
        return this;
      }
      /**
       * create empty matrix
       *
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      empty() {
        this.matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        return this;
      }
      /**
       * create matrix filled with a
       *
       * @param {number} a filling number
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      fill(a) {
        this.matrix = [a, a, a, a, a, a, a, a, a, a, a, a, a, a, a, a];
        return this;
      }
      /**
       * Create scale matrix
       *
       * @param {Vector3} scale
       * @return {*}
       * @memberof Matrix4
       */


      scaleMatrix(scale) {
        this.matrix = [scale.x, 0, 0, 0, 0, scale.y, 0, 0, 0, 0, scale.z, 0, 0, 0, 0, 1];
        return this;
      }
      /**
       * Create translate matrix
       *
       * @param {Vector3} move
       * @return {*}
       * @memberof Matrix4
       */


      translateMatrix(move) {
        this.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, move.x, move.y, move.z, 1];
        return this;
      }
      /**
       * Add matrixes
       *
       * @param {(Matrix4 | number)} add
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      add(add) {
        const m = this.matrix;

        if (add instanceof Matrix4) {
          const n = add.matrix;
          return new Matrix4([m[0] + n[0], m[1] + n[1], m[2] + n[2], m[3] + n[3], m[4] + n[4], m[5] + n[5], m[6] + n[6], m[7] + n[7], m[8] + n[8], m[9] + n[9], m[10] + n[10], m[11] + n[11], m[12] + n[12], m[13] + n[13], m[14] + n[14], m[15] + n[15]]);
        }

        return new Matrix4([m[0] + add, m[1] + add, m[2] + add, m[3] + add, m[4] + add, m[5] + add, m[6] + add, m[7] + add, m[8] + add, m[9] + add, m[10] + add, m[11] + add, m[12] + add, m[13] + add, m[14] + add, m[15] + add]);
      }
      /**
       * subtract matrixes
       *
       * @param {Matrix4} sub
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      subtract(sub) {
        const m = this.matrix;

        if (sub instanceof Matrix4) {
          const n = sub.matrix;
          return new Matrix4([m[0] - n[0], m[1] - n[1], m[2] - n[2], m[3] - n[3], m[4] - n[4], m[5] - n[5], m[6] - n[6], m[7] - n[7], m[8] - n[8], m[9] - n[9], m[10] - n[10], m[11] - n[11], m[12] - n[12], m[13] - n[13], m[14] - n[14], m[15] - n[15]]);
        }

        return new Matrix4([m[0] + sub, m[1] + sub, m[2] + sub, m[3] + sub, m[4] + sub, m[5] + sub, m[6] + sub, m[7] + sub, m[8] + sub, m[9] + sub, m[10] + sub, m[11] + sub, m[12] + sub, m[13] + sub, m[14] + sub, m[15] + sub]);
      }
      /**
       * multiply matrixes
       *
       * @param {(number | Matrix4 | Vector4)} mul
       * @return {*}  {(Matrix4 | Vector4)}
       * @memberof Matrix4
       */


      multiply(mul) {
        const m = this.matrix;

        if (mul instanceof Matrix4) {
          const n = mul.matrix;
          return new Matrix4([m[0] * n[0] + m[4] * n[1] + m[8] * n[2] + m[12] * n[3], m[1] * n[0] + m[5] * n[1] + m[9] * n[2] + m[13] * n[3], m[2] * n[0] + m[6] * n[1] + m[10] * n[2] + m[14] * n[3], m[3] * n[0] + m[7] * n[1] + m[11] * n[2] + m[15] * n[3], m[0] * n[4] + m[4] * n[5] + m[8] * n[6] + m[12] * n[7], m[1] * n[4] + m[5] * n[5] + m[9] * n[6] + m[13] * n[7], m[2] * n[4] + m[6] * n[5] + m[10] * n[6] + m[14] * n[7], m[3] * n[4] + m[7] * n[5] + m[11] * n[6] + m[15] * n[7], m[0] * n[8] + m[4] * n[9] + m[8] * n[10] + m[12] * n[11], m[1] * n[8] + m[5] * n[9] + m[9] * n[10] + m[13] * n[11], m[2] * n[8] + m[6] * n[9] + m[10] * n[10] + m[14] * n[11], m[3] * n[8] + m[7] * n[9] + m[11] * n[10] + m[15] * n[11], m[0] * n[12] + m[4] * n[13] + m[8] * n[14] + m[12] * n[15], m[1] * n[12] + m[5] * n[13] + m[9] * n[14] + m[13] * n[15], m[2] * n[12] + m[6] * n[13] + m[10] * n[14] + m[14] * n[15], m[3] * n[12] + m[7] * n[13] + m[11] * n[14] + m[15] * n[15]]);
        }

        if (mul instanceof Vector4) {
          return new Vector4(m[0] * mul.x + m[4] * mul.y + m[8] * mul.z + m[12] * mul.w, m[1] * mul.x + m[5] * mul.y + m[9] * mul.z + m[13] * mul.w, m[2] * mul.x + m[6] * mul.y + m[10] * mul.z + m[14] * mul.w, m[3] * mul.x + m[7] * mul.y + m[11] * mul.z + m[15] * mul.w);
        }

        return new Matrix4([m[0] * mul, m[1] * mul, m[2] * mul, m[3] * mul, m[4] * mul, m[5] * mul, m[6] * mul, m[7] * mul, m[8] * mul, m[9] * mul, m[10] * mul, m[11] * mul, m[12] * mul, m[13] * mul, m[14] * mul, m[15] * mul]);
      }
      /**
       * transpose matrix
       *
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      transpose() {
        const m = this.matrix;
        return new Matrix4([m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]]);
      }
      /**
       * inverse matrix (if invarid matrix, throw error)
       *
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      inverse() {
        const mat = this.matrix;
        const a = mat[0];
        const b = mat[1];
        const c = mat[2];
        const d = mat[3];
        const e = mat[4];
        const f = mat[5];
        const g = mat[6];
        const h = mat[7];
        const i = mat[8];
        const j = mat[9];
        const k = mat[10];
        const l = mat[11];
        const m = mat[12];
        const n = mat[13];
        const o = mat[14];
        const p = mat[15];
        const q = a * f - b * e;
        const r = a * g - c * e;
        const s = a * h - d * e;
        const t = b * g - c * f;
        const u = b * h - d * f;
        const v = c * h - d * g;
        const w = i * n - j * m;
        const x = i * o - k * m;
        const y = i * p - l * m;
        const z = j * o - k * n;
        const A = j * p - l * n;
        const B = k * p - l * o;
        let ivd = q * B - r * A + s * z + t * y - u * x + v * w;
        if (ivd === 0) throw new Error('detA == 0');
        ivd = 1 / ivd;
        const dest = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        dest[0] = (f * B - g * A + h * z) * ivd;
        dest[1] = (-b * B + c * A - d * z) * ivd;
        dest[2] = (n * v - o * u + p * t) * ivd;
        dest[3] = (-j * v + k * u - l * t) * ivd;
        dest[4] = (-e * B + g * y - h * x) * ivd;
        dest[5] = (a * B - c * y + d * x) * ivd;
        dest[6] = (-m * v + o * s - p * r) * ivd;
        dest[7] = (i * v - k * s + l * r) * ivd;
        dest[8] = (e * A - f * y + h * w) * ivd;
        dest[9] = (-a * A + b * y - d * w) * ivd;
        dest[10] = (m * u - n * s + p * q) * ivd;
        dest[11] = (-i * u + j * s - l * q) * ivd;
        dest[12] = (-e * z + f * x - g * w) * ivd;
        dest[13] = (a * z - b * x + c * w) * ivd;
        dest[14] = (-m * t + n * r - o * q) * ivd;
        dest[15] = (i * t - j * r + k * q) * ivd;
        return new Matrix4(dest);
      }
      /**
       * get array as Float32Array
       *
       * @return {*}  {Float32Array}
       * @memberof Matrix4
       */


      getArray() {
        return new Float32Array(this.matrix);
      }
      /**
       * get matrix only scaled and rotated
       *
       * @return {*}  {Matrix4}
       * @memberof Matrix4
       */


      getScaleRotationMatrix() {
        const m = this.matrix;
        return new Matrix4([m[0], m[1], m[2], 0, m[4], m[5], m[6], 0, m[8], m[9], m[10], 0, 0, 0, 0, 1]);
      }
      /**
       * get translate vector
       *
       * @return {*}  {Vector3}
       * @memberof Matrix4
       */


      getTranslateVector() {
        return new Vector3(this.matrix[12], this.matrix[13], this.matrix[14]);
      }

    }

    class Quaternion {
      v;
      w;

      constructor(v, w) {
        this.v = v || new Vector3(0, 0, 0);
        this.w = w || 1;
      } // 設定


      set(v, w) {
        this.v = v;
        this.w = w;
        return this;
      }

      angleAxis(angle, _axis) {
        const axis = _axis.normalize();

        this.v = new Vector3(axis.x * Math.sin(angle / 2), axis.y * Math.sin(angle / 2), axis.z * Math.sin(angle / 2));
        this.w = Math.cos(angle / 2);
        return this;
      }

      eularAngle(rot) {
        const {
          x,
          y,
          z
        } = rot;
        const xc = Math.cos(x);
        const xs = Math.sin(x);
        const yc = Math.cos(y);
        const ys = Math.sin(y);
        const zc = Math.cos(z);
        const zs = Math.sin(z);
        this.v = new Vector3(xc * yc * zc + xs * ys * zs, xs * yc * zc - xc * ys * zs, xc * ys * zc + xs * yc * zs);
        this.w = xc * yc * zs - xs * ys * zc;
        return this;
      }

      matrix() {
        const {
          x,
          y,
          z
        } = this.v;
        const {
          w
        } = this;
        return new Matrix4([x ** 2 - y ** 2 - z ** 2 + w ** 2, 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), y ** 2 - x ** 2 - z ** 2 + w ** 2, 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), z ** 2 + w ** 2 - x ** 2 - y ** 2, 0, 0, 0, 0, 1]);
      }

      fromMatrix(mat) {
        const m00 = mat.matrix[0];
        const m10 = mat.matrix[1];
        const m20 = mat.matrix[2];
        const m01 = mat.matrix[4];
        const m11 = mat.matrix[5];
        const m21 = mat.matrix[6];
        const m02 = mat.matrix[8];
        const m12 = mat.matrix[9];
        const m22 = mat.matrix[10];
        const element = [m00 - m11 - m22 + 1, -m00 + m11 - m22 + 1, -m00 - m11 + m22 + 1, m00 + m11 + m22 + 1];
        let maxIndex = 0;
        maxIndex = element[maxIndex] < element[1] ? 1 : maxIndex;
        maxIndex = element[maxIndex] < element[2] ? 2 : maxIndex;
        maxIndex = element[maxIndex] < element[3] ? 3 : maxIndex;

        if (element[maxIndex] < 0) {
          this.v = new Vector3(0, 0, 0);
          this.w = 1;
          console.error('Wrong matrix');
          return this;
        }

        const q = [0, 0, 0, 0];
        let v = Math.sqrt(element[maxIndex]) * 0.5 + 0.00001;
        q[maxIndex] = v;
        v = 0.25 / v;

        switch (maxIndex) {
          case 0:
            {
              q[1] = (m10 + m01) * v;
              q[2] = (m02 + m20) * v;
              q[3] = (m21 - m12) * v;
              break;
            }

          case 1:
            {
              q[0] = (m10 + m01) * v;
              q[2] = (m21 + m12) * v;
              q[3] = (m02 - m20) * v;
              break;
            }

          case 2:
            {
              q[0] = (m02 + m20) * v;
              q[1] = (m21 + m12) * v;
              q[3] = (m10 - m01) * v;
              break;
            }

          case 3:
            {
              q[0] = (m21 - m12) * v;
              q[1] = (m02 - m20) * v;
              q[2] = (m10 - m01) * v;
              break;
            }
        }

        return new Quaternion(new Vector3(q[0], q[1], q[2]), q[3]).normalize();
      }

      normalize() {
        const len = Math.sqrt(this.v.x ** 2 + this.v.y ** 2 + this.v.z ** 2 + this.w ** 2);
        return new Quaternion(new Vector3(this.v.x / len, this.v.y / len, this.v.z / len), this.w / len);
      } // 計算


      multiply(a) {
        if (a instanceof Quaternion) {
          return new Quaternion(this.v.cross(a.v).add(this.v.multiply(a.w)).add(a.v.multiply(this.w)), this.w * a.w - this.v.dot(a.v));
        }

        return this.matrix().multiply(a);
      }

      equal(a) {
        return this.v.equal(a.v) && this.w === a.w;
      }

      copy() {
        return new Quaternion(this.v.copy(), this.w);
      }

    }

    /**
     * Define 3D model transform and get matrix;
     *
     * @export
     * @class Transform
     */

    class Transform {
      rotation;
      position;
      scale;
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
        return translate.multiply(rotation.multiply(scale));
      }

    }

    /**
     * abstract class of Model
     *
     * @export
     * @class Model
     */

    class Model {
      _position = new Float32Array();
      _positionBuffer = null;
      _normal = new Float32Array();
      _normalBuffer = null;
      _texcoord = new Float32Array();
      _texcoordBuffer = null;
      _indicies = new Int32Array();
      _indiciesBuffer = null;
      _boundingBox = {
        min: new Vector3(),
        max: new Vector3()
      };
      _matrix = new Matrix4();
      _matrixBuffer = null;
      _transform = new Transform();
      _material;

      constructor(material) {
        this._material = material;
      }
      /**
       * create bounding box from default vertex and matrix
       *
       * @protected
       * @memberof Model
       */


      createBoundingBox() {
        const max = new Vector3();
        const min = new Vector3();

        for (let i = 0; i < this._position.length; i += 3) {
          const pos = new Vector4(this._position[i + 0], this._position[i + 1], this._position[i + 2], 1.0);
          max.set(Math.max(max.x, pos.x), Math.max(max.y, pos.y), Math.max(max.z, pos.z));
          min.set(Math.min(min.x, pos.x), Math.min(min.y, pos.y), Math.min(min.z, pos.z));
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


      get position() {
        return this._position;
      }
      /**
       * Vertex normal vector array
       *
       * @readonly
       * @type {Float32Array}
       * @memberof Model
       */


      get normal() {
        return this._normal;
      }
      /**
       * Texcoord vector array
       *
       * @readonly
       * @type {Float32Array}
       * @memberof Model
       */


      get texcoord() {
        return this._texcoord;
      }
      /**
       * Indicies array
       *
       * @readonly
       * @type {Int32Array}
       * @memberof Model
       */


      get indicies() {
        return this._indicies;
      }
      /**
       * Get transform matrix.
       *
       * @readonly
       * @type {Matrix4}
       * @memberof Model
       */


      get matrix() {
        return this._transform.matrix.multiply(this._matrix);
      }

      get material() {
        return this._material;
      } // buffers


      get positionBuffer() {
        return this._positionBuffer;
      }

      get normalBuffer() {
        return this._normalBuffer;
      }

      get texcoordBuffer() {
        return this._texcoordBuffer;
      }

      get indiciesBuffer() {
        return this._indiciesBuffer;
      }

      get matrixBuffer() {
        return this._matrixBuffer;
      }

      createBuffers(manager) {
        if (!this._positionBuffer) this._positionBuffer = manager.createBuffer('float', this._position.length);
        if (!this._normalBuffer) this._normalBuffer = manager.createBuffer('float', this._normal.length);
        if (!this._texcoordBuffer) this._texcoordBuffer = manager.createBuffer('float', this._texcoord.length);
        if (!this._indiciesBuffer) this._indiciesBuffer = manager.createBuffer('i32', this._indicies.length);
        if (!this._matrixBuffer) this._matrixBuffer = manager.createBuffer('float', this._matrix.matrix.length * 2);

        this._positionBuffer.setArray(this._position);

        this._normalBuffer.setArray(this._normal);

        this._texcoordBuffer.setArray(this._texcoord);

        this._indiciesBuffer.setArray(this._indicies);

        const {
          matrix
        } = this;

        this._matrixBuffer.setArray(matrix.matrix.concat(matrix.inverse().matrix));

        this._material.createBuffers(manager);
      }

      release() {
        if (this._positionBuffer) {
          this._positionBuffer.release();

          this._positionBuffer = null;
        }

        if (this._normalBuffer) {
          this._normalBuffer.release();

          this._normalBuffer = null;
        }

        if (this._texcoordBuffer) {
          this._texcoordBuffer.release();

          this._texcoordBuffer = null;
        }

        if (this._indiciesBuffer) {
          this._indiciesBuffer.release();

          this._indiciesBuffer = null;
        }

        this._material.release();
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

    /**
     * glTF model data
     *
     * @export
     * @class GLTFLoader
     */

    class GLTFLoader extends Model {
      rawJson = null;
      /**
       * load glTF
       *
       * @param {string} url GLTFのURL
       * @memberof GLTFLoader
       */

      async load(url) {
        const response = await fetch(url);
        if (response.headers.get('Content-Type') !== 'model/gltf+json') throw Error(`This data is ${response.headers.get('Content-Type')} ,not model/gltf+json.`);
        this.rawJson = await response.json();
        await this.analize();
      }
      /**
       * analyze json data (super simple)
       *
       * @private
       * @return {*}
       * @memberof GLTFLoader
       */


      async analize() {
        if (!this.rawJson) return; // first node only

        const {
          nodes,
          meshes,
          accessors,
          bufferViews,
          buffers
        } = this.rawJson;
        if (!Array.isArray(nodes) || !Array.isArray(meshes) || !Array.isArray(accessors) || !Array.isArray(bufferViews) || !Array.isArray(buffers)) throw new Error('gltf file with array type only');
        const [node] = nodes;
        const {
          primitives: [primitive]
        } = meshes[0];
        const bufPos = bufferViews[primitive.attributes.POSITION];
        const bufNorm = bufferViews[primitive.attributes.NORMAL];
        const bufTex = bufferViews[primitive.attributes.TEXCOORD_0];
        const bufInd = bufferViews[primitive.indices]; // const [bufPos, bufNorm, bufTex, bufInd] = bufferViews;

        const [{
          uri
        }] = buffers; // make default transform matrix

        node.translation = node.translation || [0, 0, 0];
        node.rotation = node.rotation || [0, 0, 0, 1];
        node.scale = node.scale || [1, 1, 1];
        const translate = new Matrix4().translateMatrix(new Vector3(node.translation[0], node.translation[1], node.translation[2]));
        const scale = new Matrix4().scaleMatrix(new Vector3(node.scale[0], node.scale[1], node.scale[2]));
        const rotation = new Quaternion(new Vector3(node.rotation[0], node.rotation[1], node.rotation[2]), node.rotation[3]).matrix();
        this._matrix = translate.multiply(rotation.multiply(scale)); // decode or fetch binary file

        const response = await fetch(uri);
        const buffer = await (await response.blob()).arrayBuffer(); // set default value

        this._position = new Float32Array(buffer, bufPos.byteOffset, bufPos.byteLength / 4);
        this.createBoundingBox();
        this._normal = new Float32Array(buffer, bufNorm.byteOffset, bufNorm.byteLength / 4);
        this._texcoord = new Float32Array(buffer, bufTex.byteOffset, bufTex.byteLength / 4);
        this._indicies = Int32Array.from(new Int16Array(buffer, bufInd.byteOffset, bufInd.byteLength / 2));
      }

    }

    const MATERIAL_UNIFORM_LENGTH = 10;
    class Material {
      _materialBuffer = null;
      texture = null;

      get buffer() {
        return this._materialBuffer;
      }

      createBuffers(manager) {
        var _this$_materialBuffer;

        if (!this._materialBuffer) this._materialBuffer = manager.createBuffer('float', MATERIAL_UNIFORM_LENGTH);
        (_this$_materialBuffer = this._materialBuffer) === null || _this$_materialBuffer === void 0 ? void 0 : _this$_materialBuffer.setArray(this.createOptionArray());
      }

      release() {
        var _this$_materialBuffer2;

        (_this$_materialBuffer2 = this._materialBuffer) === null || _this$_materialBuffer2 === void 0 ? void 0 : _this$_materialBuffer2.release();
        this._materialBuffer = null;
      }

    }

    class Glass extends Material {
      _rho;

      constructor(rho) {
        super();
        this._rho = rho;
      }

      createOptionArray() {
        return [1, this._rho];
      }

    }

    class Diffuse extends Material {
      color;

      constructor(color = new Vector3(1.0), texture = null) {
        super();
        this.color = color;
        this.texture = texture;
      }

      createOptionArray() {
        return [0, this.texture ? this.texture.id : -1, this.color.x, this.color.y, this.color.z];
      }

      createBuffers(manager) {
        var _this$texture;

        (_this$texture = this.texture) === null || _this$texture === void 0 ? void 0 : _this$texture.createBuffer(manager);
        super.createBuffers(manager);
      }

    }

    class Camera {
      _pos;
      _forward;
      _top;
      _right;
      _dist;

      constructor(viewAngle) {
        this._pos = new Vector3(0.0, 0.0, 0.0);
        this._forward = new Vector3(1.0, 0.0, 0.0);
        this._top = new Vector3(0.0, 1.0, 0.0);
        this._right = new Vector3(0.0, 0.0, 1.0);
        this._dist = 0.5 / Math.tan(viewAngle / 2);
      }

      get pos() {
        return this._pos;
      }

      set pos(pos) {
        this._pos = pos;
      }

      get forward() {
        return this._forward;
      }

      set forward(forward) {
        this._forward = forward.normalize();

        const right = this._forward.cross(this._top);

        this._top = right.cross(this._forward).normalize();
      }

      get top() {
        return this._top;
      }

      set top(top) {
        this._top = top.normalize();

        const right = this._forward.cross(this._top);

        this._forward = this._top.cross(right).normalize();
      }

      get dist() {
        return this._dist;
      }

      set dist(dist) {
        this._dist = dist;
      }

      get viewAngle() {
        return 2 * Math.atan(0.5 / this._dist);
      }

      set viewAngle(viewAngle) {
        this._dist = 0.5 / Math.tan(viewAngle / 2);
      }

      lookAt(to) {
        if (to.equal(this._pos)) {
          this._forward = new Vector3(1, 0, 0);
        } else {
          this._forward = to.subtract(this._pos).normalize();
        }

        this._right = this._forward.cross(new Vector3(0, 1, 0)).normalize();

        if (this._right.length() === 0) {
          this._right = new Vector3(0, 0, 1);
        }

        this._top = this._right.cross(this._forward).normalize();
      }

      dumpAsArray() {
        return [this._pos.x, this._pos.y, this._pos.z, this._forward.x, this._forward.y, this._forward.z, this._top.x, this._top.y, this._top.z, this._right.x, this._right.y, this._right.z, this._dist];
      }

    }

    const IMAGE_SIZE = 1024;
    class Texture {
      image;
      imageArray = null;
      valid = false;
      _buffer = null;
      id = -1;

      get buffer() {
        return this._buffer;
      }

      constructor(image) {
        this.image = image;
        this.setTexture(image);
      }

      setTexture(image) {
        this.image = image;
        const cnv = document.createElement('canvas');
        cnv.width = IMAGE_SIZE;
        cnv.height = IMAGE_SIZE;
        const ctx = cnv.getContext('2d');

        if (!ctx) {
          console.error('cannot create texture.');
          return;
        }

        ctx.drawImage(image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
        this.imageArray = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
        this.valid = true;
      }

      createBuffer(wasm) {
        if (this._buffer) return;
        this._buffer = wasm.createBuffer('i32', IMAGE_SIZE * IMAGE_SIZE * 4);

        this._buffer.setArray(this.imageArray);
      }

      isValid() {
        return this.valid;
      }

      release() {
        var _this$_buffer;

        (_this$_buffer = this._buffer) === null || _this$_buffer === void 0 ? void 0 : _this$_buffer.release();
      }

    }

    /**
     * Wrapper of wasm array buffer
     *
     * @export
     * @class WasmBuffer
     */
    class WasmBuffer {
      _module;
      _base;
      _type = null;
      _stride = -1;
      _length = 0;

      get length() {
        return this._length;
      }

      get type() {
        return this._type;
      }
      /**
       * Creates an instance of WasmBuffer.
       * @param {WasmModule} module
       * @param {WasmValueType} type
       * @param {number} size
       * @memberof WasmBuffer
       */


      constructor(module, type, size) {
        if (type === 'i32') this._stride = 4;else if (type === 'i64') this._stride = 8;else if (type === 'float') this._stride = 4;else if (type === 'double') this._stride = 8;else throw Error('Invalid buffer type');
        this._type = type;
        this._module = module;
        this._length = size;
        this._base = this._module._malloc(this._stride * size);
      }
      /**
       * Get value at index
       *
       * @param {number} index
       * @return {*}
       * @memberof WasmBuffer
       */


      get(index) {
        if (!this.type) return -1;
        return this._module.getValue(this._base + this._stride * index, this.type);
      }
      /**
       * Set value to index
       *
       * @param {number} index
       * @param {(number | bigint)} value
       * @return {*}
       * @memberof WasmBuffer
       */


      set(index, value) {
        if (!this.type) return;

        this._module.setValue(this._base + this._stride * index, value, this.type);
      }
      /**
       * Set array to buffer
       *
       * @param {(WasmArrayType | Array<number>)} array
       * @memberof WasmBuffer
       */


      setArray(array) {
        array.forEach((value, index) => this.set(index, value));
      }
      /**
       * Get array pointer
       *
       * @return {*}
       * @memberof WasmBuffer
       */


      getPointer() {
        return this._base;
      }
      /**
       * Release array buffer
       *
       * @memberof WasmBuffer
       */


      release() {
        this._module._free(this._base);
      }

    }

    var mainWasm = "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EEALIAIoArgCIgEEQCACIAE2ArwCIAEQQAsgAkEANgIQIAJCADcDCCACKALMAiACKALIAiIEayIBBEAgAUEASA0DIAIgARArIgM2AgggAiADNgIMIAIgAyABQQZ1QQZ0ajYCECACIAMgBCABEEggAWo2AgwLIAJBADYCHCACQgA3AhQgAigC2AIgAigC1AIiCWsiAUHIAG0hBCABBEAgBEHk8bgcTw0EIAIgARArIgM2AhQgAiADNgIYIAIgAyAEQcgAbGo2AhwgAiABQQBKBH8gAyAJIAEQSCABQcgAbkHIAGxqBSADCzYCGAsgAkEgaiAKQYABEEghCiACQaABaiAAQYABEEgaIAIgBTYCoAICQEH07AAoAgAiAUH47AAoAgBHBEAgAUEANgIIIAFCADcCACACKAIMIAIoAghrIgQEQCAEQQBIDQcgASAEECsiAzYCACABIAM2AgQgASADIARBBnVBBnRqNgIIIAEgAigCDCACKAIIIgBrIgRBAEoEfyADIAAgBBBIIARqBSADCzYCBAsgAUIANwIMIAFBADYCFCACKAIYIAIoAhRrIgNByABtIQQgAwRAIARB5PG4HE8NCCABIAMQKyIDNgIMIAEgAzYCECABIAMgBEHIAGxqNgIUIAEgAigCGCACKAIUIgBrIgRBAEoEfyADIAAgBBBIIARByABuQcgAbGoFIAMLNgIQCyABQRhqIApBhAIQSBpB9OwAIAFBoAJqNgIADAELIAJBCGohBAJAAkACQEH07AAoAgBB8OwAKAIAIgBrQaACbSIDQQFqIgFBuZyOB0kEQCABQfjsACgCACAAa0GgAm0iAEEBdCIKIAEgCksbQbicjgcgAEGcjscDSRsiAQR/IAFBuZyOB08NAiABQaACbBArBUEACyIKIANBoAJsaiIAQQA2AgggAEIANwIAAkACQAJAIAQiAygCBCADKAIAayIJBEAgCUEASA0BIAAgCRArIgU2AgAgACAFNgIEIAAgBSAJQQZ1QQZ0ajYCCCAAIAMoAgQgAygCACIMayIJQQBKBH8gBSAMIAkQSCAJagUgBQs2AgQLIABCADcCDCAAQQA2AhQgAygCECADKAIMayIFQcgAbSEJIAUEQCAJQeTxuBxPDQIgACAFECsiBTYCDCAAIAU2AhAgACAFIAlByABsajYCFCAAIAMoAhAgAygCDCIJ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AQsgBiAISgRAIAcPCyADKwMIIgQgAisDCCIFYw0AIAQgBWQEQCAHDwsgAygCECACKAIQSA0AIAcPCyACIAY2AgAgAyAINgIAIAIgBDkDCCADIAU5AwggAigCECEGIAIgAygCEDYCECADIAY2AhACQAJAIAIoAgAiBiABKAIAIghIBEAgAisDCCEEIAErAwghBQwBCyAHQQFqIQMgBiAISg0BIAIrAwgiBCABKwMIIgVjDQAgBCAFZA0BIAIoAhAgASgCEE4NAQsgASAGNgIAIAIgCDYCACABIAQ5AwggAiAFOQMIIAEoAhAhAyABIAIoAhA2AhAgAiADNgIQAkAgASgCACICIAAoAgAiBkgEQCABKwMIIQQgACsDCCEFDAELIAdBAmohAyACIAZKDQEgASsDCCIEIAArAwgiBWMNACAEIAVkDQEgASgCECAAKAIQTg0BCyAAIAI2AgAgASAGNgIAIAAgBDkDCCABIAU5AwggACgCECECIAAgASgCEDYCECABIAI2AhAgB0EDaiEDCyADC9IEAgJ8A38gACABIAIgAxAZIQgCQCAEKAIAIgcgAygCACIJSARAIAQrAwghBSADKwMIIQYMAQsgByAJSgRAIAgPCyAEKwMIIgUgAysDCCIGYw0AIAUgBmQEQCAIDwsgBCgCECADKAIQSA0AIAgPCyADIAc2AgAgBCAJNgIAIAMgBTkDCCAEIAY5AwggAygCECEHIAMgBCgCEDYCECAEIAc2AhACQAJAIAMoAgAiByACKAIAIglIBEAgAysDCCEFIAIrAwghBgwBCyAIQQFqIQQgByAJSg0BIAMrAwgiBSACKwMIIgZjDQAgBSAGZA0BIAMoAhAgAigCEE4NAQsgAiAHNgIAIAMgCTYCACACIAU5AwggAyAGOQMIIAIoAhAhBCACIAMoAhA2AhAgAyAENgIQAkAgAigCACIDIAEoAgAiB0gEQCACKwMIIQUgASsDCCEGDAELIAhBAmohBCADIAdKDQEgAisDCCIFIAErAwgiBmMNACAFIAZkDQEgAigCECABKAIQTg0BCyABIAM2AgAgAiAHNgIAIAEgBTkDCCACIAY5AwggASgCECEDIAEgAigCEDYCECACIAM2AhACQCABKAIAIgMgACgCACICSARAIAErAwghBSAAKwMIIQYMAQsgCEEDaiEEIAIgA0gNASAB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IiAGIQEgAyEADAULIAQgCCIFRg0BA38gBCIAQQhqIQQgAyAAECNFDQADQCADIAVBCGsiBRAjDQALIAAgBU8Ef0EEBSAAIAUQJAwBCwsLIQUgACEDIAVBAmsOAwIAAQALCwsLCw0AIAArAwAgASsDAGMLNQEBfyMAQRBrIgIkACACIAArAwA5AwggACABKwMAOQMAIAEgAkEIaisDADkDACACQRBqJAALUQEBfyAAIAEgAhAnIQQgAyACECMEfyACIAMQJCACIAEQI0UEQCAEQQFqDwsgASACECQgASAAECNFBEAgBEECag8LIAAgARAkIARBA2oFIAQLC2kBAX8gACABIAIgAxAlIQUgBCADECMEfyADIAQQJCADIAIQI0UEQCAFQQFqDwsgAiADECQgAiABECNFBEAgBUECag8LIAEgAhAkIAEgABAjRQRAIAVBA2oPCyAAIAEQJCAFQQRqBSAFCwtqAQJ/IAEgABAjIQQgAiABECMhAwJ/AkAgBEUEQEEAIANFDQIaIAEgAhAkQQEgASAAECNFDQIaIAAgARAkDAELIAMEQCAAIAIQJEEBDwsgACABECRBASACIAEQI0UNARogASACECQLQQILC7ECAQZ/IwBBEGsiBCQAQQEhBgJAAkACQAJAAkACQCABIABrQQN1DgYFBQABAgMECyABQQhrIgIgABAjRQ0EIAAgAhAkDAQLIAAgAEEIaiABQQhrECcaDAMLIAAgAEEIaiAAQRBqIAFBCGsQJRoMAgsgACAAQQhqIABBEGogAEEYaiABQQhrECYaDAELIAAgAEEIaiAAQRBqIgUQJxogAEEYaiEDA0AgASADRg0BAkAgAyAFECMEQCAEIAMrAwA5AwggAyECA0ACQCACIAUiAisDADkDACAAIAJGBEAgACECDAELIARBCGogAkEIayIFECMNAQsLIAIgBEEIaisDADkDACAHQQFqIgdBCEYNAQsgAyEFIANBCGohAwwBCwsgA0EIaiABRiEGCyAEQRBqJAAgBgsEACAACwgAQZgIEA0ACzMBAX8gAEEBIAAbIQECQANAIAEQPyIADQFBqO0AKAIAIgAEQCAAEQgADAELCxADAAsgAAsGACAAEEALBQBB4QgLOQECfyAAQfQiNgIAIABBBGooAgBBDGsiAkEIaiIBIAEoAgBBAWsiATYCACABQQBIBEAg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QQAgACABTRsNACAAPwBBEHRLBEAgABAERQ0BC0GI1wAgADYCACABDwtBrO0AQTA2AgBBfwuoAQACQCABQYAITgRAIABEAAAAAAAA4H+iIQAgAUH/D0kEQCABQf8HayEBDAILIABEAAAAAAAA4H+iIQAgAUH9FyABQf0XSRtB/g9rIQEMAQsgAUGBeEoNACAARAAAAAAAAGADoiEAIAFBuHBLBEAgAUHJB2ohAQwBCyAARAAAAAAAAGADoiEAIAFB8GggAUHwaEsbQZIPaiEBCyAAIAFB/wdqrUI0hr+iCx4BAX8jAEEQayICIAGaIAEgABs5AwggAisDCCABogsPACAARAAAAAAAAABwEEMLDwAgAEQAAAAAAAAAEBBDC90KAwl8A34GfyMAQRBrIhEkAAJAAkAgAb0iDEI0iKciEkH/D3EiE0G+CGsiDkH/fksgAL0iC0I0iKciD0H/D2tBgnBPcQ0AIAxCAYYiDUIBfUL/////////b1oEQEQAAAAAAADwPyECIA1QDQIgC0KAgICAgICA+D9RDQIgDUKBgICAgICAcFQgC0IBhiILQoCAgICAgIBwWHFFBEAgACABoCECDAMLIAtCgICAgICAgPD/AFENAkQAAAAAAAAAACABIAGiIAxCP4hQIAtCgICAgICAgPD/AFRGGyECDAILIAtCAYZCAX1C/////////29aBEAgACAAoiECIAtCAFMEQCACmiACIAwQR0EBRhshAgsgDEIAWQ0CIBFEAAAAAAAA8D8gAqM5AwggESsDCCECDAILIAtCAFMEQCAMEEciEEUEQCAAIAChIgAgAKMhAgwDCyAPQf8PcSEPIBBBAUZBEnQhECALQv///////////wCDIQsLIA5B/35NBEBEAAAAAAAA8D8hAiALQoCAgICAgID4P1ENAiATQb0HTQRAIAEgAZogC0KAgICAgICA+D9WG0QAAAAAAADwP6AhAgwDCyASQYAQSSALQoGAgICAgID4P1RHBEBBABBEIQIMAwtBABBFIQIMAgsgDw0AIABEAAAAAAAAMEOivUL///////////8Ag0KAgICAgICAoAN9IQsLAkAgDEKAgIBAg78iBiALIAtCgICAgNCqpfM/fSIMQoCAgICAgIB4g30iC0KAgICACHxCgICAgHCDvyICIAxCLYinQf8AcUEFdCIOQYg3aisD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";

    /* eslint-disable prefer-rest-params */
    const WasmModuleGenerator = (workerGlobalScope = null) => {
      const Module = {};
      let arguments_ = [];
      let thisProgram = "./this.program";

      let quit_ = function (status, toThrow) {
        throw toThrow;
      };

      const ENVIRONMENT_IS_WEB = typeof window === "object";
      const ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
      const ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
      let scriptDirectory = "";

      function locateFile(path) {
        if (Module.locateFile) {
          return Module.locateFile(path, scriptDirectory);
        }

        return scriptDirectory + path;
      }

      let read_;
      let readAsync;
      let readBinary;

      function logExceptionOnExit(e) {
        if (e instanceof ExitStatus) return;
        const toLog = e;
        err(`exiting due to exception: ${toLog}`);
      }

      let nodeFS;
      let nodePath;

      if (ENVIRONMENT_IS_NODE) {
        if (ENVIRONMENT_IS_WORKER) {
          scriptDirectory = `${require("path").dirname(scriptDirectory)}/`;
        } else {
          scriptDirectory = `${__dirname}/`;
        }

        read_ = function shell_read(filename, binary) {
          if (!nodeFS) nodeFS = require("fs");
          if (!nodePath) nodePath = require("path");
          filename = nodePath.normalize(filename);
          return nodeFS.readFileSync(filename, binary ? null : "utf8");
        };

        readBinary = function readBinary(filename) {
          let ret = read_(filename, true);

          if (!ret.buffer) {
            ret = new Uint8Array(ret);
          }

          assert(ret.buffer);
          return ret;
        };

        readAsync = function readAsync(filename, onload, onerror) {
          if (!nodeFS) nodeFS = require("fs");
          if (!nodePath) nodePath = require("path");
          filename = nodePath.normalize(filename);
          nodeFS.readFile(filename, (err, data) => {
            if (err) onerror(err);else onload(data.buffer);
          });
        };

        if (process.argv.length > 1) {
          thisProgram = process.argv[1].replace(/\\/g, "/");
        }

        arguments_ = process.argv.slice(2);

        if (typeof module !== "undefined") {
          module.exports = Module;
        }

        process.on("uncaughtException", ex => {
          if (!(ex instanceof ExitStatus)) {
            throw ex;
          }
        });
        process.on("unhandledRejection", reason => {
          throw reason;
        });

        quit_ = function (status, toThrow) {
          if (keepRuntimeAlive()) {
            process.exitCode = status;
            throw toThrow;
          }

          logExceptionOnExit(toThrow);
          process.exit(status);
        };

        Module.inspect = function () {
          return "[Emscripten Module object]";
        };
      } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        if (ENVIRONMENT_IS_WORKER) {
          // eslint-disable-next-line no-restricted-globals
          scriptDirectory = self.location.href;
        } else if (typeof document !== "undefined" && document.currentScript) {
          scriptDirectory = document.currentScript.src;
        }

        if (scriptDirectory.indexOf("blob:") !== 0) {
          scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
        } else {
          scriptDirectory = "";
        }

        read_ = function (url) {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.send(null);
          return xhr.responseText;
        };

        if (ENVIRONMENT_IS_WORKER) {
          readBinary = function (url) {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response);
          };
        }

        readAsync = function (url, onload, onerror) {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";

          xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0 && xhr.response) {
              onload(xhr.response);
              return;
            }

            onerror();
          };

          xhr.onerror = onerror;
          xhr.send(null);
        };
      }

      const out = Module.print || console.log.bind(console);
      const err = Module.printErr || console.warn.bind(console);
      if (Module.arguments) arguments_ = Module.arguments;
      if (Module.thisProgram) thisProgram = Module.thisProgram;
      if (Module.quit) quit_ = Module.quit;

      function base64ToArrayBuffer(base64) {
        let binary_string = '';

        if (ENVIRONMENT_IS_NODE) {
          binary_string = Buffer.from(base64, 'base64').toString('ascii');
        } else if (ENVIRONMENT_IS_WORKER) {
          binary_string = workerGlobalScope.atob(base64);
        } else {
          binary_string = window.atob(base64);
        }

        const len = binary_string.length;
        const bytes = new Uint8Array(len);

        for (let i = 0; i < len; i++) {
          bytes[i] = binary_string.charCodeAt(i);
        }

        return bytes.buffer;
      }

      const wasmBinary = base64ToArrayBuffer(mainWasm);
      const noExitRuntime = Module.noExitRuntime || true;

      if (typeof WebAssembly !== "object") {
        abort("no native wasm support detected");
      }

      function setValue(ptr, value, type) {
        type = type || "i8";
        if (type.charAt(type.length - 1) === "*") type = "i32";

        switch (type) {
          case "i1":
            HEAP8[ptr >> 0] = value;
            break;

          case "i8":
            HEAP8[ptr >> 0] = value;
            break;

          case "i16":
            HEAP16[ptr >> 1] = value;
            break;

          case "i32":
            HEAP32[ptr >> 2] = value;
            break;

          case "i64":
            tempI64 = [value >>> 0, (tempDouble = value, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)];
            HEAP32[ptr >> 2] = tempI64[0];
            HEAP32[ptr + 4 >> 2] = tempI64[1];
            break;

          case "float":
            HEAPF32[ptr >> 2] = value;
            break;

          case "double":
            HEAPF64[ptr >> 3] = value;
            break;

          default:
            abort(`invalid type for setValue: ${type}`);
        }
      }

      function getValue(ptr, type) {
        type = type || "i8";
        if (type.charAt(type.length - 1) === "*") type = "i32";

        switch (type) {
          case "i1":
            return HEAP8[ptr >> 0];

          case "i8":
            return HEAP8[ptr >> 0];

          case "i16":
            return HEAP16[ptr >> 1];

          case "i32":
            return HEAP32[ptr >> 2];

          case "i64":
            return HEAP32[ptr >> 2];

          case "float":
            return HEAPF32[ptr >> 2];

          case "double":
            return Number(HEAPF64[ptr >> 3]);

          default:
            abort(`invalid type for getValue: ${type}`);
        }

        return null;
      }

      let wasmMemory;
      let ABORT = false;
      let EXITSTATUS;

      function assert(condition, text) {
        if (!condition) {
          abort(`Assertion failed: ${text}`);
        }
      }

      function getCFunc(ident) {
        const func = Module[`_${ident}`];
        assert(func, `Cannot call unknown function ${ident}, make sure it is exported`);
        return func;
      }

      function ccall(ident, returnType, argTypes, args) {
        const toC = {
          "string": function (str) {
            let ret = 0;

            if (str !== null && str !== undefined && str !== 0) {
              const len = (str.length << 2) + 1;
              ret = stackAlloc(len);
              stringToUTF8(str, ret, len);
            }

            return ret;
          },
          "array": function (arr) {
            const ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret;
          }
        };

        function convertReturnValue(ret) {
          if (returnType === "string") return UTF8ToString(ret);
          if (returnType === "boolean") return Boolean(ret);
          return ret;
        }

        const func = getCFunc(ident);
        const cArgs = [];
        let stack = 0;

        if (args) {
          for (let i = 0; i < args.length; i++) {
            const converter = toC[argTypes[i]];

            if (converter) {
              if (stack === 0) stack = stackSave();
              cArgs[i] = converter(args[i]);
            } else {
              cArgs[i] = args[i];
            }
          }
        }

        let ret = func(...cArgs);

        function onDone(ret) {
          if (stack !== 0) stackRestore(stack);
          return convertReturnValue(ret);
        }

        ret = onDone(ret);
        return ret;
      }

      const UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

      function UTF8ArrayToString(heap, idx, maxBytesToRead) {
        const endIdx = idx + maxBytesToRead;
        let endPtr = idx;

        while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

        if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
          return UTF8Decoder.decode(heap.subarray(idx, endPtr));
        }

        let str = "";

        while (idx < endPtr) {
          let u0 = heap[idx++];

          if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
          }

          const u1 = heap[idx++] & 63;

          if ((u0 & 224) === 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
          }

          const u2 = heap[idx++] & 63;

          if ((u0 & 240) === 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
          } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63;
          }

          if (u0 < 65536) {
            str += String.fromCharCode(u0);
          } else {
            const ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
          }
        }

        return str;
      }

      function UTF8ToString(ptr, maxBytesToRead) {
        return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
      }

      function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
        if (!(maxBytesToWrite > 0)) return 0;
        const startIdx = outIdx;
        const endIdx = outIdx + maxBytesToWrite - 1;

        for (let i = 0; i < str.length; ++i) {
          let u = str.charCodeAt(i);

          if (u >= 55296 && u <= 57343) {
            const u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023;
          }

          if (u <= 127) {
            if (outIdx >= endIdx) break;
            heap[outIdx++] = u;
          } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63;
          } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63;
          } else {
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63;
          }
        }

        heap[outIdx] = 0;
        return outIdx - startIdx;
      }

      function stringToUTF8(str, outPtr, maxBytesToWrite) {
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
      }

      function lengthBytesUTF8(str) {
        let len = 0;

        for (let i = 0; i < str.length; ++i) {
          let u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
          if (u <= 127) ++len;else if (u <= 2047) len += 2;else if (u <= 65535) len += 3;else len += 4;
        }

        return len;
      }

      function allocateUTF8OnStack(str) {
        const size = lengthBytesUTF8(str) + 1;
        const ret = stackAlloc(size);
        stringToUTF8Array(str, HEAP8, ret, size);
        return ret;
      }

      function writeArrayToMemory(array, buffer) {
        HEAP8.set(array, buffer);
      }

      function alignUp(x, multiple) {
        if (x % multiple > 0) {
          x += multiple - x % multiple;
        }

        return x;
      }

      let buffer;
      let HEAP8;
      let HEAPU8;
      let HEAP16;
      let HEAP32;
      let HEAPF32;
      let HEAPF64;

      function updateGlobalBufferAndViews(buf) {
        buffer = buf;
        Module.HEAP8 = HEAP8 = new Int8Array(buf);
        Module.HEAP16 = HEAP16 = new Int16Array(buf);
        Module.HEAP32 = HEAP32 = new Int32Array(buf);
        Module.HEAPU8 = HEAPU8 = new Uint8Array(buf); // eslint-disable-next-line @typescript-eslint/no-unused-vars

        Module.HEAPU16 = new Uint16Array(buf); // eslint-disable-next-line @typescript-eslint/no-unused-vars

        Module.HEAPU32 = new Uint32Array(buf);
        Module.HEAPF32 = HEAPF32 = new Float32Array(buf);
        Module.HEAPF64 = HEAPF64 = new Float64Array(buf);
      }

      let wasmTable;
      const __ATPRERUN__ = [];
      const __ATINIT__ = [];
      const __ATMAIN__ = [];
      const __ATPOSTRUN__ = [];
      const runtimeKeepaliveCounter = 0;

      function keepRuntimeAlive() {
        return noExitRuntime || runtimeKeepaliveCounter > 0;
      }

      function preRun() {
        if (Module.preRun) {
          if (typeof Module.preRun === "function") Module.preRun = [Module.preRun];

          while (Module.preRun.length) {
            addOnPreRun(Module.preRun.shift());
          }
        }

        callRuntimeCallbacks(__ATPRERUN__);
      }

      function initRuntime() {
        callRuntimeCallbacks(__ATINIT__);
      }

      function preMain() {
        callRuntimeCallbacks(__ATMAIN__);
      }

      function postRun() {
        if (Module.postRun) {
          if (typeof Module.postRun === "function") Module.postRun = [Module.postRun];

          while (Module.postRun.length) {
            addOnPostRun(Module.postRun.shift());
          }
        }

        callRuntimeCallbacks(__ATPOSTRUN__);
      }

      function addOnPreRun(cb) {
        __ATPRERUN__.unshift(cb);
      }

      function addOnInit(cb) {
        __ATINIT__.unshift(cb);
      }

      function addOnPostRun(cb) {
        __ATPOSTRUN__.unshift(cb);
      }

      let runDependencies = 0;
      let dependenciesFulfilled = null;

      function addRunDependency() {
        runDependencies++;

        if (Module.monitorRunDependencies) {
          Module.monitorRunDependencies(runDependencies);
        }
      }

      function removeRunDependency() {
        runDependencies--;

        if (Module.monitorRunDependencies) {
          Module.monitorRunDependencies(runDependencies);
        }

        if (runDependencies === 0) {

          if (dependenciesFulfilled) {
            const callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback();
          }
        }
      }

      Module.preloadedImages = {};
      Module.preloadedAudios = {};

      function abort(what) {
        if (Module.onAbort) {
          Module.onAbort(what);
        }

        what = `Aborted(${what})`;
        err(what);
        ABORT = true;
        EXITSTATUS = 1;
        what += ". Build with -s ASSERTIONS=1 for more info.";
        const e = new WebAssembly.RuntimeError(what);
        throw e;
      }

      const dataURIPrefix = "data:application/octet-stream;base64,";

      function isDataURI(filename) {
        return filename.startsWith(dataURIPrefix);
      }

      function isFileURI(filename) {
        return filename.startsWith("file://");
      }

      let wasmBinaryFile;
      wasmBinaryFile = mainWasm;

      if (!isDataURI(wasmBinaryFile)) {
        wasmBinaryFile = locateFile(wasmBinaryFile);
      }

      function getBinary(file) {
        try {
          if (file === wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
          }

          if (readBinary) {
            return readBinary(file);
          }

          throw new Error("both async and sync fetching of the wasm failed");
        } catch (err) {
          abort(err);
          return null;
        }
      }

      function getBinaryPromise() {
        if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
          if (typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
            return fetch(wasmBinaryFile, {
              credentials: "same-origin"
            }).then(response => {
              if (!response.ok) {
                throw new Error(`failed to load wasm binary file at '${wasmBinaryFile}'`);
              }

              return response.arrayBuffer();
            }).catch(() => getBinary(wasmBinaryFile));
          }

          if (readAsync) {
            return new Promise((resolve, reject) => {
              readAsync(wasmBinaryFile, response => {
                resolve(new Uint8Array(response));
              }, reject);
            });
          }
        }

        return Promise.resolve().then(() => getBinary(wasmBinaryFile));
      }

      function createWasm() {
        const info = {
          "env": asmLibraryArg,
          "wasi_snapshot_preview1": asmLibraryArg
        };

        function receiveInstance(instance) {
          const {
            exports
          } = instance;
          Module.asm = exports;
          wasmMemory = Module.asm.memory;
          updateGlobalBufferAndViews(wasmMemory.buffer);
          wasmTable = Module.asm.__indirect_function_table;
          addOnInit(Module.asm.__wasm_call_ctors);
          removeRunDependency();
        }

        addRunDependency();

        function receiveInstantiationResult(result) {
          receiveInstance(result.instance);
        }

        function instantiateArrayBuffer(receiver) {
          return getBinaryPromise().then(binary => WebAssembly.instantiate(binary, info)).then(instance => instance).then(receiver, reason => {
            err(`failed to asynchronously prepare wasm: ${reason}`);
            abort(reason);
          });
        }

        function instantiateAsync() {
          if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
            return fetch(wasmBinaryFile, {
              credentials: "same-origin"
            }).then(response => {
              const result = WebAssembly.instantiateStreaming(response, info);
              return result.then(receiveInstantiationResult, reason => {
                err(`wasm streaming compile failed: ${reason}`);
                err("falling back to ArrayBuffer instantiation");
                return instantiateArrayBuffer(receiveInstantiationResult);
              });
            });
          }

          return instantiateArrayBuffer(receiveInstantiationResult);
        }

        if (Module.instantiateWasm) {
          try {
            const exports = Module.instantiateWasm(info, receiveInstance);
            return exports;
          } catch (e) {
            err(`Module.instantiateWasm callback failed with error: ${e}`);
            return false;
          }
        }

        instantiateAsync();
        return {};
      }

      let tempDouble;
      let tempI64;

      function callRuntimeCallbacks(callbacks) {
        while (callbacks.length > 0) {
          const callback = callbacks.shift();

          if (typeof callback === "function") {
            callback(Module);
            continue;
          }

          const {
            func
          } = callback;

          if (typeof func === "number") {
            if (callback.arg === undefined) {
              getWasmTableEntry(func)();
            } else {
              getWasmTableEntry(func)(callback.arg);
            }
          } else {
            func(callback.arg === undefined ? null : callback.arg);
          }
        }
      }

      const wasmTableMirror = [];

      function getWasmTableEntry(funcPtr) {
        let func = wasmTableMirror[funcPtr];

        if (!func) {
          if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
          wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
        }

        return func;
      }

      function handleException(e) {
        if (e instanceof ExitStatus || e === "unwind") {
          return EXITSTATUS;
        }

        quit_(1, e);
      }

      function ___assert_fail(condition, filename, line, func) {
        abort(`Assertion failed: ${UTF8ToString(condition)}, at: ${[filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"]}`);
      }

      function ___cxa_allocate_exception(size) {
        return _malloc(size + 16) + 16;
      }

      function _atexit() {}

      function ___cxa_atexit(a0, a1) {
        return _atexit();
      }

      function ExceptionInfo(excPtr) {
        this.excPtr = excPtr;
        this.ptr = excPtr - 16;

        this.set_type = function (type) {
          HEAP32[this.ptr + 4 >> 2] = type;
        };

        this.get_type = function () {
          return HEAP32[this.ptr + 4 >> 2];
        };

        this.set_destructor = function (destructor) {
          HEAP32[this.ptr + 8 >> 2] = destructor;
        };

        this.get_destructor = function () {
          return HEAP32[this.ptr + 8 >> 2];
        };

        this.set_refcount = function (refcount) {
          HEAP32[this.ptr >> 2] = refcount;
        };

        this.set_caught = function (caught) {
          caught = caught ? 1 : 0;
          HEAP8[this.ptr + 12 >> 0] = caught;
        };

        this.get_caught = function () {
          return HEAP8[this.ptr + 12 >> 0] !== 0;
        };

        this.set_rethrown = function (rethrown) {
          rethrown = rethrown ? 1 : 0;
          HEAP8[this.ptr + 13 >> 0] = rethrown;
        };

        this.get_rethrown = function () {
          return HEAP8[this.ptr + 13 >> 0] !== 0;
        };

        this.init = function (type, destructor) {
          this.set_type(type);
          this.set_destructor(destructor);
          this.set_refcount(0);
          this.set_caught(false);
          this.set_rethrown(false);
        };

        this.add_ref = function () {
          const value = HEAP32[this.ptr >> 2];
          HEAP32[this.ptr >> 2] = value + 1;
        };

        this.release_ref = function () {
          const prev = HEAP32[this.ptr >> 2];
          HEAP32[this.ptr >> 2] = prev - 1;
          return prev === 1;
        };
      }

      function ___cxa_throw(ptr, type, destructor) {
        const info = new ExceptionInfo(ptr);
        info.init(type, destructor);
        throw ptr;
      }

      function _abort() {
        abort("");
      }

      function _emscripten_memcpy_big(dest, src, num) {
        HEAPU8.copyWithin(dest, src, src + num);
      }

      function emscripten_realloc_buffer(size) {
        try {
          wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
          updateGlobalBufferAndViews(wasmMemory.buffer);
          return 1; // eslint-disable-next-line no-empty
        } catch (e) {}
      }

      function _emscripten_resize_heap(requestedSize) {
        const oldSize = HEAPU8.length;
        requestedSize >>>= 0;
        const maxHeapSize = 2147483648;

        if (requestedSize > maxHeapSize) {
          return false;
        }

        for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
          let overGrownHeapSize = oldSize * (1 + .2 / cutDown);
          overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
          const newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
          const replacement = emscripten_realloc_buffer(newSize);

          if (replacement) {
            return true;
          }
        }

        return false;
      }

      const SYSCALLS = {
        mappings: {},
        buffers: [null, [], []],

        printChar(stream, curr) {
          const buffer = SYSCALLS.buffers[stream];

          if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        },

        varargs: undefined,

        get() {
          SYSCALLS.varargs += 4;
          const ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
          return ret;
        },

        getStr(ptr) {
          const ret = UTF8ToString(ptr);
          return ret;
        },

        get64(low) {
          return low;
        }

      };

      function _fd_write(fd, iov, iovcnt, pnum) {
        let num = 0;

        for (let i = 0; i < iovcnt; i++) {
          const ptr = HEAP32[iov >> 2];
          const len = HEAP32[iov + 4 >> 2];
          iov += 8;

          for (let j = 0; j < len; j++) {
            SYSCALLS.printChar(fd, HEAPU8[ptr + j]);
          }

          num += len;
        }

        HEAP32[pnum >> 2] = num;
        return 0;
      } // eslint-disable-next-line @typescript-eslint/no-unused-vars


      function _setTempRet0(val) {// setTempRet0(val)
      }

      const asmLibraryArg = {
        "__assert_fail": ___assert_fail,
        "__cxa_allocate_exception": ___cxa_allocate_exception,
        "__cxa_atexit": ___cxa_atexit,
        "__cxa_throw": ___cxa_throw,
        "abort": _abort,
        "emscripten_memcpy_big": _emscripten_memcpy_big,
        "emscripten_resize_heap": _emscripten_resize_heap,
        "fd_write": _fd_write,
        "setTempRet0": _setTempRet0
      };
      createWasm();

      Module.___wasm_call_ctors = function () {
        return (Module.___wasm_call_ctors = Module.asm.__wasm_call_ctors).apply(null, arguments);
      };

      Module._main = function () {
        return (Module._main = Module.asm.main).apply(null, arguments);
      };

      Module._createTexture = function () {
        return (Module._createTexture = Module.asm.createTexture).apply(null, arguments);
      };

      Module._createBounding = function () {
        return (Module._createBounding = Module.asm.createBounding).apply(null, arguments);
      };

      Module._setCamera = function () {
        return (Module._setCamera = Module.asm.setCamera).apply(null, arguments);
      };

      Module._readStream = function () {
        return (Module._readStream = Module.asm.readStream).apply(null, arguments);
      };

      Module._pathTracer = function () {
        return (Module._pathTracer = Module.asm.pathTracer).apply(null, arguments);
      };

      Module.___errno_location = function () {
        return (Module.___errno_location = Module.asm.__errno_location).apply(null, arguments);
      };

      let stackSave = Module.stackSave = function () {
        return (stackSave = Module.stackSave = Module.asm.stackSave).apply(null, arguments);
      };

      let stackRestore = Module.stackRestore = function () {
        return (stackRestore = Module.stackRestore = Module.asm.stackRestore).apply(null, arguments);
      };

      let stackAlloc = Module.stackAlloc = function () {
        return (stackAlloc = Module.stackAlloc = Module.asm.stackAlloc).apply(null, arguments);
      };

      let _malloc = Module._malloc = function () {
        return (_malloc = Module._malloc = Module.asm.malloc).apply(null, arguments);
      };

      Module._free = function () {
        return (Module._free = Module.asm.free).apply(null, arguments);
      };

      Module.dynCall_jiji = function () {
        return (Module.dynCall_jiji = Module.asm.dynCall_jiji).apply(null, arguments);
      };

      Module.ccall = ccall;
      Module.setValue = setValue;
      Module.getValue = getValue;
      let calledRun;

      function ExitStatus(status) {
        this.name = "ExitStatus";
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }

      dependenciesFulfilled = function runCaller() {
        if (!calledRun) run();
        if (!calledRun) dependenciesFulfilled = runCaller;
      };

      function callMain(args) {
        const entryFunction = Module._main;
        args = args || [];
        const argc = args.length + 1;
        const argv = stackAlloc((argc + 1) * 4);
        HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);

        for (let i = 1; i < argc; i++) {
          HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
        }

        HEAP32[(argv >> 2) + argc] = 0;

        try {
          const ret = entryFunction(argc, argv);
          exit(ret, true);
          return ret;
        } catch (e) {
          return handleException(e);
        } finally {
        }
      }

      function run(args) {
        args = args || arguments_;

        if (runDependencies > 0) {
          return;
        }

        preRun();

        if (runDependencies > 0) {
          return;
        }

        function doRun() {
          if (calledRun) return;
          calledRun = true;
          Module.calledRun = true;
          if (ABORT) return;
          initRuntime();
          preMain();
          if (Module.onRuntimeInitialized) Module.onRuntimeInitialized();
          if (shouldRunNow) callMain(args);
          postRun();
        }

        if (Module.setStatus) {
          Module.setStatus("Running...");
          setTimeout(() => {
            setTimeout(() => {
              Module.setStatus("");
            }, 1);
            doRun();
          }, 1);
        } else {
          doRun();
        }
      }

      Module.run = run;

      function exit(status) {
        EXITSTATUS = status; // eslint-disable-next-line no-empty

        procExit(status);
      }

      function procExit(code) {
        EXITSTATUS = code;

        if (!keepRuntimeAlive()) {
          if (Module.onExit) Module.onExit(code);
          ABORT = true;
        }

        quit_(code, new ExitStatus(code));
      }

      if (Module.preInit) {
        if (typeof Module.preInit === "function") Module.preInit = [Module.preInit];

        while (Module.preInit.length > 0) {
          Module.preInit.pop()();
        }
      }

      let shouldRunNow = true;
      if (Module.noInitialRun) shouldRunNow = false;
      run();
      return Module;
    };

    /**
     * Wasm module wrapper
     *
     * @export
     * @class WasmManager
     */

    class WasmManager extends EventTarget {
      module;
      /**
       * Creates an instance of WasmManager.
       * @memberof WasmManager
       */

      constructor() {
        super();
        this.module = WasmModuleGenerator();

        this.module.onRuntimeInitialized = () => {
          this.dispatchEvent(new Event('initialized'));
        };
      }
      /**
       * Create array argment
       *
       * @param {WasmArrayType} array
       * @return {*}
       * @memberof WasmManager
       */


      createBuffer(type, size) {
        return new WasmBuffer(this.module, type, size);
      }
      /**
       * Call pathTracer function in wasm
       *
       * @param {(...(number | WasmBuffer)[])} args
       * @return {*}
       * @memberof WasmManager
       */


      callPathTracer(...args) {
        return this.callFunction('pathTracer', ...args);
      }

      callCreateBounding(...args) {
        return this.callFunction('createBounding', ...args);
      }

      callSetCamera(...args) {
        return this.callFunction('setCamera', ...args);
      }

      callReadStream(...args) {
        return this.callFunction('readStream', ...args);
      }

      callFunction(funcname, ...args) {
        const rawArgs = args.map(v => v instanceof WasmBuffer ? v.getPointer() : v);
        const argTypes = args.map(v => v instanceof WasmBuffer ? 'pointer' : 'number');
        return this.module.ccall(funcname, 'number', argTypes, rawArgs);
      }

    }

    class Vector2 {
      x;
      y;

      constructor(_x = 0, _y = 0) {
        this.x = _x;
        this.y = _y;
      }

      set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }

      length2() {
        return this.x ** 2.0 + this.y ** 2.0;
      }

      length() {
        return Math.sqrt(this.length2());
      }

      distance(a) {
        return Math.sqrt((this.x - a.x) ** 2 + (this.y - a.y) ** 2);
      }

      add(a) {
        if (a instanceof Vector2) return new Vector2(this.x + a.x, this.y + a.y);
        return new Vector2(this.x + a, this.y + a);
      }

      subtract(a) {
        if (a instanceof Vector2) return new Vector2(this.x - a.x, this.y - a.y);
        return new Vector2(this.x - a, this.y - a);
      }

      multiply(a) {
        if (a instanceof Vector2) return new Vector2(this.x * a.x, this.y * a.y);
        return new Vector2(this.x * a, this.y * a);
      }

      divide(a) {
        if (a instanceof Vector2) {
          console.assert(!(a.x === 0 || a.y === 0), 'cannot divide by zero');
          return new Vector2(this.x / a.x, this.y / a.y);
        }

        console.assert(a !== 0, 'cannot divide by zero');
        return new Vector2(this.x / a, this.y / a);
      }

      normalize() {
        return this.divide(this.length());
      }

      dot(a) {
        return this.x * a.x + this.y * a.y;
      }

      equal(a) {
        return this.x === a.x && this.y === a.y;
      }

      copy() {
        return new Vector2(this.x, this.y);
      }

      getArray() {
        return new Float32Array([this.x, this.y]);
      }

    }

    exports.Camera = Camera;
    exports.Diffuse = Diffuse;
    exports.GLTFLoader = GLTFLoader;
    exports.Glass = Glass;
    exports.MATERIAL_UNIFORM_LENGTH = MATERIAL_UNIFORM_LENGTH;
    exports.Material = Material;
    exports.Matrix4 = Matrix4;
    exports.Model = Model;
    exports.Quaternion = Quaternion;
    exports.Renderer = Renderer;
    exports.Texture = Texture;
    exports.Transform = Transform;
    exports.Vector2 = Vector2;
    exports.Vector3 = Vector3;
    exports.Vector4 = Vector4;
    exports.WasmBuffer = WasmBuffer;
    exports.WasmManager = WasmManager;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aHRyYWNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvcmVuZGVyZXIvUmVuZGVyZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IzLnRzIiwiLi4vLi4vc3JjL21hdGgvVmVjdG9yNC50cyIsIi4uLy4uL3NyYy9tYXRoL01hdHJpeDQudHMiLCIuLi8uLi9zcmMvbWF0aC9RdWF0ZXJuaW9uLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvVHJhbnNmb3JtLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTW9kZWwudHMiLCIuLi8uLi9zcmMvY29yZS9tb2RlbC9HTFRGTG9hZGVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvbWF0ZXJpYWwvTWF0ZXJpYWwudHMiLCIuLi8uLi9zcmMvY29yZS9tYXRlcmlhbC9HbGFzcy50cyIsIi4uLy4uL3NyYy9jb3JlL21hdGVyaWFsL0RpZmZ1c2UudHMiLCIuLi8uLi9zcmMvY29yZS9jYW1lcmEvQ2FtZXJhLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9UZXh0dXJlLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtQnVmZmVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTW9kdWxlLmpzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTWFuYWdlci50cyIsIi4uLy4uL3NyYy9tYXRoL1ZlY3RvcjIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsIi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1yZXN0LXBhcmFtcyAqL1xuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItc3ByZWFkICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1yZXR1cm4tYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBjb25zaXN0ZW50LXJldHVybiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tbXVsdGktYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb250aW51ZSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcGx1c3BsdXMgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLW5lc3RlZC10ZXJuYXJ5ICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItZGVzdHJ1Y3R1cmluZyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuLyogZXNsaW50LWRpc2FibGUgdmFycy1vbi10b3AgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1zaGFkb3cgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4vKiBlc2xpbnQtZGlzYWJsZSBnbG9iYWwtcmVxdWlyZSAqL1xuLyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5pbXBvcnQgbWFpbldhc20gZnJvbSAnLi4vLi4vLi4vYnVpbGQvd2FzbS9tYWluLndhc20nO1xuXG5leHBvcnQgLyoqXG4gKiBXYXNtIG1vZHVsZSBnZW5lcmF0b3IuIFRoaXMgY29kZSBpcyBiYXNlZCBvbiBFbXNjcmlwdGVuIGRlZmF1bHQganMgdGVtcGxhdGUuXG4gKlxuICogQHJldHVybiB7Kn0gXG4gKi9cbmNvbnN0IFdhc21Nb2R1bGVHZW5lcmF0b3IgPSAod29ya2VyR2xvYmFsU2NvcGUgPSBudWxsKSA9PiB7XG4gICAgY29uc3QgTW9kdWxlID0ge307XG4gICAgbGV0IGFyZ3VtZW50c18gPSBbXTtcbiAgICBsZXQgdGhpc1Byb2dyYW0gPSBcIi4vdGhpcy5wcm9ncmFtXCI7XG4gICAgbGV0IHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgIHRocm93IHRvVGhyb3dcbiAgICB9O1xuICAgIGNvbnN0IEVOVklST05NRU5UX0lTX1dFQiA9IHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCI7XG4gICAgY29uc3QgRU5WSVJPTk1FTlRfSVNfV09SS0VSID0gdHlwZW9mIGltcG9ydFNjcmlwdHMgPT09IFwiZnVuY3Rpb25cIjtcbiAgICBjb25zdCBFTlZJUk9OTUVOVF9JU19OT0RFID0gdHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMubm9kZSA9PT0gXCJzdHJpbmdcIjtcbiAgICBsZXQgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcblxuICAgIGZ1bmN0aW9uIGxvY2F0ZUZpbGUocGF0aCkge1xuICAgICAgICBpZiAoTW9kdWxlLmxvY2F0ZUZpbGUpIHtcbiAgICAgICAgICAgIHJldHVybiBNb2R1bGUubG9jYXRlRmlsZShwYXRoLCBzY3JpcHREaXJlY3RvcnkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNjcmlwdERpcmVjdG9yeSArIHBhdGhcbiAgICB9XG4gICAgbGV0IHJlYWRfOyBsZXQgcmVhZEFzeW5jOyBsZXQgcmVhZEJpbmFyeTtcblxuICAgIGZ1bmN0aW9uIGxvZ0V4Y2VwdGlvbk9uRXhpdChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXhpdFN0YXR1cykgcmV0dXJuO1xuICAgICAgICBjb25zdCB0b0xvZyA9IGU7XG4gICAgICAgIGVycihgZXhpdGluZyBkdWUgdG8gZXhjZXB0aW9uOiAkeyAgdG9Mb2d9YClcbiAgICB9XG4gICAgbGV0IG5vZGVGUztcbiAgICBsZXQgbm9kZVBhdGg7XG4gICAgaWYgKEVOVklST05NRU5UX0lTX05PREUpIHtcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gYCR7cmVxdWlyZShcInBhdGhcIikuZGlybmFtZShzY3JpcHREaXJlY3RvcnkpICB9L2BcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IGAke19fZGlybmFtZSAgfS9gXG4gICAgICAgIH1cbiAgICAgICAgcmVhZF8gPSBmdW5jdGlvbiBzaGVsbF9yZWFkKGZpbGVuYW1lLCBiaW5hcnkpIHtcbiAgICAgICAgICAgIGlmICghbm9kZUZTKSBub2RlRlMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICBpZiAoIW5vZGVQYXRoKSBub2RlUGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xuICAgICAgICAgICAgZmlsZW5hbWUgPSBub2RlUGF0aC5ub3JtYWxpemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIG5vZGVGUy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUsIGJpbmFyeSA/IG51bGwgOiBcInV0ZjhcIilcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZEJpbmFyeSA9IGZ1bmN0aW9uIHJlYWRCaW5hcnkoZmlsZW5hbWUpIHtcbiAgICAgICAgICAgIGxldCByZXQgPSByZWFkXyhmaWxlbmFtZSwgdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoIXJldC5idWZmZXIpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBuZXcgVWludDhBcnJheShyZXQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhc3NlcnQocmV0LmJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRBc3luYyA9IGZ1bmN0aW9uIHJlYWRBc3luYyhmaWxlbmFtZSwgb25sb2FkLCBvbmVycm9yKSB7XG4gICAgICAgICAgICBpZiAoIW5vZGVGUykgbm9kZUZTID0gcmVxdWlyZShcImZzXCIpO1xuICAgICAgICAgICAgaWYgKCFub2RlUGF0aCkgbm9kZVBhdGggPSByZXF1aXJlKFwicGF0aFwiKTtcbiAgICAgICAgICAgIGZpbGVuYW1lID0gbm9kZVBhdGgubm9ybWFsaXplKGZpbGVuYW1lKTtcbiAgICAgICAgICAgIG5vZGVGUy5yZWFkRmlsZShmaWxlbmFtZSwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIG9uZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIG9ubG9hZChkYXRhLmJ1ZmZlcilcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH07XG4gICAgICAgIGlmIChwcm9jZXNzLmFyZ3YubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhpc1Byb2dyYW0gPSBwcm9jZXNzLmFyZ3ZbMV0ucmVwbGFjZSgvXFxcXC9nLCBcIi9cIilcbiAgICAgICAgfVxuICAgICAgICBhcmd1bWVudHNfID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBNb2R1bGVcbiAgICAgICAgfVxuICAgICAgICBwcm9jZXNzLm9uKFwidW5jYXVnaHRFeGNlcHRpb25cIiwgKGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoIShleCBpbnN0YW5jZW9mIEV4aXRTdGF0dXMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHByb2Nlc3Mub24oXCJ1bmhhbmRsZWRSZWplY3Rpb25cIiwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhyb3cgcmVhc29uXG4gICAgICAgIH0pO1xuICAgICAgICBxdWl0XyA9IGZ1bmN0aW9uKHN0YXR1cywgdG9UaHJvdykge1xuICAgICAgICAgICAgaWYgKGtlZXBSdW50aW1lQWxpdmUoKSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3MuZXhpdENvZGUgPSBzdGF0dXM7XG4gICAgICAgICAgICAgICAgdGhyb3cgdG9UaHJvd1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nRXhjZXB0aW9uT25FeGl0KHRvVGhyb3cpO1xuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KHN0YXR1cylcbiAgICAgICAgfTtcbiAgICAgICAgTW9kdWxlLmluc3BlY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBcIltFbXNjcmlwdGVuIE1vZHVsZSBvYmplY3RdXCJcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoRU5WSVJPTk1FTlRfSVNfV0VCIHx8IEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1nbG9iYWxzXG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBzZWxmLmxvY2F0aW9uLmhyZWZcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIgJiYgZG9jdW1lbnQuY3VycmVudFNjcmlwdCkge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdC5zcmNcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0RGlyZWN0b3J5LmluZGV4T2YoXCJibG9iOlwiKSAhPT0gMCkge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gc2NyaXB0RGlyZWN0b3J5LnN1YnN0cigwLCBzY3JpcHREaXJlY3RvcnkucmVwbGFjZSgvWz8jXS4qLywgXCJcIikubGFzdEluZGV4T2YoXCIvXCIpICsgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IFwiXCJcbiAgICAgICAgfVxuICAgICAgICByZWFkXyA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0O1xuICAgICAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG4gICAgICAgICAgICB4aHIuc2VuZChudWxsKTtcbiAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgIH07XG4gICAgICAgIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgIHJlYWRCaW5hcnkgPSBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICAgICAgICAgICAgICB4aHIuc2VuZChudWxsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoeGhyLnJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlYWRBc3luYyA9IGZ1bmN0aW9uKHVybCwgb25sb2FkLCBvbmVycm9yKSB7XG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICAgICAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwIHx8IHhoci5zdGF0dXMgPT09IDAgJiYgeGhyLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ubG9hZCh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb25lcnJvcigpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgeGhyLm9uZXJyb3IgPSBvbmVycm9yO1xuICAgICAgICAgICAgeGhyLnNlbmQobnVsbClcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBvdXQgPSBNb2R1bGUucHJpbnQgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBjb25zdCBlcnIgPSBNb2R1bGUucHJpbnRFcnIgfHwgY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5cbiAgICBpZiAoTW9kdWxlLmFyZ3VtZW50cykgYXJndW1lbnRzXyA9IE1vZHVsZS5hcmd1bWVudHM7XG4gICAgaWYgKE1vZHVsZS50aGlzUHJvZ3JhbSkgdGhpc1Byb2dyYW0gPSBNb2R1bGUudGhpc1Byb2dyYW07XG4gICAgaWYgKE1vZHVsZS5xdWl0KSBxdWl0XyA9IE1vZHVsZS5xdWl0O1xuXG4gICAgZnVuY3Rpb24gYmFzZTY0VG9BcnJheUJ1ZmZlcihiYXNlNjQpIHtcbiAgICAgICAgbGV0IGJpbmFyeV9zdHJpbmcgPSAnJztcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX05PREUpIHtcbiAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSBCdWZmZXIuZnJvbShiYXNlNjQsICdiYXNlNjQnKS50b1N0cmluZygnYXNjaWknKTtcbiAgICAgICAgfSBlbHNlIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgICAgICBiaW5hcnlfc3RyaW5nID0gd29ya2VyR2xvYmFsU2NvcGUuYXRvYihiYXNlNjQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBiaW5hcnlfc3RyaW5nID0gd2luZG93LmF0b2IoYmFzZTY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgY29uc3QgbGVuID0gYmluYXJ5X3N0cmluZy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBieXRlc1tpXSA9IGJpbmFyeV9zdHJpbmcuY2hhckNvZGVBdChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXMuYnVmZmVyO1xuICAgIH1cblxuICAgIGNvbnN0IHdhc21CaW5hcnkgPSBiYXNlNjRUb0FycmF5QnVmZmVyKG1haW5XYXNtKTtcbiAgICBjb25zdCBub0V4aXRSdW50aW1lID0gTW9kdWxlLm5vRXhpdFJ1bnRpbWUgfHwgdHJ1ZTtcbiAgICBpZiAodHlwZW9mIFdlYkFzc2VtYmx5ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIGFib3J0KFwibm8gbmF0aXZlIHdhc20gc3VwcG9ydCBkZXRlY3RlZFwiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldFZhbHVlKHB0ciwgdmFsdWUsIHR5cGUpIHtcbiAgICAgICAgdHlwZSA9IHR5cGUgfHwgXCJpOFwiO1xuICAgICAgICBpZiAodHlwZS5jaGFyQXQodHlwZS5sZW5ndGggLSAxKSA9PT0gXCIqXCIpIHR5cGUgPSBcImkzMlwiO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpMVwiOlxuICAgICAgICAgICAgICAgIEhFQVA4W3B0ciA+PiAwXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImk4XCI6XG4gICAgICAgICAgICAgICAgSEVBUDhbcHRyID4+IDBdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaTE2XCI6XG4gICAgICAgICAgICAgICAgSEVBUDE2W3B0ciA+PiAxXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImkzMlwiOlxuICAgICAgICAgICAgICAgIEhFQVAzMltwdHIgPj4gMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJpNjRcIjpcbiAgICAgICAgICAgICAgICB0ZW1wSTY0ID0gW1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA+Pj4gMCxcbiAgICAgICAgICAgICAgICAgICAgKHRlbXBEb3VibGUgPSB2YWx1ZSwgK01hdGguYWJzKHRlbXBEb3VibGUpID49IDEgPyB0ZW1wRG91YmxlID4gMCA/IChNYXRoLm1pbigrTWF0aC5mbG9vcih0ZW1wRG91YmxlIC8gNDI5NDk2NzI5NiksIDQyOTQ5NjcyOTUpIHwgMCkgPj4+IDAgOiB+fitNYXRoLmNlaWwoKHRlbXBEb3VibGUgLSArKH5+dGVtcERvdWJsZSA+Pj4gMCkpIC8gNDI5NDk2NzI5NikgPj4+IDAgOiAwKV07XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciA+PiAyXSA9IHRlbXBJNjRbMF07XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciArIDQgPj4gMl0gPSB0ZW1wSTY0WzFdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICAgICAgICAgICAgSEVBUEYzMltwdHIgPj4gMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgICAgICAgICAgICBIRUFQRjY0W3B0ciA+PiAzXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBhYm9ydChgaW52YWxpZCB0eXBlIGZvciBzZXRWYWx1ZTogJHsgIHR5cGV9YClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFZhbHVlKHB0ciwgdHlwZSkge1xuICAgICAgICB0eXBlID0gdHlwZSB8fCBcImk4XCI7XG4gICAgICAgIGlmICh0eXBlLmNoYXJBdCh0eXBlLmxlbmd0aCAtIDEpID09PSBcIipcIikgdHlwZSA9IFwiaTMyXCI7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImkxXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3B0ciA+PiAwXTtcbiAgICAgICAgICAgIGNhc2UgXCJpOFwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBIRUFQOFtwdHIgPj4gMF07XG4gICAgICAgICAgICBjYXNlIFwiaTE2XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAxNltwdHIgPj4gMV07XG4gICAgICAgICAgICBjYXNlIFwiaTMyXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiaTY0XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUEYzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiZG91YmxlXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcihIRUFQRjY0W3B0ciA+PiAzXSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFib3J0KGBpbnZhbGlkIHR5cGUgZm9yIGdldFZhbHVlOiAkeyAgdHlwZX1gKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIGxldCB3YXNtTWVtb3J5O1xuICAgIGxldCBBQk9SVCA9IGZhbHNlO1xuICAgIGxldCBFWElUU1RBVFVTO1xuXG4gICAgZnVuY3Rpb24gYXNzZXJ0KGNvbmRpdGlvbiwgdGV4dCkge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgICAgYWJvcnQoYEFzc2VydGlvbiBmYWlsZWQ6ICR7ICB0ZXh0fWApXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRDRnVuYyhpZGVudCkge1xuICAgICAgICBjb25zdCBmdW5jID0gTW9kdWxlW2BfJHsgIGlkZW50fWBdO1xuICAgICAgICBhc3NlcnQoZnVuYywgYENhbm5vdCBjYWxsIHVua25vd24gZnVuY3Rpb24gJHsgIGlkZW50ICB9LCBtYWtlIHN1cmUgaXQgaXMgZXhwb3J0ZWRgKTtcbiAgICAgICAgcmV0dXJuIGZ1bmNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjY2FsbChpZGVudCwgcmV0dXJuVHlwZSwgYXJnVHlwZXMsIGFyZ3MpIHtcbiAgICAgICAgY29uc3QgdG9DID0ge1xuICAgICAgICAgICAgXCJzdHJpbmdcIjogZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldCA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciAhPT0gbnVsbCAmJiBzdHIgIT09IHVuZGVmaW5lZCAmJiBzdHIgIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuID0gKHN0ci5sZW5ndGggPDwgMikgKyAxO1xuICAgICAgICAgICAgICAgICAgICByZXQgPSBzdGFja0FsbG9jKGxlbik7XG4gICAgICAgICAgICAgICAgICAgIHN0cmluZ1RvVVRGOChzdHIsIHJldCwgbGVuKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCJhcnJheVwiOiBmdW5jdGlvbihhcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXQgPSBzdGFja0FsbG9jKGFyci5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIHdyaXRlQXJyYXlUb01lbW9yeShhcnIsIHJldCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNvbnZlcnRSZXR1cm5WYWx1ZShyZXQpIHtcbiAgICAgICAgICAgIGlmIChyZXR1cm5UeXBlID09PSBcInN0cmluZ1wiKSByZXR1cm4gVVRGOFRvU3RyaW5nKHJldCk7XG4gICAgICAgICAgICBpZiAocmV0dXJuVHlwZSA9PT0gXCJib29sZWFuXCIpIHJldHVybiBCb29sZWFuKHJldCk7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVuYyA9IGdldENGdW5jKGlkZW50KTtcbiAgICAgICAgY29uc3QgY0FyZ3MgPSBbXTtcbiAgICAgICAgbGV0IHN0YWNrID0gMDtcbiAgICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlciA9IHRvQ1thcmdUeXBlc1tpXV07XG4gICAgICAgICAgICAgICAgaWYgKGNvbnZlcnRlcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhY2sgPT09IDApIHN0YWNrID0gc3RhY2tTYXZlKCk7XG4gICAgICAgICAgICAgICAgICAgIGNBcmdzW2ldID0gY29udmVydGVyKGFyZ3NbaV0pXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY0FyZ3NbaV0gPSBhcmdzW2ldXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCByZXQgPSBmdW5jKC4uLmNBcmdzKTtcblxuICAgICAgICBmdW5jdGlvbiBvbkRvbmUocmV0KSB7XG4gICAgICAgICAgICBpZiAoc3RhY2sgIT09IDApIHN0YWNrUmVzdG9yZShzdGFjayk7XG4gICAgICAgICAgICByZXR1cm4gY29udmVydFJldHVyblZhbHVlKHJldClcbiAgICAgICAgfVxuICAgICAgICByZXQgPSBvbkRvbmUocmV0KTtcbiAgICAgICAgcmV0dXJuIHJldFxuICAgIH1cbiAgICBjb25zdCBVVEY4RGVjb2RlciA9IHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gXCJ1bmRlZmluZWRcIiA/IG5ldyBUZXh0RGVjb2RlcihcInV0ZjhcIikgOiB1bmRlZmluZWQ7XG5cbiAgICBmdW5jdGlvbiBVVEY4QXJyYXlUb1N0cmluZyhoZWFwLCBpZHgsIG1heEJ5dGVzVG9SZWFkKSB7XG4gICAgICAgIGNvbnN0IGVuZElkeCA9IGlkeCArIG1heEJ5dGVzVG9SZWFkO1xuICAgICAgICBsZXQgZW5kUHRyID0gaWR4O1xuICAgICAgICB3aGlsZSAoaGVhcFtlbmRQdHJdICYmICEoZW5kUHRyID49IGVuZElkeCkpICsrZW5kUHRyO1xuICAgICAgICBpZiAoZW5kUHRyIC0gaWR4ID4gMTYgJiYgaGVhcC5zdWJhcnJheSAmJiBVVEY4RGVjb2Rlcikge1xuICAgICAgICAgICAgcmV0dXJuIFVURjhEZWNvZGVyLmRlY29kZShoZWFwLnN1YmFycmF5KGlkeCwgZW5kUHRyKSlcbiAgICAgICAgfSBcbiAgICAgICAgICAgIGxldCBzdHIgPSBcIlwiO1xuICAgICAgICAgICAgd2hpbGUgKGlkeCA8IGVuZFB0cikge1xuICAgICAgICAgICAgICAgIGxldCB1MCA9IGhlYXBbaWR4KytdO1xuICAgICAgICAgICAgICAgIGlmICghKHUwICYgMTI4KSkge1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1MCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHUxID0gaGVhcFtpZHgrK10gJiA2MztcbiAgICAgICAgICAgICAgICBpZiAoKHUwICYgMjI0KSA9PT0gMTkyKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCh1MCAmIDMxKSA8PCA2IHwgdTEpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCB1MiA9IGhlYXBbaWR4KytdICYgNjM7XG4gICAgICAgICAgICAgICAgaWYgKCh1MCAmIDI0MCkgPT09IDIyNCkge1xuICAgICAgICAgICAgICAgICAgICB1MCA9ICh1MCAmIDE1KSA8PCAxMiB8IHUxIDw8IDYgfCB1MlxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHUwID0gKHUwICYgNykgPDwgMTggfCB1MSA8PCAxMiB8IHUyIDw8IDYgfCBoZWFwW2lkeCsrXSAmIDYzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh1MCA8IDY1NTM2KSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHUwKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoID0gdTAgLSA2NTUzNjtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoNTUyOTYgfCBjaCA+PiAxMCwgNTYzMjAgfCBjaCAmIDEwMjMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHN0clxuICAgIH1cblxuICAgIGZ1bmN0aW9uIFVURjhUb1N0cmluZyhwdHIsIG1heEJ5dGVzVG9SZWFkKSB7XG4gICAgICAgIHJldHVybiBwdHIgPyBVVEY4QXJyYXlUb1N0cmluZyhIRUFQVTgsIHB0ciwgbWF4Qnl0ZXNUb1JlYWQpIDogXCJcIlxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmluZ1RvVVRGOEFycmF5KHN0ciwgaGVhcCwgb3V0SWR4LCBtYXhCeXRlc1RvV3JpdGUpIHtcbiAgICAgICAgaWYgKCEobWF4Qnl0ZXNUb1dyaXRlID4gMCkpIHJldHVybiAwO1xuICAgICAgICBjb25zdCBzdGFydElkeCA9IG91dElkeDtcbiAgICAgICAgY29uc3QgZW5kSWR4ID0gb3V0SWR4ICsgbWF4Qnl0ZXNUb1dyaXRlIC0gMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCB1ID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAodSA+PSA1NTI5NiAmJiB1IDw9IDU3MzQzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdTEgPSBzdHIuY2hhckNvZGVBdCgrK2kpO1xuICAgICAgICAgICAgICAgIHUgPSA2NTUzNiArICgodSAmIDEwMjMpIDw8IDEwKSB8IHUxICYgMTAyM1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHUgPD0gMTI3KSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dElkeCA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gdVxuICAgICAgICAgICAgfSBlbHNlIGlmICh1IDw9IDIwNDcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ICsgMSA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTkyIHwgdSA+PiA2O1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSAmIDYzXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHUgPD0gNjU1MzUpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ICsgMiA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMjI0IHwgdSA+PiAxMjtcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDEyOCB8IHUgPj4gNiAmIDYzO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSAmIDYzXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAzID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAyNDAgfCB1ID4+IDE4O1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiAxMiAmIDYzO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiA2ICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBoZWFwW291dElkeF0gPSAwO1xuICAgICAgICByZXR1cm4gb3V0SWR4IC0gc3RhcnRJZHhcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJpbmdUb1VURjgoc3RyLCBvdXRQdHIsIG1heEJ5dGVzVG9Xcml0ZSkge1xuICAgICAgICByZXR1cm4gc3RyaW5nVG9VVEY4QXJyYXkoc3RyLCBIRUFQVTgsIG91dFB0ciwgbWF4Qnl0ZXNUb1dyaXRlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxlbmd0aEJ5dGVzVVRGOChzdHIpIHtcbiAgICAgICAgbGV0IGxlbiA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBsZXQgdSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgaWYgKHUgPj0gNTUyOTYgJiYgdSA8PSA1NzM0MykgdSA9IDY1NTM2ICsgKCh1ICYgMTAyMykgPDwgMTApIHwgc3RyLmNoYXJDb2RlQXQoKytpKSAmIDEwMjM7XG4gICAgICAgICAgICBpZiAodSA8PSAxMjcpICsrbGVuO1xuICAgICAgICAgICAgZWxzZSBpZiAodSA8PSAyMDQ3KSBsZW4gKz0gMjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHUgPD0gNjU1MzUpIGxlbiArPSAzO1xuICAgICAgICAgICAgZWxzZSBsZW4gKz0gNFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsZW5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxvY2F0ZVVURjhPblN0YWNrKHN0cikge1xuICAgICAgICBjb25zdCBzaXplID0gbGVuZ3RoQnl0ZXNVVEY4KHN0cikgKyAxO1xuICAgICAgICBjb25zdCByZXQgPSBzdGFja0FsbG9jKHNpemUpO1xuICAgICAgICBzdHJpbmdUb1VURjhBcnJheShzdHIsIEhFQVA4LCByZXQsIHNpemUpO1xuICAgICAgICByZXR1cm4gcmV0XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd3JpdGVBcnJheVRvTWVtb3J5KGFycmF5LCBidWZmZXIpIHtcbiAgICAgICAgSEVBUDguc2V0KGFycmF5LCBidWZmZXIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxpZ25VcCh4LCBtdWx0aXBsZSkge1xuICAgICAgICBpZiAoeCAlIG11bHRpcGxlID4gMCkge1xuICAgICAgICAgICAgeCArPSBtdWx0aXBsZSAtIHggJSBtdWx0aXBsZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4XG4gICAgfVxuICAgIGxldCBidWZmZXI7IGxldCBIRUFQODsgbGV0IEhFQVBVODsgbGV0IEhFQVAxNjsgbGV0IEhFQVBVMTY7IGxldCBIRUFQMzI7IGxldCBIRUFQVTMyOyBsZXQgSEVBUEYzMjsgbGV0IEhFQVBGNjQ7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyhidWYpIHtcbiAgICAgICAgYnVmZmVyID0gYnVmO1xuICAgICAgICBNb2R1bGUuSEVBUDggPSBIRUFQOCA9IG5ldyBJbnQ4QXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVAxNiA9IEhFQVAxNiA9IG5ldyBJbnQxNkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQMzIgPSBIRUFQMzIgPSBuZXcgSW50MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUFU4ID0gSEVBUFU4ID0gbmV3IFVpbnQ4QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICBNb2R1bGUuSEVBUFUxNiA9IEhFQVBVMTYgPSBuZXcgVWludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICBNb2R1bGUuSEVBUFUzMiA9IEhFQVBVMzIgPSBuZXcgVWludDMyQXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVBGMzIgPSBIRUFQRjMyID0gbmV3IEZsb2F0MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUEY2NCA9IEhFQVBGNjQgPSBuZXcgRmxvYXQ2NEFycmF5KGJ1ZilcbiAgICB9XG4gICAgbGV0IHdhc21UYWJsZTtcbiAgICBjb25zdCBfX0FUUFJFUlVOX18gPSBbXTtcbiAgICBjb25zdCBfX0FUSU5JVF9fID0gW107XG4gICAgY29uc3QgX19BVE1BSU5fXyA9IFtdO1xuICAgIGNvbnN0IF9fQVRQT1NUUlVOX18gPSBbXTtcbiAgICBjb25zdCBydW50aW1lS2VlcGFsaXZlQ291bnRlciA9IDA7XG5cbiAgICBmdW5jdGlvbiBrZWVwUnVudGltZUFsaXZlKCkge1xuICAgICAgICByZXR1cm4gbm9FeGl0UnVudGltZSB8fCBydW50aW1lS2VlcGFsaXZlQ291bnRlciA+IDBcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVSdW4oKSB7XG4gICAgICAgIGlmIChNb2R1bGUucHJlUnVuKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIE1vZHVsZS5wcmVSdW4gPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnByZVJ1biA9IFtNb2R1bGUucHJlUnVuXTtcbiAgICAgICAgICAgIHdoaWxlIChNb2R1bGUucHJlUnVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFkZE9uUHJlUnVuKE1vZHVsZS5wcmVSdW4uc2hpZnQoKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYWxsUnVudGltZUNhbGxiYWNrcyhfX0FUUFJFUlVOX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdFJ1bnRpbWUoKSB7XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRJTklUX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJlTWFpbigpIHtcbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVE1BSU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGl0UnVudGltZSgpIHtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwb3N0UnVuKCkge1xuICAgICAgICBpZiAoTW9kdWxlLnBvc3RSdW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnBvc3RSdW4gPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnBvc3RSdW4gPSBbTW9kdWxlLnBvc3RSdW5dO1xuICAgICAgICAgICAgd2hpbGUgKE1vZHVsZS5wb3N0UnVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFkZE9uUG9zdFJ1bihNb2R1bGUucG9zdFJ1bi5zaGlmdCgpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRQT1NUUlVOX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25QcmVSdW4oY2IpIHtcbiAgICAgICAgX19BVFBSRVJVTl9fLnVuc2hpZnQoY2IpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25Jbml0KGNiKSB7XG4gICAgICAgIF9fQVRJTklUX18udW5zaGlmdChjYilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPblBvc3RSdW4oY2IpIHtcbiAgICAgICAgX19BVFBPU1RSVU5fXy51bnNoaWZ0KGNiKVxuICAgIH1cbiAgICBsZXQgcnVuRGVwZW5kZW5jaWVzID0gMDtcbiAgICBsZXQgcnVuRGVwZW5kZW5jeVdhdGNoZXIgPSBudWxsO1xuICAgIGxldCBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBudWxsO1xuXG4gICAgZnVuY3Rpb24gYWRkUnVuRGVwZW5kZW5jeSgpIHtcbiAgICAgICAgcnVuRGVwZW5kZW5jaWVzKys7XG4gICAgICAgIGlmIChNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgTW9kdWxlLm1vbml0b3JSdW5EZXBlbmRlbmNpZXMocnVuRGVwZW5kZW5jaWVzKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlUnVuRGVwZW5kZW5jeSgpIHtcbiAgICAgICAgcnVuRGVwZW5kZW5jaWVzLS07XG4gICAgICAgIGlmIChNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgTW9kdWxlLm1vbml0b3JSdW5EZXBlbmRlbmNpZXMocnVuRGVwZW5kZW5jaWVzKVxuICAgICAgICB9XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPT09IDApIHtcbiAgICAgICAgICAgIGlmIChydW5EZXBlbmRlbmN5V2F0Y2hlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwocnVuRGVwZW5kZW5jeVdhdGNoZXIpO1xuICAgICAgICAgICAgICAgIHJ1bkRlcGVuZGVuY3lXYXRjaGVyID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRlcGVuZGVuY2llc0Z1bGZpbGxlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gZGVwZW5kZW5jaWVzRnVsZmlsbGVkO1xuICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIE1vZHVsZS5wcmVsb2FkZWRJbWFnZXMgPSB7fTtcbiAgICBNb2R1bGUucHJlbG9hZGVkQXVkaW9zID0ge307XG5cbiAgICBmdW5jdGlvbiBhYm9ydCh3aGF0KSB7XG4gICAgICAgIGlmIChNb2R1bGUub25BYm9ydCkge1xuICAgICAgICAgICAgTW9kdWxlLm9uQWJvcnQod2hhdClcbiAgICAgICAgfVxuICAgICAgICB3aGF0ID0gYEFib3J0ZWQoJHsgIHdoYXQgIH0pYDtcbiAgICAgICAgZXJyKHdoYXQpO1xuICAgICAgICBBQk9SVCA9IHRydWU7XG4gICAgICAgIEVYSVRTVEFUVVMgPSAxO1xuICAgICAgICB3aGF0ICs9IFwiLiBCdWlsZCB3aXRoIC1zIEFTU0VSVElPTlM9MSBmb3IgbW9yZSBpbmZvLlwiO1xuICAgICAgICBjb25zdCBlID0gbmV3IFdlYkFzc2VtYmx5LlJ1bnRpbWVFcnJvcih3aGF0KTtcbiAgICAgICAgdGhyb3cgZVxuICAgIH1cbiAgICBjb25zdCBkYXRhVVJJUHJlZml4ID0gXCJkYXRhOmFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbTtiYXNlNjQsXCI7XG5cbiAgICBmdW5jdGlvbiBpc0RhdGFVUkkoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lLnN0YXJ0c1dpdGgoZGF0YVVSSVByZWZpeClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0ZpbGVVUkkoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lLnN0YXJ0c1dpdGgoXCJmaWxlOi8vXCIpXG4gICAgfVxuICAgIGxldCB3YXNtQmluYXJ5RmlsZTtcbiAgICB3YXNtQmluYXJ5RmlsZSA9IG1haW5XYXNtO1xuICAgIGlmICghaXNEYXRhVVJJKHdhc21CaW5hcnlGaWxlKSkge1xuICAgICAgICB3YXNtQmluYXJ5RmlsZSA9IGxvY2F0ZUZpbGUod2FzbUJpbmFyeUZpbGUpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QmluYXJ5KGZpbGUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChmaWxlID09PSB3YXNtQmluYXJ5RmlsZSAmJiB3YXNtQmluYXJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHdhc21CaW5hcnkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVhZEJpbmFyeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWFkQmluYXJ5KGZpbGUpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImJvdGggYXN5bmMgYW5kIHN5bmMgZmV0Y2hpbmcgb2YgdGhlIHdhc20gZmFpbGVkXCIpO1xuICAgICAgICAgICAgXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgYWJvcnQoZXJyKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCaW5hcnlQcm9taXNlKCkge1xuICAgICAgICBpZiAoIXdhc21CaW5hcnkgJiYgKEVOVklST05NRU5UX0lTX1dFQiB8fCBFTlZJUk9OTUVOVF9JU19XT1JLRVIpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZldGNoID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzRmlsZVVSSSh3YXNtQmluYXJ5RmlsZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2god2FzbUJpbmFyeUZpbGUsIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIlxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGxvYWQgd2FzbSBiaW5hcnkgZmlsZSBhdCAnJHsgIHdhc21CaW5hcnlGaWxlICB9J2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5hcnJheUJ1ZmZlcigpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gZ2V0QmluYXJ5KHdhc21CaW5hcnlGaWxlKSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgaWYgKHJlYWRBc3luYykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZEFzeW5jKHdhc21CaW5hcnlGaWxlLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIHJlamVjdClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiBnZXRCaW5hcnkod2FzbUJpbmFyeUZpbGUpKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVdhc20oKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICBcImVudlwiOiBhc21MaWJyYXJ5QXJnLFxuICAgICAgICAgICAgXCJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxXCI6IGFzbUxpYnJhcnlBcmdcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiByZWNlaXZlSW5zdGFuY2UoaW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHtleHBvcnRzfSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgTW9kdWxlLmFzbSA9IGV4cG9ydHM7XG4gICAgICAgICAgICB3YXNtTWVtb3J5ID0gTW9kdWxlLmFzbS5tZW1vcnk7XG4gICAgICAgICAgICB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyh3YXNtTWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgICAgICB3YXNtVGFibGUgPSBNb2R1bGUuYXNtLl9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGU7XG4gICAgICAgICAgICBhZGRPbkluaXQoTW9kdWxlLmFzbS5fX3dhc21fY2FsbF9jdG9ycyk7XG4gICAgICAgICAgICByZW1vdmVSdW5EZXBlbmRlbmN5KFwid2FzbS1pbnN0YW50aWF0ZVwiKVxuICAgICAgICB9XG4gICAgICAgIGFkZFJ1bkRlcGVuZGVuY3koXCJ3YXNtLWluc3RhbnRpYXRlXCIpO1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KHJlc3VsdCkge1xuICAgICAgICAgICAgcmVjZWl2ZUluc3RhbmNlKHJlc3VsdC5pbnN0YW5jZSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluc3RhbnRpYXRlQXJyYXlCdWZmZXIocmVjZWl2ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRCaW5hcnlQcm9taXNlKCkudGhlbigoYmluYXJ5KSA9PiBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShiaW5hcnksIGluZm8pKS50aGVuKChpbnN0YW5jZSkgPT4gaW5zdGFuY2UpLnRoZW4ocmVjZWl2ZXIsIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICBlcnIoYGZhaWxlZCB0byBhc3luY2hyb25vdXNseSBwcmVwYXJlIHdhc206ICR7ICByZWFzb259YCk7XG4gICAgICAgICAgICAgICAgYWJvcnQocmVhc29uKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluc3RhbnRpYXRlQXN5bmMoKSB7XG4gICAgICAgICAgICBpZiAoIXdhc21CaW5hcnkgJiYgdHlwZW9mIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzRGF0YVVSSSh3YXNtQmluYXJ5RmlsZSkgJiYgIWlzRmlsZVVSSSh3YXNtQmluYXJ5RmlsZSkgJiYgdHlwZW9mIGZldGNoID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2god2FzbUJpbmFyeUZpbGUsIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIlxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKHJlc3BvbnNlLCBpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC50aGVuKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0LCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoYHdhc20gc3RyZWFtaW5nIGNvbXBpbGUgZmFpbGVkOiAkeyAgcmVhc29ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyKFwiZmFsbGluZyBiYWNrIHRvIEFycmF5QnVmZmVyIGluc3RhbnRpYXRpb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdClcbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIGlmIChNb2R1bGUuaW5zdGFudGlhdGVXYXNtKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cG9ydHMgPSBNb2R1bGUuaW5zdGFudGlhdGVXYXNtKGluZm8sIHJlY2VpdmVJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cG9ydHNcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBlcnIoYE1vZHVsZS5pbnN0YW50aWF0ZVdhc20gY2FsbGJhY2sgZmFpbGVkIHdpdGggZXJyb3I6ICR7ICBlfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGluc3RhbnRpYXRlQXN5bmMoKTtcbiAgICAgICAgcmV0dXJuIHt9XG4gICAgfVxuICAgIGxldCB0ZW1wRG91YmxlO1xuICAgIGxldCB0ZW1wSTY0O1xuXG4gICAgZnVuY3Rpb24gY2FsbFJ1bnRpbWVDYWxsYmFja3MoY2FsbGJhY2tzKSB7XG4gICAgICAgIHdoaWxlIChjYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBjYWxsYmFja3Muc2hpZnQoKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKE1vZHVsZSk7XG4gICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHtmdW5jfSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmFyZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFdhc21UYWJsZUVudHJ5KGZ1bmMpKClcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBnZXRXYXNtVGFibGVFbnRyeShmdW5jKShjYWxsYmFjay5hcmcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmdW5jKGNhbGxiYWNrLmFyZyA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGNhbGxiYWNrLmFyZylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHdhc21UYWJsZU1pcnJvciA9IFtdO1xuXG4gICAgZnVuY3Rpb24gZ2V0V2FzbVRhYmxlRW50cnkoZnVuY1B0cikge1xuICAgICAgICBsZXQgZnVuYyA9IHdhc21UYWJsZU1pcnJvcltmdW5jUHRyXTtcbiAgICAgICAgaWYgKCFmdW5jKSB7XG4gICAgICAgICAgICBpZiAoZnVuY1B0ciA+PSB3YXNtVGFibGVNaXJyb3IubGVuZ3RoKSB3YXNtVGFibGVNaXJyb3IubGVuZ3RoID0gZnVuY1B0ciArIDE7XG4gICAgICAgICAgICB3YXNtVGFibGVNaXJyb3JbZnVuY1B0cl0gPSBmdW5jID0gd2FzbVRhYmxlLmdldChmdW5jUHRyKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlRXhjZXB0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFeGl0U3RhdHVzIHx8IGUgPT09IFwidW53aW5kXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBFWElUU1RBVFVTXG4gICAgICAgIH1cbiAgICAgICAgcXVpdF8oMSwgZSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19hc3NlcnRfZmFpbChjb25kaXRpb24sIGZpbGVuYW1lLCBsaW5lLCBmdW5jKSB7XG4gICAgICAgIGFib3J0KGBBc3NlcnRpb24gZmFpbGVkOiAkeyAgVVRGOFRvU3RyaW5nKGNvbmRpdGlvbikgIH0sIGF0OiAkeyAgW2ZpbGVuYW1lID8gVVRGOFRvU3RyaW5nKGZpbGVuYW1lKSA6IFwidW5rbm93biBmaWxlbmFtZVwiLCBsaW5lLCBmdW5jID8gVVRGOFRvU3RyaW5nKGZ1bmMpIDogXCJ1bmtub3duIGZ1bmN0aW9uXCJdfWApXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbihzaXplKSB7XG4gICAgICAgIHJldHVybiBfbWFsbG9jKHNpemUgKyAxNikgKyAxNlxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hdGV4aXQoKSB7fVxuXG4gICAgZnVuY3Rpb24gX19fY3hhX2F0ZXhpdChhMCwgYTEpIHtcbiAgICAgICAgcmV0dXJuIF9hdGV4aXQoYTAsIGExKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIEV4Y2VwdGlvbkluZm8oZXhjUHRyKSB7XG4gICAgICAgIHRoaXMuZXhjUHRyID0gZXhjUHRyO1xuICAgICAgICB0aGlzLnB0ciA9IGV4Y1B0ciAtIDE2O1xuICAgICAgICB0aGlzLnNldF90eXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyICsgNCA+PiAyXSA9IHR5cGVcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfdHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVAzMlt0aGlzLnB0ciArIDQgPj4gMl1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uKGRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciArIDggPj4gMl0gPSBkZXN0cnVjdG9yXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X2Rlc3RydWN0b3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBIRUFQMzJbdGhpcy5wdHIgKyA4ID4+IDJdXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0X3JlZmNvdW50ID0gZnVuY3Rpb24ocmVmY291bnQpIHtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciA+PiAyXSA9IHJlZmNvdW50XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0X2NhdWdodCA9IGZ1bmN0aW9uKGNhdWdodCkge1xuICAgICAgICAgICAgY2F1Z2h0ID0gY2F1Z2h0ID8gMSA6IDA7XG4gICAgICAgICAgICBIRUFQOFt0aGlzLnB0ciArIDEyID4+IDBdID0gY2F1Z2h0XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X2NhdWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3RoaXMucHRyICsgMTIgPj4gMF0gIT09IDBcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfcmV0aHJvd24gPSBmdW5jdGlvbihyZXRocm93bikge1xuICAgICAgICAgICAgcmV0aHJvd24gPSByZXRocm93biA/IDEgOiAwO1xuICAgICAgICAgICAgSEVBUDhbdGhpcy5wdHIgKyAxMyA+PiAwXSA9IHJldGhyb3duXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X3JldGhyb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDhbdGhpcy5wdHIgKyAxMyA+PiAwXSAhPT0gMFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmluaXQgPSBmdW5jdGlvbih0eXBlLCBkZXN0cnVjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLnNldF90eXBlKHR5cGUpO1xuICAgICAgICAgICAgdGhpcy5zZXRfZGVzdHJ1Y3RvcihkZXN0cnVjdG9yKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X3JlZmNvdW50KDApO1xuICAgICAgICAgICAgdGhpcy5zZXRfY2F1Z2h0KGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X3JldGhyb3duKGZhbHNlKVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZF9yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gSEVBUDMyW3RoaXMucHRyID4+IDJdO1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyID4+IDJdID0gdmFsdWUgKyAxXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMucmVsZWFzZV9yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXYgPSBIRUFQMzJbdGhpcy5wdHIgPj4gMl07XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgPj4gMl0gPSBwcmV2IC0gMTtcbiAgICAgICAgICAgIHJldHVybiBwcmV2ID09PSAxXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfdGhyb3cocHRyLCB0eXBlLCBkZXN0cnVjdG9yKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSBuZXcgRXhjZXB0aW9uSW5mbyhwdHIpO1xuICAgICAgICBpbmZvLmluaXQodHlwZSwgZGVzdHJ1Y3Rvcik7XG4gICAgICAgIHRocm93IHB0clxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hYm9ydCgpIHtcbiAgICAgICAgYWJvcnQoXCJcIilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZW1zY3JpcHRlbl9tZW1jcHlfYmlnKGRlc3QsIHNyYywgbnVtKSB7XG4gICAgICAgIEhFQVBVOC5jb3B5V2l0aGluKGRlc3QsIHNyYywgc3JjICsgbnVtKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIoc2l6ZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2FzbU1lbW9yeS5ncm93KHNpemUgLSBidWZmZXIuYnl0ZUxlbmd0aCArIDY1NTM1ID4+PiAxNik7XG4gICAgICAgICAgICB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyh3YXNtTWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gMVxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHlcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZW1zY3JpcHRlbl9yZXNpemVfaGVhcChyZXF1ZXN0ZWRTaXplKSB7XG4gICAgICAgIGNvbnN0IG9sZFNpemUgPSBIRUFQVTgubGVuZ3RoO1xuICAgICAgICByZXF1ZXN0ZWRTaXplID4+Pj0gMDtcbiAgICAgICAgY29uc3QgbWF4SGVhcFNpemUgPSAyMTQ3NDgzNjQ4O1xuICAgICAgICBpZiAocmVxdWVzdGVkU2l6ZSA+IG1heEhlYXBTaXplKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjdXREb3duID0gMTsgY3V0RG93biA8PSA0OyBjdXREb3duICo9IDIpIHtcbiAgICAgICAgICAgIGxldCBvdmVyR3Jvd25IZWFwU2l6ZSA9IG9sZFNpemUgKiAoMSArIC4yIC8gY3V0RG93bik7XG4gICAgICAgICAgICBvdmVyR3Jvd25IZWFwU2l6ZSA9IE1hdGgubWluKG92ZXJHcm93bkhlYXBTaXplLCByZXF1ZXN0ZWRTaXplICsgMTAwNjYzMjk2KTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NpemUgPSBNYXRoLm1pbihtYXhIZWFwU2l6ZSwgYWxpZ25VcChNYXRoLm1heChyZXF1ZXN0ZWRTaXplLCBvdmVyR3Jvd25IZWFwU2l6ZSksIDY1NTM2KSk7XG4gICAgICAgICAgICBjb25zdCByZXBsYWNlbWVudCA9IGVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIobmV3U2l6ZSk7XG4gICAgICAgICAgICBpZiAocmVwbGFjZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCBTWVNDQUxMUyA9IHtcbiAgICAgICAgbWFwcGluZ3M6IHt9LFxuICAgICAgICBidWZmZXJzOiBbbnVsbCwgW10sXG4gICAgICAgICAgICBbXVxuICAgICAgICBdLFxuICAgICAgICBwcmludENoYXIoc3RyZWFtLCBjdXJyKSB7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBTWVNDQUxMUy5idWZmZXJzW3N0cmVhbV07XG4gICAgICAgICAgICBpZiAoY3VyciA9PT0gMCB8fCBjdXJyID09PSAxMCkge1xuICAgICAgICAgICAgICAgIChzdHJlYW0gPT09IDEgPyBvdXQgOiBlcnIpKFVURjhBcnJheVRvU3RyaW5nKGJ1ZmZlciwgMCkpO1xuICAgICAgICAgICAgICAgIGJ1ZmZlci5sZW5ndGggPSAwXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKGN1cnIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHZhcmFyZ3M6IHVuZGVmaW5lZCxcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgICAgU1lTQ0FMTFMudmFyYXJncyArPSA0O1xuICAgICAgICAgICAgY29uc3QgcmV0ID0gSEVBUDMyW1NZU0NBTExTLnZhcmFyZ3MgLSA0ID4+IDJdO1xuICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICB9LFxuICAgICAgICBnZXRTdHIocHRyKSB7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBVVEY4VG9TdHJpbmcocHRyKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0NjQobG93KSB7XG4gICAgICAgICAgICByZXR1cm4gbG93XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gX2ZkX3dyaXRlKGZkLCBpb3YsIGlvdmNudCwgcG51bSkge1xuICAgICAgICBsZXQgbnVtID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpb3ZjbnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcHRyID0gSEVBUDMyW2lvdiA+PiAyXTtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IEhFQVAzMltpb3YgKyA0ID4+IDJdO1xuICAgICAgICAgICAgaW92ICs9IDg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgU1lTQ0FMTFMucHJpbnRDaGFyKGZkLCBIRUFQVThbcHRyICsgal0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBudW0gKz0gbGVuXG4gICAgICAgIH1cbiAgICAgICAgSEVBUDMyW3BudW0gPj4gMl0gPSBudW07XG4gICAgICAgIHJldHVybiAwXG4gICAgfVxuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgIGZ1bmN0aW9uIF9zZXRUZW1wUmV0MCh2YWwpIHtcbiAgICAgICAgLy8gc2V0VGVtcFJldDAodmFsKVxuICAgIH1cbiAgICBjb25zdCBhc21MaWJyYXJ5QXJnID0ge1xuICAgICAgICBcIl9fYXNzZXJ0X2ZhaWxcIjogX19fYXNzZXJ0X2ZhaWwsXG4gICAgICAgIFwiX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uXCI6IF9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24sXG4gICAgICAgIFwiX19jeGFfYXRleGl0XCI6IF9fX2N4YV9hdGV4aXQsXG4gICAgICAgIFwiX19jeGFfdGhyb3dcIjogX19fY3hhX3Rocm93LFxuICAgICAgICBcImFib3J0XCI6IF9hYm9ydCxcbiAgICAgICAgXCJlbXNjcmlwdGVuX21lbWNweV9iaWdcIjogX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZyxcbiAgICAgICAgXCJlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwXCI6IF9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwLFxuICAgICAgICBcImZkX3dyaXRlXCI6IF9mZF93cml0ZSxcbiAgICAgICAgXCJzZXRUZW1wUmV0MFwiOiBfc2V0VGVtcFJldDBcbiAgICB9O1xuICAgIGNyZWF0ZVdhc20oKTtcbiAgICBsZXQgX19fd2FzbV9jYWxsX2N0b3JzID0gTW9kdWxlLl9fX3dhc21fY2FsbF9jdG9ycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9fX3dhc21fY2FsbF9jdG9ycyA9IE1vZHVsZS5fX193YXNtX2NhbGxfY3RvcnMgPSBNb2R1bGUuYXNtLl9fd2FzbV9jYWxsX2N0b3JzKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX21haW4gPSBNb2R1bGUuX21haW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfbWFpbiA9IE1vZHVsZS5fbWFpbiA9IE1vZHVsZS5hc20ubWFpbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9jcmVhdGVUZXh0dXJlID0gTW9kdWxlLl9jcmVhdGVUZXh0dXJlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuYXNtLmNyZWF0ZVRleHR1cmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfY3JlYXRlQm91bmRpbmcgPSBNb2R1bGUuX2NyZWF0ZUJvdW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2NyZWF0ZUJvdW5kaW5nID0gTW9kdWxlLl9jcmVhdGVCb3VuZGluZyA9IE1vZHVsZS5hc20uY3JlYXRlQm91bmRpbmcpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfc2V0Q2FtZXJhID0gTW9kdWxlLl9zZXRDYW1lcmEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfc2V0Q2FtZXJhID0gTW9kdWxlLl9zZXRDYW1lcmEgPSBNb2R1bGUuYXNtLnNldENhbWVyYSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9yZWFkU3RyZWFtID0gTW9kdWxlLl9yZWFkU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX3JlYWRTdHJlYW0gPSBNb2R1bGUuX3JlYWRTdHJlYW0gPSBNb2R1bGUuYXNtLnJlYWRTdHJlYW0pLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfcGF0aFRyYWNlciA9IE1vZHVsZS5fcGF0aFRyYWNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9wYXRoVHJhY2VyID0gTW9kdWxlLl9wYXRoVHJhY2VyID0gTW9kdWxlLmFzbS5wYXRoVHJhY2VyKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX19fZXJybm9fbG9jYXRpb24gPSBNb2R1bGUuX19fZXJybm9fbG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5fX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5hc20uX19lcnJub19sb2NhdGlvbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IHN0YWNrU2F2ZSA9IE1vZHVsZS5zdGFja1NhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja1NhdmUgPSBNb2R1bGUuc3RhY2tTYXZlID0gTW9kdWxlLmFzbS5zdGFja1NhdmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBzdGFja1Jlc3RvcmUgPSBNb2R1bGUuc3RhY2tSZXN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoc3RhY2tSZXN0b3JlID0gTW9kdWxlLnN0YWNrUmVzdG9yZSA9IE1vZHVsZS5hc20uc3RhY2tSZXN0b3JlKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgc3RhY2tBbGxvYyA9IE1vZHVsZS5zdGFja0FsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoc3RhY2tBbGxvYyA9IE1vZHVsZS5zdGFja0FsbG9jID0gTW9kdWxlLmFzbS5zdGFja0FsbG9jKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX21hbGxvYyA9IE1vZHVsZS5fbWFsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX21hbGxvYyA9IE1vZHVsZS5fbWFsbG9jID0gTW9kdWxlLmFzbS5tYWxsb2MpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfZnJlZSA9IE1vZHVsZS5fZnJlZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9mcmVlID0gTW9kdWxlLl9mcmVlID0gTW9kdWxlLmFzbS5mcmVlKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgZHluQ2FsbF9qaWppID0gTW9kdWxlLmR5bkNhbGxfamlqaSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKGR5bkNhbGxfamlqaSA9IE1vZHVsZS5keW5DYWxsX2ppamkgPSBNb2R1bGUuYXNtLmR5bkNhbGxfamlqaSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgTW9kdWxlLmNjYWxsID0gY2NhbGw7XG4gICAgTW9kdWxlLnNldFZhbHVlID0gc2V0VmFsdWU7XG4gICAgTW9kdWxlLmdldFZhbHVlID0gZ2V0VmFsdWU7XG4gICAgbGV0IGNhbGxlZFJ1bjtcblxuICAgIGZ1bmN0aW9uIEV4aXRTdGF0dXMoc3RhdHVzKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IFwiRXhpdFN0YXR1c1wiO1xuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBgUHJvZ3JhbSB0ZXJtaW5hdGVkIHdpdGggZXhpdCgkeyAgc3RhdHVzICB9KWA7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzXG4gICAgfVxuICAgIGxldCBjYWxsZWRNYWluID0gZmFsc2U7XG4gICAgZGVwZW5kZW5jaWVzRnVsZmlsbGVkID0gZnVuY3Rpb24gcnVuQ2FsbGVyKCkge1xuICAgICAgICBpZiAoIWNhbGxlZFJ1bikgcnVuKCk7XG4gICAgICAgIGlmICghY2FsbGVkUnVuKSBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBydW5DYWxsZXJcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY2FsbE1haW4oYXJncykge1xuICAgICAgICBjb25zdCBlbnRyeUZ1bmN0aW9uID0gTW9kdWxlLl9tYWluO1xuICAgICAgICBhcmdzID0gYXJncyB8fCBbXTtcbiAgICAgICAgY29uc3QgYXJnYyA9IGFyZ3MubGVuZ3RoICsgMTtcbiAgICAgICAgY29uc3QgYXJndiA9IHN0YWNrQWxsb2MoKGFyZ2MgKyAxKSAqIDQpO1xuICAgICAgICBIRUFQMzJbYXJndiA+PiAyXSA9IGFsbG9jYXRlVVRGOE9uU3RhY2sodGhpc1Byb2dyYW0pO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IGFyZ2M7IGkrKykge1xuICAgICAgICAgICAgSEVBUDMyWyhhcmd2ID4+IDIpICsgaV0gPSBhbGxvY2F0ZVVURjhPblN0YWNrKGFyZ3NbaSAtIDFdKVxuICAgICAgICB9XG4gICAgICAgIEhFQVAzMlsoYXJndiA+PiAyKSArIGFyZ2NdID0gMDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IGVudHJ5RnVuY3Rpb24oYXJnYywgYXJndik7XG4gICAgICAgICAgICBleGl0KHJldCwgdHJ1ZSk7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVFeGNlcHRpb24oZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICAgICAgICAgIGNhbGxlZE1haW4gPSB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBydW4oYXJncykge1xuICAgICAgICBhcmdzID0gYXJncyB8fCBhcmd1bWVudHNfO1xuICAgICAgICBpZiAocnVuRGVwZW5kZW5jaWVzID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgcHJlUnVuKCk7XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRvUnVuKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZFJ1bikgcmV0dXJuO1xuICAgICAgICAgICAgY2FsbGVkUnVuID0gdHJ1ZTtcbiAgICAgICAgICAgIE1vZHVsZS5jYWxsZWRSdW4gPSB0cnVlO1xuICAgICAgICAgICAgaWYgKEFCT1JUKSByZXR1cm47XG4gICAgICAgICAgICBpbml0UnVudGltZSgpO1xuICAgICAgICAgICAgcHJlTWFpbigpO1xuICAgICAgICAgICAgaWYgKE1vZHVsZS5vblJ1bnRpbWVJbml0aWFsaXplZCkgTW9kdWxlLm9uUnVudGltZUluaXRpYWxpemVkKCk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkUnVuTm93KSBjYWxsTWFpbihhcmdzKTtcbiAgICAgICAgICAgIHBvc3RSdW4oKVxuICAgICAgICB9XG4gICAgICAgIGlmIChNb2R1bGUuc2V0U3RhdHVzKSB7XG4gICAgICAgICAgICBNb2R1bGUuc2V0U3RhdHVzKFwiUnVubmluZy4uLlwiKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBNb2R1bGUuc2V0U3RhdHVzKFwiXCIpXG4gICAgICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgICAgICAgICAgZG9SdW4oKVxuICAgICAgICAgICAgfSwgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvUnVuKClcbiAgICAgICAgfVxuICAgIH1cbiAgICBNb2R1bGUucnVuID0gcnVuO1xuXG4gICAgZnVuY3Rpb24gZXhpdChzdGF0dXMpIHtcbiAgICAgICAgRVhJVFNUQVRVUyA9IHN0YXR1cztcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWVtcHR5XG4gICAgICAgIGlmIChrZWVwUnVudGltZUFsaXZlKCkpIHt9IGVsc2Uge1xuICAgICAgICAgICAgZXhpdFJ1bnRpbWUoKVxuICAgICAgICB9XG4gICAgICAgIHByb2NFeGl0KHN0YXR1cylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jRXhpdChjb2RlKSB7XG4gICAgICAgIEVYSVRTVEFUVVMgPSBjb2RlO1xuICAgICAgICBpZiAoIWtlZXBSdW50aW1lQWxpdmUoKSkge1xuICAgICAgICAgICAgaWYgKE1vZHVsZS5vbkV4aXQpIE1vZHVsZS5vbkV4aXQoY29kZSk7XG4gICAgICAgICAgICBBQk9SVCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICBxdWl0Xyhjb2RlLCBuZXcgRXhpdFN0YXR1cyhjb2RlKSlcbiAgICB9XG4gICAgaWYgKE1vZHVsZS5wcmVJbml0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnByZUluaXQgPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnByZUluaXQgPSBbTW9kdWxlLnByZUluaXRdO1xuICAgICAgICB3aGlsZSAoTW9kdWxlLnByZUluaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgTW9kdWxlLnByZUluaXQucG9wKCkoKVxuICAgICAgICB9XG4gICAgfVxuICAgIGxldCBzaG91bGRSdW5Ob3cgPSB0cnVlO1xuICAgIGlmIChNb2R1bGUubm9Jbml0aWFsUnVuKSBzaG91bGRSdW5Ob3cgPSBmYWxzZTtcbiAgICBydW4oKTtcblxuICAgIHJldHVybiBNb2R1bGU7XG59XG4iLG51bGwsbnVsbF0sIm5hbWVzIjpbIlJlbmRlcmVyIiwid2FzbU1hbmFnZXIiLCJwaXhlbERhdGEiLCJjYW1lcmFCdWYiLCJyZW5kZXJDdHgiLCJjb25zdHJ1Y3RvciIsImNyZWF0ZUJvdW5kIiwibW9kZWwiLCJjcmVhdGVCdWZmZXJzIiwidGV4dHVyZSIsIm1hdGVyaWFsIiwiaXNWYWxpZCIsImlkIiwiYnVmZmVyIiwiY2FsbEZ1bmN0aW9uIiwiY2FsbENyZWF0ZUJvdW5kaW5nIiwicG9zaXRpb25CdWZmZXIiLCJsZW5ndGgiLCJpbmRpY2llc0J1ZmZlciIsIm5vcm1hbEJ1ZmZlciIsInRleGNvb3JkQnVmZmVyIiwibWF0cml4QnVmZmVyIiwicmVuZGVyIiwiY2FudmFzIiwiY2FtZXJhIiwid2lkdGgiLCJoZWlnaHQiLCJjdHgiLCJnZXRDb250ZXh0IiwiY29uc29sZSIsImVycm9yIiwiaW1hZ2VkYXRhIiwiY3JlYXRlSW1hZ2VEYXRhIiwicGl4ZWxzIiwiZGF0YSIsInJlbGVhc2UiLCJjcmVhdGVCdWZmZXIiLCJzZXRBcnJheSIsImR1bXBBc0FycmF5IiwiY2FsbFNldENhbWVyYSIsInJlc3VsdCIsImNhbGxQYXRoVHJhY2VyIiwicmVzdWx0MiIsImNhbGxSZWFkU3RyZWFtIiwicmVuZGVyZnVuYyIsInRpbWVyIiwic2V0SW50ZXJ2YWwiLCJpIiwiZ2V0IiwicHV0SW1hZ2VEYXRhIiwiY2xlYXJJbnRlcnZhbCIsInByZXBhcmVQYXJ0aWFsUmVuZGVyaW5nIiwiaW1hZ2VEYXRhIiwicGFydGlhbFJlbmRlcmluZyIsInVwZGF0ZSIsIlZlY3RvcjMiLCJ4IiwieSIsInoiLCJfeCIsIl95IiwiX3oiLCJzZXQiLCJsZW5ndGgyIiwiTWF0aCIsInNxcnQiLCJkaXN0YW5jZSIsImEiLCJhZGQiLCJzdWJ0cmFjdCIsIm11bHRpcGx5IiwiZGl2aWRlIiwiYXNzZXJ0Iiwibm9ybWFsaXplIiwiZG90IiwiY3Jvc3MiLCJlcXVhbCIsImNvcHkiLCJnZXRBcnJheSIsIkZsb2F0MzJBcnJheSIsIlZlY3RvcjQiLCJ3IiwiX3ciLCJNYXRyaXg0IiwibWF0cml4IiwibnVtQXJyYXkiLCJleWUiLCJlbXB0eSIsImZpbGwiLCJzY2FsZU1hdHJpeCIsInNjYWxlIiwidHJhbnNsYXRlTWF0cml4IiwibW92ZSIsIm0iLCJuIiwic3ViIiwibXVsIiwidHJhbnNwb3NlIiwiaW52ZXJzZSIsIm1hdCIsImIiLCJjIiwiZCIsImUiLCJmIiwiZyIsImgiLCJqIiwiayIsImwiLCJvIiwicCIsInEiLCJyIiwicyIsInQiLCJ1IiwidiIsIkEiLCJCIiwiaXZkIiwiRXJyb3IiLCJkZXN0IiwiZ2V0U2NhbGVSb3RhdGlvbk1hdHJpeCIsImdldFRyYW5zbGF0ZVZlY3RvciIsIlF1YXRlcm5pb24iLCJhbmdsZUF4aXMiLCJhbmdsZSIsIl9heGlzIiwiYXhpcyIsInNpbiIsImNvcyIsImV1bGFyQW5nbGUiLCJyb3QiLCJ4YyIsInhzIiwieWMiLCJ5cyIsInpjIiwienMiLCJmcm9tTWF0cml4IiwibTAwIiwibTEwIiwibTIwIiwibTAxIiwibTExIiwibTIxIiwibTAyIiwibTEyIiwibTIyIiwiZWxlbWVudCIsIm1heEluZGV4IiwibGVuIiwiVHJhbnNmb3JtIiwicm90YXRpb24iLCJwb3NpdGlvbiIsInRyYW5zbGF0ZSIsIk1vZGVsIiwiX3Bvc2l0aW9uIiwiX3Bvc2l0aW9uQnVmZmVyIiwiX25vcm1hbCIsIl9ub3JtYWxCdWZmZXIiLCJfdGV4Y29vcmQiLCJfdGV4Y29vcmRCdWZmZXIiLCJfaW5kaWNpZXMiLCJJbnQzMkFycmF5IiwiX2luZGljaWVzQnVmZmVyIiwiX2JvdW5kaW5nQm94IiwibWluIiwibWF4IiwiX21hdHJpeCIsIl9tYXRyaXhCdWZmZXIiLCJfdHJhbnNmb3JtIiwiX21hdGVyaWFsIiwiY3JlYXRlQm91bmRpbmdCb3giLCJwb3MiLCJ0cmFuc2Zvcm0iLCJub3JtYWwiLCJ0ZXhjb29yZCIsImluZGljaWVzIiwibWFuYWdlciIsImNvbmNhdCIsImJvdW5kaW5nQm94IiwiR0xURkxvYWRlciIsInJhd0pzb24iLCJsb2FkIiwidXJsIiwicmVzcG9uc2UiLCJmZXRjaCIsImhlYWRlcnMiLCJqc29uIiwiYW5hbGl6ZSIsIm5vZGVzIiwibWVzaGVzIiwiYWNjZXNzb3JzIiwiYnVmZmVyVmlld3MiLCJidWZmZXJzIiwiQXJyYXkiLCJpc0FycmF5Iiwibm9kZSIsInByaW1pdGl2ZXMiLCJwcmltaXRpdmUiLCJidWZQb3MiLCJhdHRyaWJ1dGVzIiwiUE9TSVRJT04iLCJidWZOb3JtIiwiTk9STUFMIiwiYnVmVGV4IiwiVEVYQ09PUkRfMCIsImJ1ZkluZCIsImluZGljZXMiLCJ1cmkiLCJ0cmFuc2xhdGlvbiIsImJsb2IiLCJhcnJheUJ1ZmZlciIsImJ5dGVPZmZzZXQiLCJieXRlTGVuZ3RoIiwiZnJvbSIsIkludDE2QXJyYXkiLCJNQVRFUklBTF9VTklGT1JNX0xFTkdUSCIsIk1hdGVyaWFsIiwiX21hdGVyaWFsQnVmZmVyIiwiY3JlYXRlT3B0aW9uQXJyYXkiLCJHbGFzcyIsIl9yaG8iLCJyaG8iLCJEaWZmdXNlIiwiY29sb3IiLCJDYW1lcmEiLCJfcG9zIiwiX2ZvcndhcmQiLCJfdG9wIiwiX3JpZ2h0IiwiX2Rpc3QiLCJ2aWV3QW5nbGUiLCJ0YW4iLCJmb3J3YXJkIiwicmlnaHQiLCJ0b3AiLCJkaXN0IiwiYXRhbiIsImxvb2tBdCIsInRvIiwiSU1BR0VfU0laRSIsIlRleHR1cmUiLCJpbWFnZSIsImltYWdlQXJyYXkiLCJ2YWxpZCIsIl9idWZmZXIiLCJzZXRUZXh0dXJlIiwiY252IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiZHJhd0ltYWdlIiwiZ2V0SW1hZ2VEYXRhIiwid2FzbSIsIldhc21CdWZmZXIiLCJfbW9kdWxlIiwiX2Jhc2UiLCJfdHlwZSIsIl9zdHJpZGUiLCJfbGVuZ3RoIiwidHlwZSIsIm1vZHVsZSIsInNpemUiLCJfbWFsbG9jIiwiaW5kZXgiLCJnZXRWYWx1ZSIsInZhbHVlIiwic2V0VmFsdWUiLCJhcnJheSIsImZvckVhY2giLCJnZXRQb2ludGVyIiwiX2ZyZWUiLCJXYXNtTW9kdWxlR2VuZXJhdG9yIiwid29ya2VyR2xvYmFsU2NvcGUiLCJNb2R1bGUiLCJhcmd1bWVudHNfIiwidGhpc1Byb2dyYW0iLCJxdWl0XyIsInN0YXR1cyIsInRvVGhyb3ciLCJFTlZJUk9OTUVOVF9JU19XRUIiLCJ3aW5kb3ciLCJFTlZJUk9OTUVOVF9JU19XT1JLRVIiLCJpbXBvcnRTY3JpcHRzIiwiRU5WSVJPTk1FTlRfSVNfTk9ERSIsInByb2Nlc3MiLCJ2ZXJzaW9ucyIsInNjcmlwdERpcmVjdG9yeSIsImxvY2F0ZUZpbGUiLCJwYXRoIiwicmVhZF8iLCJyZWFkQXN5bmMiLCJyZWFkQmluYXJ5IiwibG9nRXhjZXB0aW9uT25FeGl0IiwiRXhpdFN0YXR1cyIsInRvTG9nIiwiZXJyIiwibm9kZUZTIiwibm9kZVBhdGgiLCJyZXF1aXJlIiwiZGlybmFtZSIsIl9fZGlybmFtZSIsInNoZWxsX3JlYWQiLCJmaWxlbmFtZSIsImJpbmFyeSIsInJlYWRGaWxlU3luYyIsInJldCIsIlVpbnQ4QXJyYXkiLCJvbmxvYWQiLCJvbmVycm9yIiwicmVhZEZpbGUiLCJhcmd2IiwicmVwbGFjZSIsInNsaWNlIiwiZXhwb3J0cyIsIm9uIiwiZXgiLCJyZWFzb24iLCJrZWVwUnVudGltZUFsaXZlIiwiZXhpdENvZGUiLCJleGl0IiwiaW5zcGVjdCIsInNlbGYiLCJsb2NhdGlvbiIsImhyZWYiLCJjdXJyZW50U2NyaXB0Iiwic3JjIiwiaW5kZXhPZiIsInN1YnN0ciIsImxhc3RJbmRleE9mIiwieGhyIiwiWE1MSHR0cFJlcXVlc3QiLCJvcGVuIiwic2VuZCIsInJlc3BvbnNlVGV4dCIsInJlc3BvbnNlVHlwZSIsIm91dCIsInByaW50IiwibG9nIiwiYmluZCIsInByaW50RXJyIiwid2FybiIsImFyZ3VtZW50cyIsInF1aXQiLCJiYXNlNjRUb0FycmF5QnVmZmVyIiwiYmFzZTY0IiwiYmluYXJ5X3N0cmluZyIsIkJ1ZmZlciIsInRvU3RyaW5nIiwiYXRvYiIsImJ5dGVzIiwiY2hhckNvZGVBdCIsIndhc21CaW5hcnkiLCJtYWluV2FzbSIsIm5vRXhpdFJ1bnRpbWUiLCJXZWJBc3NlbWJseSIsImFib3J0IiwicHRyIiwiY2hhckF0IiwiSEVBUDgiLCJIRUFQMTYiLCJIRUFQMzIiLCJ0ZW1wSTY0IiwidGVtcERvdWJsZSIsImFicyIsImZsb29yIiwiY2VpbCIsIkhFQVBGMzIiLCJIRUFQRjY0IiwiTnVtYmVyIiwid2FzbU1lbW9yeSIsIkFCT1JUIiwiRVhJVFNUQVRVUyIsImNvbmRpdGlvbiIsInRleHQiLCJnZXRDRnVuYyIsImlkZW50IiwiZnVuYyIsImNjYWxsIiwicmV0dXJuVHlwZSIsImFyZ1R5cGVzIiwiYXJncyIsInRvQyIsInN0ciIsInVuZGVmaW5lZCIsInN0YWNrQWxsb2MiLCJzdHJpbmdUb1VURjgiLCJhcnIiLCJ3cml0ZUFycmF5VG9NZW1vcnkiLCJjb252ZXJ0UmV0dXJuVmFsdWUiLCJVVEY4VG9TdHJpbmciLCJCb29sZWFuIiwiY0FyZ3MiLCJzdGFjayIsImNvbnZlcnRlciIsInN0YWNrU2F2ZSIsIm9uRG9uZSIsInN0YWNrUmVzdG9yZSIsIlVURjhEZWNvZGVyIiwiVGV4dERlY29kZXIiLCJVVEY4QXJyYXlUb1N0cmluZyIsImhlYXAiLCJpZHgiLCJtYXhCeXRlc1RvUmVhZCIsImVuZElkeCIsImVuZFB0ciIsInN1YmFycmF5IiwiZGVjb2RlIiwidTAiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJ1MSIsInUyIiwiY2giLCJIRUFQVTgiLCJzdHJpbmdUb1VURjhBcnJheSIsIm91dElkeCIsIm1heEJ5dGVzVG9Xcml0ZSIsInN0YXJ0SWR4Iiwib3V0UHRyIiwibGVuZ3RoQnl0ZXNVVEY4IiwiYWxsb2NhdGVVVEY4T25TdGFjayIsImFsaWduVXAiLCJtdWx0aXBsZSIsInVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzIiwiYnVmIiwiSW50OEFycmF5IiwiSEVBUFUxNiIsIlVpbnQxNkFycmF5IiwiSEVBUFUzMiIsIlVpbnQzMkFycmF5IiwiRmxvYXQ2NEFycmF5Iiwid2FzbVRhYmxlIiwiX19BVFBSRVJVTl9fIiwiX19BVElOSVRfXyIsIl9fQVRNQUlOX18iLCJfX0FUUE9TVFJVTl9fIiwicnVudGltZUtlZXBhbGl2ZUNvdW50ZXIiLCJwcmVSdW4iLCJhZGRPblByZVJ1biIsInNoaWZ0IiwiY2FsbFJ1bnRpbWVDYWxsYmFja3MiLCJpbml0UnVudGltZSIsInByZU1haW4iLCJwb3N0UnVuIiwiYWRkT25Qb3N0UnVuIiwiY2IiLCJ1bnNoaWZ0IiwiYWRkT25Jbml0IiwicnVuRGVwZW5kZW5jaWVzIiwiZGVwZW5kZW5jaWVzRnVsZmlsbGVkIiwiYWRkUnVuRGVwZW5kZW5jeSIsIm1vbml0b3JSdW5EZXBlbmRlbmNpZXMiLCJyZW1vdmVSdW5EZXBlbmRlbmN5IiwiY2FsbGJhY2siLCJwcmVsb2FkZWRJbWFnZXMiLCJwcmVsb2FkZWRBdWRpb3MiLCJ3aGF0Iiwib25BYm9ydCIsIlJ1bnRpbWVFcnJvciIsImRhdGFVUklQcmVmaXgiLCJpc0RhdGFVUkkiLCJzdGFydHNXaXRoIiwiaXNGaWxlVVJJIiwid2FzbUJpbmFyeUZpbGUiLCJnZXRCaW5hcnkiLCJmaWxlIiwiZ2V0QmluYXJ5UHJvbWlzZSIsImNyZWRlbnRpYWxzIiwidGhlbiIsIm9rIiwiY2F0Y2giLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNyZWF0ZVdhc20iLCJpbmZvIiwiYXNtTGlicmFyeUFyZyIsInJlY2VpdmVJbnN0YW5jZSIsImluc3RhbmNlIiwiYXNtIiwibWVtb3J5IiwiX19pbmRpcmVjdF9mdW5jdGlvbl90YWJsZSIsIl9fd2FzbV9jYWxsX2N0b3JzIiwicmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQiLCJpbnN0YW50aWF0ZUFycmF5QnVmZmVyIiwicmVjZWl2ZXIiLCJpbnN0YW50aWF0ZSIsImluc3RhbnRpYXRlQXN5bmMiLCJpbnN0YW50aWF0ZVN0cmVhbWluZyIsImluc3RhbnRpYXRlV2FzbSIsImNhbGxiYWNrcyIsImFyZyIsImdldFdhc21UYWJsZUVudHJ5Iiwid2FzbVRhYmxlTWlycm9yIiwiZnVuY1B0ciIsImhhbmRsZUV4Y2VwdGlvbiIsIl9fX2Fzc2VydF9mYWlsIiwibGluZSIsIl9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24iLCJfYXRleGl0IiwiX19fY3hhX2F0ZXhpdCIsImEwIiwiYTEiLCJFeGNlcHRpb25JbmZvIiwiZXhjUHRyIiwic2V0X3R5cGUiLCJnZXRfdHlwZSIsInNldF9kZXN0cnVjdG9yIiwiZGVzdHJ1Y3RvciIsImdldF9kZXN0cnVjdG9yIiwic2V0X3JlZmNvdW50IiwicmVmY291bnQiLCJzZXRfY2F1Z2h0IiwiY2F1Z2h0IiwiZ2V0X2NhdWdodCIsInNldF9yZXRocm93biIsInJldGhyb3duIiwiZ2V0X3JldGhyb3duIiwiaW5pdCIsImFkZF9yZWYiLCJyZWxlYXNlX3JlZiIsInByZXYiLCJfX19jeGFfdGhyb3ciLCJfYWJvcnQiLCJfZW1zY3JpcHRlbl9tZW1jcHlfYmlnIiwibnVtIiwiY29weVdpdGhpbiIsImVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIiLCJncm93IiwiX2Vtc2NyaXB0ZW5fcmVzaXplX2hlYXAiLCJyZXF1ZXN0ZWRTaXplIiwib2xkU2l6ZSIsIm1heEhlYXBTaXplIiwiY3V0RG93biIsIm92ZXJHcm93bkhlYXBTaXplIiwibmV3U2l6ZSIsInJlcGxhY2VtZW50IiwiU1lTQ0FMTFMiLCJtYXBwaW5ncyIsInByaW50Q2hhciIsInN0cmVhbSIsImN1cnIiLCJwdXNoIiwidmFyYXJncyIsImdldFN0ciIsImdldDY0IiwibG93IiwiX2ZkX3dyaXRlIiwiZmQiLCJpb3YiLCJpb3ZjbnQiLCJwbnVtIiwiX3NldFRlbXBSZXQwIiwidmFsIiwiX19fd2FzbV9jYWxsX2N0b3JzIiwiYXBwbHkiLCJfbWFpbiIsIm1haW4iLCJfY3JlYXRlVGV4dHVyZSIsImNyZWF0ZVRleHR1cmUiLCJfY3JlYXRlQm91bmRpbmciLCJjcmVhdGVCb3VuZGluZyIsIl9zZXRDYW1lcmEiLCJzZXRDYW1lcmEiLCJfcmVhZFN0cmVhbSIsInJlYWRTdHJlYW0iLCJfcGF0aFRyYWNlciIsInBhdGhUcmFjZXIiLCJfX19lcnJub19sb2NhdGlvbiIsIl9fZXJybm9fbG9jYXRpb24iLCJtYWxsb2MiLCJmcmVlIiwiZHluQ2FsbF9qaWppIiwiY2FsbGVkUnVuIiwibmFtZSIsIm1lc3NhZ2UiLCJydW5DYWxsZXIiLCJydW4iLCJjYWxsTWFpbiIsImVudHJ5RnVuY3Rpb24iLCJhcmdjIiwiZG9SdW4iLCJvblJ1bnRpbWVJbml0aWFsaXplZCIsInNob3VsZFJ1bk5vdyIsInNldFN0YXR1cyIsInNldFRpbWVvdXQiLCJwcm9jRXhpdCIsImNvZGUiLCJvbkV4aXQiLCJwcmVJbml0IiwicG9wIiwibm9Jbml0aWFsUnVuIiwiV2FzbU1hbmFnZXIiLCJFdmVudFRhcmdldCIsImRpc3BhdGNoRXZlbnQiLCJFdmVudCIsImZ1bmNuYW1lIiwicmF3QXJncyIsIm1hcCIsIlZlY3RvcjIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7SUFLQTs7Ozs7O1VBTWFBO0lBQ0hDLEVBQUFBLFdBQVc7SUFFWEMsRUFBQUEsU0FBUyxHQUFzQixJQUF0QjtJQUVUQyxFQUFBQSxTQUFTLEdBQXNCLElBQXRCOztJQUdUQyxFQUFBQSxTQUFTLEdBTU4sSUFOTTtJQVFqQjs7Ozs7OztJQU1BQyxFQUFBQSxZQUFZSjtJQUNWLFNBQUtBLFdBQUwsR0FBbUJBLFdBQW5CO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNT0ssRUFBQUEsV0FBVyxDQUFDQyxLQUFEO0lBQ2hCQSxJQUFBQSxLQUFLLENBQUNDLGFBQU4sQ0FBb0IsS0FBS1AsV0FBekI7SUFFQSxVQUFNO0lBQUNRLE1BQUFBO0lBQUQsUUFBWUYsS0FBSyxDQUFDRyxRQUF4Qjs7SUFFQSxRQUFHRCxPQUFPLElBQUlBLE9BQU8sQ0FBQ0UsT0FBUixFQUFYLElBQWdDRixPQUFPLENBQUNHLEVBQVIsR0FBYSxDQUE3QyxJQUFrREgsT0FBTyxDQUFDSSxNQUE3RCxFQUFzRTtJQUNwRSxZQUFNRCxFQUFFLEdBQUcsS0FBS1gsV0FBTCxDQUFpQmEs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
