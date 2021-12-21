
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
              return;
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

    var mainWasm = "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EEggCkEMbkEMbGoFIAALNgKEAgsgB0GAAWogB0GgA2pBgAEQSBogByAHQaACakGAARBIIgdBkAJqIQEgB0GAAmohAyAHQYABaiEKIAchACMAQeACayICJABB4OwAKAIAIQZB5OwAKAIAIQQgAkIANwPYAiACQgA3A9ACIAJBADYCwAIgAkIANwO4AiACQgA3A8gCIAQgBmtBoAJtIQYCQAJAAkACQAJAAkACQCABKAIEIAEoAgAiCWsiAQRAIAFBAEgNASACIAEQKyIENgK4AiACIAQgAUEGdUEGdGo2AsACIAIgBCAJIAEQSCABajYCvAILIAJBADYCsAIgAkIANwOoAiADKAIEIAMoAgAiCWsiAUEMbSEEIAEEQCAEQdaq1aoBTw0CIAIgARArIgM2AqgCIAIgAyAEQQxsajYCsAIgAiABQQBKBH8gAyAJIAEQSCABQQxuQQxsagUgAws2AqwCCyACQagCaiEOIwBBEGsiDCQAIAJByAJqIgMgAkG4AmoiAUcEQAJAIAEoAgQiECABKAIAIglrIgRBBnUiDSADKAIIIg8gAygCACIBa0EGdU0EQCAJIAMoAgQgAWsiBGogECANIARBBnUiD0sbIhEgCWsiBARAIAEgCSAEEEoaCyANIA9LBEAgAygCBCEJIAMgECARayIBQQBKBH8gCSARIAEQSCABagUgCQs2AgQMAgsgAyABIARqNgIEDAELIAEEQCADIAE2AgQgARBAIANBADYCCCADQgA3AgBBACEPCwJAIARBAEgNACANIA9BBXUiASABIA1JG0H///8fIA9BBnVB////D0kbIgFBgICAIE8NACADIAFBBnQiDRArIgE2AgAgAyABNgIEIAMgASANajYCCCADIAQEfyABIAkgBBBIIARqBSABCzYCBAwBCxAqAAsLIAMgAygCDDYCECADQQxqQQEQFSAMQQA2AgggDEIANwMAIA4oAgQgDigCACIJayIBQQxtIQQCQAJAIAEEQCAEQdaq1aoBTw0BIAwgARArIg42AgAgDCAOIARBDGxqNgIIIAwgAUEASgR/IA4gCSABEEggAUEMbkEMbGoFIA4LNgIECyADIAxBABAWIAwoAgAiAwRAIAwgAzYCBCADEEALIAxBEGokAAwBCxAqAAsgAigCqAIiAQRAIAIgATYCrAIgARBACyACKAK4AiIBBEAg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aisDACAGIAIgBGpBA3RqKwMAoiAAoCEAIAIgCU4NACACIA9JIQUgAkEBaiECIAUNAQsLIAZBoAFqIA9BA3RqIAA5AwAgBEEBayECIARBAEoNAAsLRAAAAAAAAAAAIQAgA0EATgRAIAMhBQNAIAUiAkEBayEFIAAgBkGgAWogAkEDdGorAwCgIQAgAg0ACwsgByAAmiAAIA4bOQMAIAYrA6ABIAChIQBBASECIANBAEoEQANAIAAgBkGgAWogAkEDdGorAwCgIQAgAiADRyEFIAJBAWohAiAFDQALCyAHIACaIAAgDhs5AwggBkGwBGokACANQQdxIQMgBysDACEAIBpCAFMEQCABIACaOQMAIAEgBysDCJo5AwhBACADayEDDAELIAEgADkDACABIAcrAwg5AwgLIAdBMGokACADC8EBAQJ/IwBBEGsiASQAAnwgAL1CIIinQf////8HcSICQfvDpP8DTQRARAAAAAAAAPA/IAJBnsGa8gNJDQEaIABEAAAAAAAAAAAQHgwBCyAAIAChIAJBgIDA/wdPDQAaAkACQAJAAkAgACABEBxBA3EOAwABAgMLIAErAwAgASsDCBAeDAMLIAErAwAgASsDCEEBECCaDAILIAErAwAgASsDCBAemgwBCyABKwMAIAErAwhBARAgCyEAIAFBEGokACAAC5IBAQN8RAAAAAAAAPA/IAAgAKIiAkQAAAAAAADgP6IiA6EiBEQAAAAAAADwPyAEoSADoSACIAIgAiACRJAVyxmgAfo+okR3UcEWbMFWv6CiRExVVVVVVaU/oKIgAiACoiIDIAOiIAIgAkTUOIi+6fqovaJExLG0vZ7uIT6gokStUpyAT36SvqCioKIgACABoqGgoAvFAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAwPIDSQ0BIABEAAAAAAAAAABBABAgIQAMAQsgAkGAgMD/B08EQCAAIAChIQAMAQsCQAJAAkACQCAAIAEQHEEDcQ4DAAECAwsgASsDACABKwMIQQEQICEADAMLIAErAwAgASsDCBAeIQAMAgsgASsDACABKwMIQQEQIJohAAwBCyABKwMAIAErAwgQHpohAAsgAUEQaiQAIAALmQEBA3wgACAAoiIDIAMgA6KiIANEfNXPWjrZ5T2iROucK4rm5Vq+oKIgAyADRH3+sVfjHcc+okTVYcEZoAEqv6CiRKb4EBEREYE/oKAhBSADIACiIQQgAkUEQCAEIAMgBaJESVVVVVVVxb+goiAAoA8LIAAgAyABRAAAAAAAAOA/oiAFIASioaIgAaEgBERJVVVVVVXFP6KgoQuNAQAgACAAIAAgACAARAn3/Q3hPQI/okSIsgF14O9JP6CiRDuPaLUogqS/oKJEVUSIDlXByT+gokR9b+sDEtbUv6CiRFVVVVVVVcU/oCAAoiAAIAAgACAARIKSLrHFuLM/okRZAY0bbAbmv6CiRMiKWZzlKgBAoKJESy2KHCc6A8CgokQAAAAAAADwP6CjC6QGAQZ/A0AgAUEIayEIA0AgACEDA0ACQAJ/AkACQAJAAkACQAJAAkAgASADayIAQQN1IgQOBggIAAQBAgMLIAFBCGsiACADECNFDQcgAyAAECQPCyADIANBCGogA0EQaiABQQhrECUaDwsgAyADQQhqIANBEGogA0EYaiABQQhrECYaDwsgAEH3AUwEQCABIQYjAEEQayIEJAAgAyADQQhqIANBEGoiAhAnGiADQRhqIQEDQCABIAZHBEAgASACECMEQCAEIAErAwA5AwggASEAA0ACQCAAIAIiACsDADkDACAAIANGBEAgAyEADAELIARBCGogAEEIayICECMNAQsLIAAgBEEIaisDADkDAAsgASECIAFBCGohAQwBCwsgBEEQaiQADwsgAyAEQQJtQQN0aiEFAn8gAEG5Pk8EQCADIAMgBEEEbUEDdCIAaiAFIAAgBWogCBAmDAELIAMgBSAIECcLIQcgCCEAIAMgBRAjRQRAA0AgAEEIayIAIANGBEAgA0EIaiEEIAMgCBAjDQUDQCAEIAhGDQggAyAEECMEQCAEIAgQJCAEQQhqIQQMBwUgBEEIaiEEDAELAAsACyAAIAUQI0UNAAsgAyAAECQgB0EBaiEHCyADQQhqIgYgAE8NAQNAIAYiBEEIaiEGIAQgBRAjDQADQCAAQQhrIgAgBRAjRQ0ACyAAIARJBEAgBCEGDAMFIAQgABAkIAAgBSAEIAVGGyEFIAdBAWohBwwBCwALAAsgAyADQQhqIAFBCGsQJxoMAwsCQCAFIAZGDQAgBSAGECNFDQAgBiAFECQgB0EBaiEHCyAHRQRAIAMgBhAoIQQgBkEIaiIAIAEQKARAIAYhASADIQAgBEUNBwwEC0ECIAQNAhoLIAYgA2sgASAGa0gEQCADIAYgAhAiIAZBCGohAAwFCyAGQQhqIAEgAhAiIAYhASADIQAMBQsgBCAIIgVGDQEDfyAEIgBBCGohBCADIAAQI0UNAANAIAMgBUEIayIFECMNAAsgACAFTwR/QQQFIAAgBRAkDAELCwshBSAAIQMgBUECaw4DAgABAAsLCwsLDQAgACsDACABKwMAYws1AQF/IwBBEGsiAiQAIAIgACsDADkDCCAAIAErAwA5AwAgASACQQhqKwMAOQMAIAJBEGokAAtRAQF/IAAgASACECchBCADIAIQIwR/IAIgAxAkIAIgARAjRQRAIARBAWoPCyABIAIQJCABIAAQI0UEQCAEQQJqDwsgACABECQgBEEDagUgBAsLaQEBfyAAIAEgAiADECUhBSAEIAMQIwR/IAMgBBAkIAMgAhAjRQRAIAVBAWoPCyACIAMQJCACIAEQI0UEQCAFQQJqDwsgASACECQgASAAECNFBEAgBUEDag8LIAAgARAkIAVBBGoFIAULC2oBAn8gASAAECMhBCACIAEQIyEDAn8CQCAERQRAQQAgA0UNAhogASACECRBASABIAAQI0UNAhogACABECQMAQsgAwRAIAAgAhAkQQEPCyAAIAEQJEEBIAIgARAjRQ0BGiABIAIQJAtBAgsLsQIBBn8jAEEQayIEJABBASEGAkACQAJAAkACQAJAIAEgAGtBA3UOBgUFAAECAwQLIAFBCGsiAiAAECNFDQQgACACECQMBAsgACAAQQhqIAFBCGsQJxoMAwsgACAAQQhqIABBEGogAUEIaxAlGgwCCyAAIABBCGogAEEQaiAAQRhqIAFBCGsQJhoMAQsgACAAQQhqIABBEGoiBRAnGiAAQRhqIQMDQCABIANGDQECQCADIAUQIwRAIAQgAysDADkDCCADIQIDQAJAIAIgBSICKwMAOQMAIAAgAkYEQCAAIQIMAQsgBEEIaiACQQhrIgUQIw0BCwsgAiAEQQhqKwMAOQMAIAdBAWoiB0EIRg0BCyADIQUgA0EIaiEDDAELCyADQQhqIAFGIQYLIARBEGokACAGCwQAIAALCABBmAgQDQALMwEBfyAAQQEgABshAQJAA0AgARA/IgANAUGY7QAoAgAiAARAIAARCAAMAQsLEAMACyAA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";

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
