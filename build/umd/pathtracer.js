
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

        console.log('start calc');
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
              console.log('end calc');
              clearInterval(timer);
              return;
            }

            console.log("waiting");
          }, 100);

          for (let i = 0; i < pixels.length; i += 1) {
            imagedata.data[i] = this.pixelData.get(i);
          }

          this.pixelData.release();
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
      color;
      texture = null;
      _materialBuffer = null;

      get buffer() {
        return this._materialBuffer;
      }

      constructor(color = new Vector3(1.0), texture = null) {
        this.color = color;
        this.texture = texture;
      }

      createBuffers(manager) {
        var _this$texture, _this$_materialBuffer;

        (_this$texture = this.texture) === null || _this$texture === void 0 ? void 0 : _this$texture.createBuffer(manager);
        if (!this._materialBuffer) this._materialBuffer = manager.createBuffer('float', MATERIAL_UNIFORM_LENGTH);
        (_this$_materialBuffer = this._materialBuffer) === null || _this$_materialBuffer === void 0 ? void 0 : _this$_materialBuffer.setArray([0, this.texture ? this.texture.id : -1, this.color.x, this.color.y, this.color.z]);
      }

      release() {
        var _this$_materialBuffer2;

        (_this$_materialBuffer2 = this._materialBuffer) === null || _this$_materialBuffer2 === void 0 ? void 0 : _this$_materialBuffer2.release();
        this._materialBuffer = null;
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

    var mainWasm = "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QAJAIAEoAgAiBCAAKAIAIgVIDQACQCAFIARIDQAgASsDCCIIIAArAwgiCWMNASAJIAhjDQAgASgCECAAKAIQSA0BCwJAAkAgAigCACIGIARODQAgAisDCCEIIAErAwghCQwBC0EAIQUgBCAGSA0EIAIrAwgiCCABKwMIIgljDQAgCSAIYw0EIAIoAhAgASgCEE4NBAsgASAGNgIAIAIgBDYCACABIAg5AwggAiAJOQMIIAEoAhAhBCABIAIoAhA2AhAgAiAENgIQIAFBEGohAgJAAkAgASgCACIEIAAoAgAiBk4NACABKwMIIQggACsDCCEJDAELQQEhBSAGIARIDQQgASsDCCIIIAArAwgiCWMNACAJIAhjDQQgAigCACAAKAIQTg0ECyAAIAQ2AgAgASAGNgIAIAAgCDkDCCABIAk5AwggAEEQaiEADAELAkACQAJAIAIoAgAiBiAETg0AIAIrAwghCAwBCwJAIAQgBk4NACABKwMIIQkMAgsgAisDCCIIIAErAwgiCWMNACAJIAhjDQEgAigCECABKAIQTg0BCyAAIAY2AgAgAiAFNgIAIAArAwghCSAAIAg5AwggAiAJOQMIIAJBEGohAiAAQRBqIQBBASEFDAILIAAgBDYCACABIAU2AgAgACsDCCEIIAAgCTkDCCABIAg5AwggACgCECEHIAAgASgCEDYCECABIAc2AhACQAJAIAIoAgAiBCABKAIAIgZODQAgAisDCCEJDAELQQEhBSAGIARIDQMgAisDCCIJIAhjDQAgCCAJYw0DIAIoAhAgB04NAwsgAUEQaiEAIAEgBDYCACACIAY2AgAgASAJOQMIIAIgCDkDCCACQRBqIQILQQIhBQsgACgCACEBIAAgAigCADYCACACIAE2AgALIAUL0QMCAn8CfCAAIAEgAiAEECghBAJAAkAgAygCACIFIAIoAgAiBk4NACADKwMIIQcgAisDCCEIDAELAkAgBiAFTg0AIAQPCyADKwMIIgcgAisDCCIIYw0AAkAgCCAHY0UNACAEDwsgAygCECACKAIQSA0AIAQPCyACIAU2AgAgAyAGNgIAIAIgBzkDCCADIAg5AwggAigCECEFIAIgAygCEDYCECADIAU2AhACQAJAAkAgAigCACIFIAEoAgAiBk4NACACKwMIIQcgASsDCCEIDAELIARBAWohAyAGIAVIDQEgAisDCCIHIAErAwgiCGMNACAIIAdjDQEgAigCECABKAIQTg0BCyABIAU2AgAgAiAGNgIAIAEgBzkDCCACIAg5AwggASgCECEDIAEgAigCEDYCECACIAM2AhACQAJAIAEoAgAiAiAAKAIAIgVODQAgASsDCCEHIAArAwghCAwBCyAEQQJqIQMgBSACSA0BIAErAwgiByAAKwMIIghjDQAgCCAHYw0BIAEoAhAgACgCEE4NAQsgACACNgIAIAEgBTYCACAAIAc5AwggASAIOQMIIAAoAhAhAiAAIAEoAhA2AhAgASACNgIQIARBA2ohAwsgAwvhBAICfwJ8IAAgASACIAMgBRApIQUCQAJAIAQoAgAiBiADKAIAIgdODQAgBCsDCCEIIAMrAwghCQwBCwJAIAcgBk4NACAFDwsgBCsDCCIIIAMrAwgiCWMNAAJAIAkgCGNFDQAgBQ8LIAQoAhAgAygCEEgNACAFDwsgAyAGNgIAIAQgBzYCACADIAg5AwggBCAJOQMIIAMoAhAhBiADIAQoAhA2AhAgBCAGNgIQAkACQAJAIAMoAgAiBiACKAIAIgdODQAgAysDCCEIIAIrAwghCQwBCyAFQQFqIQQgByAGSA0BIAMrAwgiCCACKwMIIgljDQAgCSAIYw0BIAMoAhAgAigCEE4NAQsgAiAGNgIAIAMgBzYCACACIAg5AwggAyAJOQMIIAIoAhAhBCACIAMoAhA2AhAgAyAENgIQAkACQCACKAIAIgMgASgCACIGTg0AIAIrAwghCCABKwMIIQkMAQsgBUECaiEEIAYgA0gNASACKwMIIgggASsDCCIJYw0AIAkgCGMNASACKAIQIAEoAhBODQELIAEgAzYCACACIAY2AgAgASAIOQMIIAIgCTkDCCABKAIQIQMgASACKAIQNgIQIAIgAzYCEAJAAkAgASgCACIDIAAoAgAiAk4NACABKwMIIQggACsDCCEJDAELIAVBA2ohBCACIANIDQEgASsDCCIIIAArAwgiCWMNACAJIAhjDQEgASgCECAAKAIQTg0BCyAAIAM2AgAgASACNgIAIAAgCDkDCCABIAk5AwggACgCECEDIAAgASgCEDYCECABIAM2AhAgBUEEaiEECyAEC84CAgV/AnwgACAAQRhqIABBMGoiAyACECgaAkAgAEHIAGoiAiABRg0AA0AgAyEEAkACQAJAIAIiAygCACIFIAQoAgAiAk4NACAEKwMIIQggAysDCCEJDAELIAIgBUgNASADKwMIIgkgBCsDCCIIYw0AIAggCWMNASADKAIQIAQoAhBODQELIAMgCDkDCCADIAI2AgAgAygCECEGIAMgBCgCEDYCECAAIQICQCAEIABGDQADQAJAAkAgBSAEIgJBaGoiBCgCACIHTg0AIAJBcGorAwAhCAwBCyAHIAVIDQIgCSACQXBqKwMAIghjDQAgCCAJYw0CIAYgAkF4aigCAE4NAgsgAiAIOQMIIAIgBzYCACACIAJBeGooAgA2AhAgBCAARw0ACyAAIQILIAIgBjYCECACIAk5AwggAiAFNgIACyADQRhqIgIgAUcNAAsLC4AFAgZ/AnxBASEDAkACQAJAAkACQAJAIAEgAGtBGG0OBgUFAAECAwQLAkACQCABQWhqIgQoAgAiAiAAKAIAIgVODQAgAUFwaisDACEJIAArAwghCgwBCyAFIAJIDQUgAUFwaisDACIJIAArAwgiCmMNACAKIAljDQUgAUF4aigCACAAKAIQTg0FCyAAIAI2AgAgBCAFNgIAIAAgCTkDCCABQXBqIAo5AwAgACgCECECIAAgAUF4aiIDKAIANgIQIAMgAjYCAEEBDwsgACAAQRhqIAFBaGogAhAoGkEBDwsgACAAQRhqIABBMGogAUFoaiACECkaQQEPCyAAIABBGGogAEEwaiAAQcgAaiABQWhqIAIQKhpBAQ8LIAAgAEEYaiAAQTBqIgYgAhAoGiAAQcgAaiICIAFGDQBBACEHAkADQCAGIQMCQAJAAkAgAiIGKAIAIgQgAygCACICTg0AIAMrAwghCSAGKwMIIQoMAQsgAiAESA0BIAYrAwgiCiADKwMIIgljDQAgCSAKYw0BIAYoAhAgAygCEE4NAQsgBiAJOQMIIAYgAjYCACAGKAIQIQggBiADKAIQNgIQIAAhAgJAIAMgAEYNAANAAkACQCAEIAMiAkFoaiIDKAIAIgVODQAgAkFwaisDACEJDAELIAUgBEgNAiAKIAJBcGorAwAiCWMNACAJIApjDQIgCCACQXhqKAIATg0CCyACIAk5AwggAiAFNgIAIAIgAkF4aigCADYCECADIABHDQALIAAhAgsgAiAINgIQIAIgCjkDCCACIAQ2AgAgB0EBaiIHQQhGDQILIAZBGGoiAiABRw0AC0EBDwsgBkEYaiABRiEDCyADC5oEAQN/QYy7nbQEIQBBAEGMu520BDYCkFhBASEBAkADQEGQ2AAgAUECdGogAEEediAAc0Hlkp7gBmwgAWoiADYCAEGQ2AAgAUEBaiICQQJ0aiAAQR52IABzQeWSnuAGbCACaiIANgIAQZDYACABQQJqIgJBAnRqIABBHnYgAHNB5ZKe4AZsIAJqIgA2AgAgAUEDaiICQfAERg0BQZDYACACQQJ0aiAAQR52IABzQeWSnuAGbCACaiIANgIAIAFBBGohAQwACwALQdjrAEKAgICAgICA+D83AwhBAEIANwPYa0GQ2ABBADYCwBNB6OsAQRhqQgA3AwBB6OsAQRBqQoCAgICAgIDwPzcDAEHo6wBBIGpCADcDAEHo6wBBKGpCADcDAEHo6wBBOGpCADcDAEHo6wBBMGpCgICAgICAgPg/NwMAQejrAEHAAGpCADcDAEHo6wBByABqQgA3AwBB6OsAQdgAakIANwMAQejrAEHQAGpCgICAgICAgPg/NwMAQejrAEHgAGpCADcDAEHo6wBB6ABqQgA3AwBB6OsAQfAAakKAgICAgICA+D83AwBB6OsAQZgBakEANgIAQejrAEGQAWpCADcDAEHo6wBBiAFqQgA3AwBB6OsAQYABakIANwMAQejrAEH4AGpCADcDAEEAQQA6AOhrQejrAEGsAWpBADYCAEHo6wBBpAFqQgA3AgBBAkEAQYAIEAMaC4YLAwV/AX4EfCMAQTBrIgIkAAJAAkACQAJAIAC9IgdCIIinIgNB/////wdxIgRB+tS9gARLDQAgA0H//z9xQfvDJEYNAQJAIARB/LKLgARLDQACQCAHQgBTDQAgASAARAAAQFT7Ifm/oCIARDFjYhphtNC9oCIIOQMAIAEgACAIoUQxY2IaYbTQvaA5AwhBASEDDAULIAEgAEQAAEBU+yH5P6AiAEQxY2IaYbTQPaAiCDkDACABIAAgCKFEMWNiGmG00D2gOQMIQX8hAwwECwJAIAdCAFMNACABIABEAABAVPshCcCgIgBEMWNiGmG04L2gIgg5AwAgASAAIAihRDFjYhphtOC9oDkDCEECIQMMBAsgASAARAAAQFT7IQlAoCIARDFjYhphtOA9oCIIOQMAIAEgACAIoUQxY2IaYbTgPaA5AwhBfiEDDAMLAkAgBEG7jPGABEsNAAJAIARBvPvXgARLDQAgBEH8ssuABEYNAgJAIAdCAFMNACABIABEAAAwf3zZEsCgIgBEypSTp5EO6b2gIgg5AwAgASAAIAihRMqUk6eRDum9oDkDCEEDIQMMBQsgASAARAAAMH982RJAoCIARMqUk6eRDuk9oCIIOQMAIAEgACAIoUTKlJOnkQ7pPaA5AwhBfSEDDAQLIARB+8PkgARGDQECQCAHQgBTDQAgASAARAAAQFT7IRnAoCIARDFjYhphtPC9oCIIOQMAIAEgACAIoUQxY2IaYbTwvaA5AwhBBCEDDAQLIAEgAEQAAEBU+yEZQKAiAEQxY2IaYbTwPaAiCDkDACABIAAgCKFEMWNiGmG08D2gOQMIQXwhAwwDCyAEQfrD5IkESw0BCyAAIABEg8jJbTBf5D+iRAAAAAAAADhDoEQAAAAAAAA4w6AiCEQAAEBU+yH5v6KgIgkgCEQxY2IaYbTQPaIiCqEiC0QYLURU+yHpv2MhBQJAAkAgCJlEAAAAAAAA4EFjRQ0AIAiqIQMMAQtBgICAgHghAwsCQAJAIAVFDQAgA0F/aiEDIAhEAAAAAAAA8L+gIghEMWNiGmG00D2iIQogACAIRAAAQFT7Ifm/oqAhCQwBCyALRBgtRFT7Iek/ZEUNACADQQFqIQMgCEQAAAAAAADwP6AiCEQxY2IaYbTQPaIhCiAAIAhEAABAVPsh+b+ioCEJCyABIAkgCqEiADkDAAJAIARBFHYiBSAAvUI0iKdB/w9xa0ERSA0AIAEgCSAIRAAAYBphtNA9oiIAoSILIAhEc3ADLooZozuiIAkgC6EgAKGhIgqhIgA5AwACQCAFIAC9QjSIp0H/D3FrQTJODQAgCyEJDAELIAEgCyAIRAAAAC6KGaM7oiIAoSIJIAhEwUkgJZqDezmiIAsgCaEgAKGhIgqhIgA5AwALIAEgCSAAoSAKoTkDCAwBCwJAIARBgIDA/wdJDQAgASAAIAChIgA5AwAgASAAOQMIQQAhAwwBCyAHQv////////8Hg0KAgICAgICAsMEAhL8hAEEAIQNBASEFA0AgAkEQaiADQQN0aiEDAkACQCAAmUQAAAAAAADgQWNFDQAgAKohBgwBC0GAgICAeCEGCyADIAa3Igg5AwAgACAIoUQAAAAAAABwQaIhAEEBIQMgBUEBcSEGQQAhBSAGDQALIAIgADkDIAJAAkAgAEQAAAAAAAAAAGENAEECIQMMAQtBASEFA0AgBSIDQX9qIQUgAkEQaiADQQN0aisDAEQAAAAAAAAAAGENAAsLIAJBEGogAiAEQRR2Qep3aiADQQFqQQEQNyEDIAIrAwAhAAJAIAdCf1UNACABIACaOQMAIAEgAisDCJo5AwhBACADayEDDAELIAEgADkDACABIAIrAwg5AwgLIAJBMGokACADC9QBAgJ/AXwjAEEQayIBJAACQAJAIAC9QiCIp0H/////B3EiAkH7w6T/A0sNAEQAAAAAAADwPyEDIAJBnsGa8gNJDQEgAEQAAAAAAAAAABAwIQMMAQsCQCACQYCAwP8HSQ0AIAAgAKEhAwwBCwJAAkACQAJAIAAgARAuQQNxDgMAAQIDCyABKwMAIAErAwgQMCEDDAMLIAErAwAgASsDCEEBEDKaIQMMAgsgASsDACABKwMIEDCaIQMMAQsgASsDACABKwMIQQEQMiEDCyABQRBqJAAgAwuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKALyQEBAn8jAEEQayIBJAACQAJAIAC9QiCIp0H/////B3EiAkH7w6T/A0sNACACQYCAwPIDSQ0BIABEAAAAAAAAAABBABAyIQAMAQsCQCACQYCAwP8HSQ0AIAAgAKEhAAwBCwJAAkACQAJAIAAgARAuQQNxDgMAAQIDCyABKwMAIAErAwhBARAyIQAMAwsgASsDACABKwMIEDAhAAwCCyABKwMAIAErAwhBARAymiEADAELIAErAwAgASsDCBAwmiEACyABQRBqJAAgAAuaAQEDfCAAIACiIgMgAyADoqIgA0R81c9aOtnlPaJE65wriublWr6goiADIANEff6xV+Mdxz6iRNVhwRmgASq/oKJEpvgQERERgT+goCEEIAMgAKIhBQJAIAINACAFIAMgBKJESVVVVVVVxb+goiAAoA8LIAAgAyABRAAAAAAAAOA/oiAEIAWioaIgAaEgBURJVVVVVVXFP6KgoQsFACAAnwu5AgMBfgF/AnwCQCAAvSIBQiCIp0H/////B3EiAkGAgMD/A0kNAAJAIAJBgIDAgHxqIAGncg0ARAAAAAAAAAAARBgtRFT7IQlAIAFCf1UbDwtEAAAAAAAAAAAgACAAoaMPCwJAAkAgAkH////+A0sNAEQYLURU+yH5PyEDIAJBgYCA4wNJDQFEB1wUMyamkTwgACAAIACiEDWioSAAoUQYLURU+yH5P6APCwJAIAFCf1UNAEQYLURU+yH5PyAARAAAAAAAAPA/oEQAAAAAAADgP6IiABAzIgMgAyAAEDWiRAdcFDMmppG8oKChIgAgAKAPC0QAAAAAAADwPyAAoUQAAAAAAADgP6IiAxAzIgQgAxA1oiADIAS9QoCAgIBwg78iACAAoqEgBCAAoKOgIACgIgAgAKAhAwsgAwuNAQAgACAAIAAgACAARAn3/Q3hPQI/okSIsgF14O9JP6CiRDuPaLUogqS/oKJEVUSIDlXByT+gokR9b+sDEtbUv6CiRFVVVVVVVcU/oCAAoiAAIAAgACAARIKSLrHFuLM/okRZAY0bbAbmv6CiRMiKWZzlKgBAoKJESy2KHCc6A8CgokQAAAAAAADwP6CjCwUAIACcC64SAhB/A3wjAEGwBGsiBSQAIAJBfWpBGG0iBkEAIAZBAEobIgdBaGwgAmohCAJAIARBAnRBkAxqKAIAIgkgA0F/aiIKakEASA0AIAkgA2ohCyAHIAprIQJBACEGA0ACQAJAIAJBAE4NAEQAAAAAAAAAACEVDAELIAJBAnRBoAxqKAIAtyEVCyAFQcACaiAGQQN0aiAVOQMAIAJBAWohAiAGQQFqIgYgC0cNAAsLIAhBaGohDCAJQQAgCUEAShshDUEAIQsDQEQAAAAAAAAAACEVAkAgA0EATA0AIAsgCmohBkEAIQIDQCAAIAJBA3RqKwMAIAVBwAJqIAYgAmtBA3RqKwMAoiAVoCEVIAJBAWoiAiADRw0ACwsgBSALQQN0aiAVOQMAIAsgDUYhAiALQQFqIQsgAkUNAAtBLyAIayEOQTAgCGshDyAIQWdqIRAgCSELAkADQCAFIAtBA3RqKwMAIRVBACECIAshBgJAIAtBAUgiEQ0AA0AgAkECdCENAkACQCAVRAAAAAAAAHA+oiIWmUQAAAAAAADgQWNFDQAgFqohCgwBC0GAgICAeCEKCyAFQeADaiANaiENAkACQCAKtyIWRAAAAAAAAHDBoiAVoCIVmUQAAAAAAADgQWNFDQAgFaohCgwBC0GAgICAeCEKCyANIAo2AgAgBSAGQX9qIgZBA3RqKwMAIBagIRUgAkEBaiICIAtHDQALCyAVIAwQbyEVAkACQCAVIBVEAAAAAAAAwD+iEDZEAAAAAAAAIMCioCIVmUQAAAAAAADgQWNFDQAgFaohEgwBC0GAgICAeCESCyAVIBK3oSEVAkACQAJAAkACQCAMQQFIIhMNACALQQJ0IAVB4ANqakF8aiICIAIoAgAiAiACIA91IgIgD3RrIgY2AgAgBiAOdSEUIAIgEmohEgwBCyAMDQEgC0ECdCAFQeADampBfGooAgBBF3UhFAsgFEEBSA0CDAELQQIhFCAVRAAAAAAAAOA/Zg0AQQAhFAwBC0EAIQJBACEKAkAgEQ0AA0AgBUHgA2ogAkECdGoiESgCACEGQf///wchDQJAAkAgCg0AQYCAgAghDSAGDQBBACEKDAELIBEgDSAGazYCAEEBIQoLIAJBAWoiAiALRw0ACwsCQCATDQBB////AyECAkACQCAQDgIBAAILQf///wEhAgsgC0ECdCAFQeADampBfGoiBiAGKAIAIAJxNgIACyASQQFqIRIgFEECRw0ARAAAAAAAAPA/IBWhIRVBAiEUIApFDQAgFUQAAAAAAADwPyAMEG+hIRULAkAgFUQAAAAAAAAAAGINAEEAIQYgCyECAkAgCyAJTA0AA0AgBUHgA2ogAkF/aiICQQJ0aigCACAGciEGIAIgCUoNAAsgBkUNACAMIQgDQCAIQWhqIQggBUHgA2ogC0F/aiILQQJ0aigCAEUNAAwECwALQQEhAgNAIAIiBkEBaiECIAVB4ANqIAkgBmtBAnRqKAIARQ0ACyAGIAtqIQ0DQCAFQcACaiALIANqIgZBA3RqIAtBAWoiCyAHakECdEGgDGooAgC3OQMAQQAhAkQAAAAAAAAAACEVAkAgA0EBSA0AA0AgACACQQN0aisDACAFQcACaiAGIAJrQQN0aisDAKIgFaAhFSACQQFqIgIgA0cNAAsLIAUgC0EDdGogFTkDACALIA1IDQALIA0hCwwBCwsCQAJAIBVBGCAIaxBvIhVEAAAAAAAAcEFmRQ0AIAtBAnQhAwJAAkAgFUQAAAAAAABwPqIiFplEAAAAAAAA4EFjRQ0AIBaqIQIMAQtBgICAgHghAgsgBUHgA2ogA2ohAwJAAkAgArdEAAAAAAAAcMGiIBWgIhWZRAAAAAAAAOBBY0UNACAVqiEGDAELQYCAgIB4IQYLIAMgBjYCACALQQFqIQsMAQsCQAJAIBWZRAAAAAAAAOBBY0UNACAVqiECDAELQYCAgIB4IQILIAwhCAsgBUHgA2ogC0ECdGogAjYCAAtEAAAAAAAA8D8gCBBvIRUCQCALQX9MDQAgCyEDA0AgBSADIgJBA3RqIBUgBUHgA2ogAkECdGooAgC3ojkDACACQX9qIQMgFUQAAAAAAABwPqIhFSACDQALIAtBf0wNACALIQIDQCALIAIiBmshAEQAAAAAAAAAACEVQQAhAgJAA0AgAkEDdEHwIWorAwAgBSACIAZqQQN0aisDAKIgFaAhFSACIAlODQEgAiAASSEDIAJBAWohAiADDQALCyAFQaABaiAAQQN0aiAVOQMAIAZBf2ohAiAGQQBKDQALCwJAAkACQAJAAkAgBA4EAQICAAQLRAAAAAAAAAAAIRcCQCALQQFIDQAgBUGgAWogC0EDdGorAwAhFSALIQIDQCAFQaABaiACQQN0aiAVIAVBoAFqIAJBf2oiA0EDdGoiBisDACIWIBYgFaAiFqGgOQMAIAYgFjkDACACQQFLIQYgFiEVIAMhAiAGDQALIAtBAkgNACAFQaABaiALQQN0aisDACEVIAshAgNAIAVBoAFqIAJBA3RqIBUgBUGgAWogAkF/aiIDQQN0aiIGKwMAIhYgFiAVoCIWoaA5AwAgBiAWOQMAIAJBAkshBiAWIRUgAyECIAYNAAtEAAAAAAAAAAAhFyALQQFMDQADQCAXIAVBoAFqIAtBA3RqKwMAoCEXIAtBAkohAiALQX9qIQsgAg0ACwsgBSsDoAEhFSAUDQIgASAVOQMAIAUrA6gBIRUgASAXOQMQIAEgFTkDCAwDC0QAAAAAAAAAACEVAkAgC0EASA0AA0AgCyICQX9qIQsgFSAFQaABaiACQQN0aisDAKAhFSACDQALCyABIBWaIBUgFBs5AwAMAgtEAAAAAAAAAAAhFQJAIAtBAEgNACALIQMDQCADIgJBf2ohAyAVIAVBoAFqIAJBA3RqKwMAoCEVIAINAAsLIAEgFZogFSAUGzkDACAFKwOgASAVoSEVQQEhAgJAIAtBAUgNAANAIBUgBUGgAWogAkEDdGorAwCgIRUgAiALRyEDIAJBAWohAiADDQALCyABIBWaIBUgFBs5AwgMAQsgASAVmjkDACAFKwOoASEVIAEgF5o5AxAgASAVmjkDCAsgBUGwBGokACASQQdxC9gFAQZ/A0AgAUF4aiEDA0AgACEEAkADQAJAAkACQAJAAkACQAJAAkAgASAEayIAQQN1IgUOBgkJAAQBAgMLIAIgAUF4aiIAIAQQOUUNCCAEIAAQOg8LIAQgBEEIaiAEQRBqIAFBeGogAhA7Gg8LIAQgBEEIaiAEQRBqIARBGGogAUF4aiACEDwaDwsCQCAAQfcBSg0AIAQgASACED0PCyAEIAVBAm1BA3RqIQYCQAJAIABBuT5JDQAgBCAEIAVBBG1BA3QiAGogBiAGIABqIAMgAhA8IQcMAQsgBCAGIAMgAhA+IQcLIAMhAAJAAkAgAiAEIAYQOUUNACADIQAMAQsDQAJAIAQgAEF4aiIARw0AIARBCGohBSACIAQgAxA5DQUDQCAFIANGDQkCQCACIAQgBRA5RQ0AIAUgAxA6IAVBCGohBQwHCyAFQQhqIQUMAAsACyACIAAgBhA5RQ0ACyAEIAAQOiAHQQFqIQcLIARBCGoiCCAATw0BA0AgCCIFQQhqIQggAiAFIAYQOQ0AA0AgAiAAQXhqIgAgBhA5RQ0ACwJAIAUgAE0NACAFIQgMAwsgBSAAEDogACAGIAYgBUYbIQYgB0EBaiEHDAALAAsgBCAEQQhqIAFBeGogAhA+GgwECwJAIAggBkYNACACIAYgCBA5RQ0AIAggBhA6IAdBAWohBwsCQCAHDQAgBCAIIAIQPyEFAkAgCEEIaiIAIAEgAhA/RQ0AIAghASAEIQAgBUUNBwwFC0ECIQYgBQ0CCwJAIAggBGsgASAIa04NACAEIAggAhA4IAhBCGohAAwFCyAIQQhqIAEgAhA4IAghASAEIQAMBQsgAyEGIAUgA0YNAgNAIAUiAEEIaiEFIAIgBCAAEDlFDQADQCACIAQgBkF4aiIGEDkNAAsCQCAAIAZJDQBBBCEGDAILIAAgBhA6DAALAAsgACEEIAZBfmoOAwIBAAELAAsLCwsNACABKwMAIAIrAwBjCzsBAX8jAEEQayICJAAgAiAAEEArAwA5AwggACABEEArAwA5AwAgASACQQhqEEArAwA5AwAgAkEQaiQAC18BAX8gACABIAIgBBA+IQUCQCAEIAMgAhA5RQ0AIAIgAxA6AkAgBCACIAEQOQ0AIAVBAWoPCyABIAIQOgJAIAQgASAAEDkNACAFQQJqDwsgACABEDogBUEDaiEFCyAFC3oBAX8gACABIAIgAyAFEDshBgJAIAUgBCADEDlFDQAgAyAEEDoCQCAFIAMgAhA5DQAgBkEBag8LIAIgAxA6AkAgBSACIAEQOQ0AIAZBAmoPCyABIAIQOgJAIAUgASAAEDkNACAGQQNqDwsgACABEDogBkEEaiEGCyAGC7ABAQV/IwBBEGsiAyQAIAAgAEEIaiAAQRBqIgQgAhA+GiAAQRhqIQUCQANAIAUgAUYNAQJAIAIgBSAEEDlFDQAgAyAFEEArAwA5AwggBSEGAkADQCAGIAQiBxBAKwMAOQMAAkAgByAARw0AIAAhBwwCCyAHIQYgAiADQQhqIAdBeGoiBBA5DQALCyAHIANBCGoQQCsDADkDAAsgBSEEIAVBCGohBQwACwALIANBEGokAAt9AQJ/IAMgASAAEDkhBCADIAIgARA5IQUCQAJAAkAgBA0AQQAhBCAFRQ0CIAEgAhA6QQEhBCADIAEgABA5RQ0CIAAgARA6DAELAkAgBUUNACAAIAIQOkEBDwsgACABEDpBASEEIAMgAiABEDlFDQEgASACEDoLQQIhBAsgBAvWAgEHfyMAQRBrIgMkAEEBIQQCQAJAAkACQAJAAkAgASAAa0EDdQ4GBQUAAQIDBAsgAiABQXhqIgUgABA5RQ0EIAAgBRA6DAQLIAAgAEEIaiABQXhqIAIQPhoMAwsgACAAQQhqIABBEGogAUF4aiACEDsaDAILIAAgAEEIaiAAQRBqIABBGGogAUF4aiACEDwaDAELIAAgAEEIaiAAQRBqIgYgAhA+GiAAQRhqIQdBACEIQQEhBANAIAcgAUYNAQJAAkAgAiAHIAYQOUUNACADIAcQQCsDADkDCCAHIQkCQANAIAkgBiIFEEArAwA5AwACQCAFIABHDQAgACEFDAILIAUhCSACIANBCGogBUF4aiIGEDkNAAsLIAUgA0EIahBAKwMAOQMAIAhBAWoiCEEIRg0BCyAHIQYgB0EIaiEHDAELCyAHQQhqIAFGIQQLIANBEGokACAECwQAIAALCABBmAgQFQALMQEBfyAAQQEgABshAQJAA0AgARBrIgANAQJAEEoiAEUNACAAEQoADAELCxAEAAsgAAsGACAAEGwLDwAgAEGwIkEIajYCACAACzkBAn8gARCIASICQQ1qEEIiA0EANgIIIAMgAjYCBCADIAI2AgAgACADEEYgASACQQFqEHk2AgAgAAsHACAAQQxqCx4AIAAQRBogAEHcIkEIajYCACAAQQRqIAEQRRogAAsEAEEBCwcAIAAoAgALCABBmO0AEEkLBAAgAAsGACAAEEMLBQBBgQkLHAAgAEHcIkEIajYCACAAQQRqEE8aIAAQSxogAAsnAQF/AkAgABBIRQ0AIAAoAgAQUCIBQQhqEFFBf0oNACABEEMLIAALBwAgAEF0agsVAQF/IAAgACgCAEF/aiIBNgIAIAELCAAgABBOEEMLCQAgAEEEahBUCwcAIAAoAgALCwAgABBOGiAAEEMLBAAgAAtZAQJ/IAEtAAAhAgJAIAAtAAAiA0UNACADIAJB/wFxRw0AA0AgAS0AASECIAAtAAEiA0UNASABQQFqIQEgAEEBaiEAIAMgAkH/AXFGDQALCyADIAJB/wFxawsJACAAEFYaIAALAgALAgALCwAgABBYGiAAEEMLCwAgABBYGiAAEEMLLQACQCACDQAgACgCBCABKAIERg8LAkAgACABRw0AQQEPCyAAEF4gARBeEFdFCwcAIAAoAgQLqwEBAn8jAEHAAGsiAyQAQQEhBAJAIAAgAUEAEF0NAEEAIQQgAUUNAEEAIQQgAUH8I0GsJEEAEGAiAUUNACADQQhqQQRyQQBBNBB6GiADQQE2AjggA0F/NgIUIAMgADYCECADIAE2AgggASADQQhqIAIoAgBBASABKAIAKAIcEQMAAkAgAygCICIEQQFHDQAgAiADKAIYNgIACyAEQQFGIQQLIANBwABqJAAgBAuoAgEDfyMAQcAAayIEJAAgACgCACIFQXxqKAIAIQYgBUF4aigCACEFIAQgAzYCFCAEIAE2AhAgBCAANgIMIAQgAjYCCEEAIQEgBEEYakEAQScQehogACAFaiEAAkACQCAGIAJBABBdRQ0AIARBATYCOCAGIARBCGogACAAQQFBACAGKAIAKAIUEQcAIABBACAEKAIgQQFGGyEBDAELIAYgBEEIaiAAQQFBACAGKAIAKAIYEQgAAkACQCAEKAIsDgIAAQILIAQoAhxBACAEKAIoQQFGG0EAIAQoAiRBAUYbQQAgBCgCMEEBRhshAQwBCwJAIAQoAiBBAUYNACAEKAIwDQEgBCgCJEEBRw0BIAQoAihBAUcNAQsgBCgCGCEBCyAEQcAAaiQAIAELYAEBfwJAIAEoAhAiBA0AIAFBATYCJCABIAM2AhggASACNgIQDwsCQAJAIAQgAkcNACABKAIYQQJHDQEgASADNgIYDwsgAUEBOgA2IAFBAjYCGCABIAEoAiRBAWo2AiQLCx0AAkAgACABKAIIQQAQXUUNACABIAEgAiADEGELCzYAAkAgACABKAIIQQAQXUUNACABIAEgAiADEGEPCyAAKAIIIgAgASACIAMgACgCACgCHBEDAAufAQAgAUEBOgA1AkAgASgCBCADRw0AIAFBAToANAJAAkAgASgCECIDDQAgAUEBNgIkIAEgBDYCGCABIAI2AhAgASgCMEEBRw0CIARBAUYNAQwCCwJAIAMgAkcNAAJAIAEoAhgiA0ECRw0AIAEgBDYCGCAEIQMLIAEoAjBBAUcNAiADQQFGDQEMAgsgASABKAIkQQFqNgIkCyABQQE6ADYLCyAAAkAgASgCBCACRw0AIAEoAhxBAUYNACABIAM2AhwLC/8BAAJAIAAgASgCCCAEEF1FDQAgASABIAIgAxBlDwsCQAJAIAAgASgCACAEEF1FDQACQAJAIAEoAhAgAkYNACABKAIUIAJHDQELIANBAUcNAiABQQE2AiAPCyABIAM2AiACQCABKAIsQQRGDQAgAUEAOwE0IAAoAggiACABIAIgAkEBIAQgACgCACgCFBEHAAJAIAEtADVFDQAgAUEDNgIsIAEtADRFDQEMAwsgAUEENgIsCyABIAI2AhQgASABKAIoQQFqNgIoIAEoAiRBAUcNASABKAIYQQJHDQEgAUEBOgA2DwsgACgCCCIAIAEgAiADIAQgACgCACgCGBEIAAsLmAEAAkAgACABKAIIIAQQXUUNACABIAEgAiADEGUPCwJAIAAgASgCACAEEF1FDQACQAJAIAEoAhAgAkYNACABKAIUIAJHDQELIANBAUcNASABQQE2AiAPCyABIAI2AhQgASADNgIgIAEgASgCKEEBajYCKAJAIAEoAiRBAUcNACABKAIYQQJHDQAgAUEBOgA2CyABQQQ2AiwLCzwAAkAgACABKAIIIAUQXUUNACABIAEgAiADIAQQZA8LIAAoAggiACABIAIgAyAEIAUgACgCACgCFBEHAAsfAAJAIAAgASgCCCAFEF1FDQAgASABIAIgAyAEEGQLCwYAQZztAAuVLwELfyMAQRBrIgEkAAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAAQfQBSw0AAkBBACgCoG0iAkEQIABBC2pBeHEgAEELSRsiA0EDdiIEdiIAQQNxRQ0AIABBf3NBAXEgBGoiBUEDdCIGQdDtAGooAgAiBEEIaiEAAkACQCAEKAIIIgMgBkHI7QBqIgZHDQBBACACQX4gBXdxNgKgbQwBCyADIAY2AgwgBiADNgIICyAEIAVBA3QiBUEDcjYCBCAEIAVqIgQgBCgCBEEBcjYCBAwMCyADQQAoAqhtIgdNDQECQCAARQ0AAkACQCAAIAR0QQIgBHQiAEEAIABrcnEiAEEAIABrcUF/aiIAIABBDHZBEHEiAHYiBEEFdkEIcSIFIAByIAQgBXYiAEECdkEEcSIEciAAIAR2IgBBAXZBAnEiBHIgACAEdiIAQQF2QQFxIgRyIAAgBHZqIgVBA3QiBkHQ7QBqKAIAIgQoAggiACAGQcjtAGoiBkcNAEEAIAJBfiAFd3EiAjYCoG0MAQsgACAGNgIMIAYgADYCCAsgBEEIaiEAIAQgA0EDcjYCBCAEIANqIgYgBUEDdCIIIANrIgVBAXI2AgQgBCAIaiAFNgIAAkAgB0UNACAHQQN2IghBA3RByO0AaiEDQQAoArRtIQQCQAJAIAJBASAIdCIIcQ0AQQAgAiAIcjYCoG0gAyEIDAELIAMoAgghCAsgAyAENgIIIAggBDYCDCAEIAM2AgwgBCAINgIIC0EAIAY2ArRtQQAgBTYCqG0MDAtBACgCpG0iCUUNASAJQQAgCWtxQX9qIgAgAEEMdkEQcSIAdiIEQQV2QQhxIgUgAHIgBCAFdiIAQQJ2QQRxIgRyIAAgBHYiAEEBdkECcSIEciAAIAR2IgBBAXZBAXEiBHIgACAEdmpBAnRB0O8AaigCACIGKAIEQXhxIANrIQQgBiEFAkADQAJAIAUoAhAiAA0AIAVBFGooAgAiAEUNAgsgACgCBEF4cSADayIFIAQgBSAESSIFGyEEIAAgBiAFGyEGIAAhBQwACwALIAYoAhghCgJAIAYoAgwiCCAGRg0AQQAoArBtIAYoAggiAEsaIAAgCDYCDCAIIAA2AggMCwsCQCAGQRRqIgUoAgAiAA0AIAYoAhAiAEUNAyAGQRBqIQULA0AgBSELIAAiCEEUaiIFKAIAIgANACAIQRBqIQUgCCgCECIADQALIAtBADYCAAwKC0F/IQMgAEG/f0sNACAAQQtqIgBBeHEhA0EAKAKkbSIHRQ0AQQAhCwJAIANBgAJJDQBBHyELIANB////B0sNACAAQQh2IgAgAEGA/j9qQRB2QQhxIgB0IgQgBEGA4B9qQRB2QQRxIgR0IgUgBUGAgA9qQRB2QQJxIgV0QQ92IAAgBHIgBXJrIgBBAXQgAyAAQRVqdkEBcXJBHGohCwtBACADayEEAkACQAJAAkAgC0ECdEHQ7wBqKAIAIgUNAEEAIQBBACEIDAELQQAhACADQQBBGSALQQF2ayALQR9GG3QhBkEAIQgDQAJAIAUoAgRBeHEgA2siAiAETw0AIAIhBCAFIQggAg0AQQAhBCAFIQggBSEADAMLIAAgBUEUaigCACICIAIgBSAGQR12QQRxakEQaigCACIFRhsgACACGyEAIAZBAXQhBiAFDQALCwJAIAAgCHINAEEAIQhBAiALdCIAQQAgAGtyIAdxIgBFDQMgAEEAIABrcUF/aiIAIABBDHZBEHEiAHYiBUEFdkEIcSIGIAByIAUgBnYiAEECdkEEcSIFciAAIAV2IgBBAXZBAnEiBXIgACAFdiIAQQF2QQFxIgVyIAAgBXZqQQJ0QdDvAGooAgAhAAsgAEUNAQsDQCAAKAIEQXhxIANrIgIgBEkhBgJAIAAoAhAiBQ0AIABBFGooAgAhBQsgAiAEIAYbIQQgACAIIAYbIQggBSEAIAUNAAsLIAhFDQAgBEEAKAKobSADa08NACAIKAIYIQsCQCAIKAIMIgYgCEYNAEEAKAKwbSAIKAIIIgBLGiAAIAY2AgwgBiAANgIIDAkLAkAgCEEUaiIFKAIAIgANACAIKAIQIgBFDQMgCEEQaiEFCwNAIAUhAiAAIgZBFGoiBSgCACIADQAgBkEQaiEFIAYoAhAiAA0ACyACQQA2AgAMCAsCQEEAKAKobSIAIANJDQBBACgCtG0hBAJAAkAgACADayIFQRBJDQBBACAFNgKobUEAIAQgA2oiBjYCtG0gBiAFQQFyNgIEIAQgAGogBTYCACAEIANBA3I2AgQMAQtBAEEANgK0bUEAQQA2AqhtIAQgAEEDcjYCBCAEIABqIgAgACgCBEEBcjYCBAsgBEEIaiEADAoLAkBBACgCrG0iBiADTQ0AQQAgBiADayIENgKsbUEAQQAoArhtIgAgA2oiBTYCuG0gBSAEQQFyNgIEIAAgA0EDcjYCBCAAQQhqIQAMCgsCQAJAQQAoAvhwRQ0AQQAoAoBxIQQMAQtBAEJ/NwKEcUEAQoCggICAgAQ3AvxwQQAgAUEMakFwcUHYqtWqBXM2AvhwQQBBADYCjHFBAEEANgLccEGAICEEC0EAIQAgBCADQS9qIgdqIgJBACAEayILcSIIIANNDQlBACEAAkBBACgC2HAiBEUNAEEAKALQcCIFIAhqIgkgBU0NCiAJIARLDQoLQQAtANxwQQRxDQQCQAJAAkBBACgCuG0iBEUNAEHg8AAhAANAAkAgACgCACIFIARLDQAgBSAAKAIEaiAESw0DCyAAKAIIIgANAAsLQQAQbiIGQX9GDQUgCCECAkBBACgC/HAiAEF/aiIEIAZxRQ0AIAggBmsgBCAGakEAIABrcWohAgsgAiADTQ0FIAJB/v///wdLDQUCQEEAKALYcCIARQ0AQQAoAtBwIgQgAmoiBSAETQ0GIAUgAEsNBgsgAhBuIgAgBkcNAQwHCyACIAZrIAtxIgJB/v///wdLDQQgAhBuIgYgACgCACAAKAIEakYNAyAGIQALAkAgAEF/Rg0AIANBMGogAk0NAAJAIAcgAmtBACgCgHEiBGpBACAEa3EiBEH+////B00NACAAIQYMBwsCQCAEEG5Bf0YNACAEIAJqIQIgACEGDAcLQQAgAmsQbhoMBAsgACEGIABBf0cNBQwDC0EAIQgMBwtBACEGDAULIAZBf0cNAgtBAEEAKALccEEEcjYC3HALIAhB/v///wdLDQEgCBBuIQZBABBuIQAgBkF/Rg0BIABBf0YNASAGIABPDQEgACAGayICIANBKGpNDQELQQBBACgC0HAgAmoiADYC0HACQCAAQQAoAtRwTQ0AQQAgADYC1HALAkACQAJAAkBBACgCuG0iBEUNAEHg8AAhAANAIAYgACgCACIFIAAoAgQiCGpGDQIgACgCCCIADQAMAwsACwJAAkBBACgCsG0iAEUNACAGIABPDQELQQAgBjYCsG0LQQAhAEEAIAI2AuRwQQAgBjYC4HBBAEF/NgLAbUEAQQAoAvhwNgLEbUEAQQA2AuxwA0AgAEEDdCIEQdDtAGogBEHI7QBqIgU2AgAgBEHU7QBqIAU2AgAgAEEBaiIAQSBHDQALQQAgAkFYaiIAQXggBmtBB3FBACAGQQhqQQdxGyIEayIFNgKsbUEAIAYgBGoiBDYCuG0gBCAFQQFyNgIEIAYgAGpBKDYCBEEAQQAoAohxNgK8bQwCCyAALQAMQQhxDQAgBSAESw0AIAYgBE0NACAAIAggAmo2AgRBACAEQXggBGtBB3FBACAEQQhqQQdxGyIAaiIFNgK4bUEAQQAoAqxtIAJqIgYgAGsiADYCrG0gBSAAQQFyNgIEIAQgBmpBKDYCBEEAQQAoAohxNgK8bQwBCwJAIAZBACgCsG0iCE8NAEEAIAY2ArBtIAYhCAsgBiACaiEFQeDwACEAAkACQAJAAkACQAJAAkADQCAAKAIAIAVGDQEgACgCCCIADQAMAgsACyAALQAMQQhxRQ0BC0Hg8AAhAANAAkAgACgCACIFIARLDQAgBSAAKAIEaiIFIARLDQMLIAAoAgghAAwACwALIAAgBjYCACAAIAAoAgQgAmo2AgQgBkF4IAZrQQdxQQAgBkEIakEHcRtqIgsgA0EDcjYCBCAFQXggBWtBB3FBACAFQQhqQQdxG2oiAiALIANqIgNrIQUCQCAEIAJHDQBBACADNgK4bUEAQQAoAqxtIAVqIgA2AqxtIAMgAEEBcjYCBAwDCwJAQQAoArRtIAJHDQBBACADNgK0bUEAQQAoAqhtIAVqIgA2AqhtIAMgAEEBcjYCBCADIABqIAA2AgAMAwsCQCACKAIEIgBBA3FBAUcNACAAQXhxIQcCQAJAIABB/wFLDQAgAigCCCIEIABBA3YiCEEDdEHI7QBqIgZGGgJAIAIoAgwiACAERw0AQQBBACgCoG1BfiAId3E2AqBtDAILIAAgBkYaIAQgADYCDCAAIAQ2AggMAQsgAigCGCEJAkACQCACKAIMIgYgAkYNACAIIAIoAggiAEsaIAAgBjYCDCAGIAA2AggMAQsCQCACQRRqIgAoAgAiBA0AIAJBEGoiACgCACIEDQBBACEGDAELA0AgACEIIAQiBkEUaiIAKAIAIgQNACAGQRBqIQAgBigCECIEDQALIAhBADYCAAsgCUUNAAJAAkAgAigCHCIEQQJ0QdDvAGoiACgCACACRw0AIAAgBjYCACAGDQFBAEEAKAKkbUF+IAR3cTYCpG0MAgsgCUEQQRQgCSgCECACRhtqIAY2AgAgBkUNAQsgBiAJNgIYAkAgAigCECIARQ0AIAYgADYCECAAIAY2AhgLIAIoAhQiAEUNACAGQRRqIAA2AgAgACAGNgIYCyAHIAVqIQUgAiAHaiECCyACIAIoAgRBfnE2AgQgAyAFQQFyNgIEIAMgBWogBTYCAAJAIAVB/wFLDQAgBUEDdiIEQQN0QcjtAGohAAJAAkBBACgCoG0iBUEBIAR0IgRxDQBBACAFIARyNgKgbSAAIQQMAQsgACgCCCEECyAAIAM2AgggBCADNgIMIAMgADYCDCADIAQ2AggMAwtBHyEAAkAgBUH///8HSw0AIAVBCHYiACAAQYD+P2pBEHZBCHEiAHQiBCAEQYDgH2pBEHZBBHEiBHQiBiAGQYCAD2pBEHZBAnEiBnRBD3YgACAEciAGcmsiAEEBdCAFIABBFWp2QQFxckEcaiEACyADIAA2AhwgA0IANwIQIABBAnRB0O8AaiEEAkACQEEAKAKkbSIGQQEgAHQiCHENAEEAIAYgCHI2AqRtIAQgAzYCACADIAQ2AhgMAQsgBUEAQRkgAEEBdmsgAEEfRht0IQAgBCgCACEGA0AgBiIEKAIEQXhxIAVGDQMgAEEddiEGIABBAXQhACAEIAZBBHFqQRBqIggoAgAiBg0ACyAIIAM2AgAgAyAENgIYCyADIAM2AgwgAyADNgIIDAILQQAgAkFYaiIAQXggBmtBB3FBACAGQQhqQQdxGyIIayILNgKsbUEAIAYgCGoiCDYCuG0gCCALQQFyNgIEIAYgAGpBKDYCBEEAQQAoAohxNgK8bSAEIAVBJyAFa0EHcUEAIAVBWWpBB3EbakFRaiIAIAAgBEEQakkbIghBGzYCBCAIQRBqQQApAuhwNwIAIAhBACkC4HA3AghBACAIQQhqNgLocEEAIAI2AuRwQQAgBjYC4HBBAEEANgLscCAIQRhqIQADQCAAQQc2AgQgAEEIaiEGIABBBGohACAFIAZLDQALIAggBEYNAyAIIAgoAgRBfnE2AgQgBCAIIARrIgJBAXI2AgQgCCACNgIAAkAgAkH/AUsNACACQQN2IgVBA3RByO0AaiEAAkACQEEAKAKgbSIGQQEgBXQiBXENAEEAIAYgBXI2AqBtIAAhBQwBCyAAKAIIIQULIAAgBDYCCCAFIAQ2AgwgBCAANgIMIAQgBTYCCAwEC0EfIQACQCACQf///wdLDQAgAkEIdiIAIABBgP4/akEQdkEIcSIAdCIFIAVBgOAfakEQdkEEcSIFdCIGIAZBgIAPakEQdkECcSIGdEEPdiAAIAVyIAZyayIAQQF0IAIgAEEVanZBAXFyQRxqIQALIARCADcCECAEQRxqIAA2AgAgAEECdEHQ7wBqIQUCQAJAQQAoAqRtIgZBASAAdCIIcQ0AQQAgBiAIcjYCpG0gBSAENgIAIARBGGogBTYCAAwBCyACQQBBGSAAQQF2ayAAQR9GG3QhACAFKAIAIQYDQCAGIgUoAgRBeHEgAkYNBCAAQR12IQYgAEEBdCEAIAUgBkEEcWpBEGoiCCgCACIGDQALIAggBDYCACAEQRhqIAU2AgALIAQgBDYCDCAEIAQ2AggMAwsgBCgCCCIAIAM2AgwgBCADNgIIIANBADYCGCADIAQ2AgwgAyAANgIICyALQQhqIQAMBQsgBSgCCCIAIAQ2AgwgBSAENgIIIARBGGpBADYCACAEIAU2AgwgBCAANgIIC0EAKAKsbSIAIANNDQBBACAAIANrIgQ2AqxtQQBBACgCuG0iACADaiIFNgK4bSAFIARBAXI2AgQgACADQQNyNgIEIABBCGohAAwDCxBqQTA2AgBBACEADAILAkAgC0UNAAJAAkAgCCAIKAIcIgVBAnRB0O8AaiIAKAIARw0AIAAgBjYCACAGDQFBACAHQX4gBXdxIgc2AqRtDAILIAtBEEEUIAsoAhAgCEYbaiAGNgIAIAZFDQELIAYgCzYCGAJAIAgoAhAiAEUNACAGIAA2AhAgACAGNgIYCyAIQRRqKAIAIgBFDQAgBkEUaiAANgIAIAAgBjYCGAsCQAJAIARBD0sNACAIIAQgA2oiAEEDcjYCBCAIIABqIgAgACgCBEEBcjYCBAwBCyAIIANBA3I2AgQgCCADaiIGIARBAXI2AgQgBiAEaiAENgIAAkAgBEH/AUsNACAEQQN2IgRBA3RByO0AaiEAAkACQEEAKAKgbSIFQQEgBHQiBHENAEEAIAUgBHI2AqBtIAAhBAwBCyAAKAIIIQQLIAAgBjYCCCAEIAY2AgwgBiAANgIMIAYgBDYCCAwBC0EfIQACQCAEQf///wdLDQAgBEEIdiIAIABBgP4/akEQdkEIcSIAdCIFIAVBgOAfakEQdkEEcSIFdCIDIANBgIAPakEQdkECcSIDdEEPdiAAIAVyIANyayIAQQF0IAQgAEEVanZBAXFyQRxqIQALIAYgADYCHCAGQgA3AhAgAEECdEHQ7wBqIQUCQAJAAkAgB0EBIAB0IgNxDQBBACAHIANyNgKkbSAFIAY2AgAgBiAFNgIYDAELIARBAEEZIABBAXZrIABBH0YbdCEAIAUoAgAhAwNAIAMiBSgCBEF4cSAERg0CIABBHXYhAyAAQQF0IQAgBSADQQRxakEQaiICKAIAIgMNAAsgAiAGNgIAIAYgBTYCGAsgBiAGNgIMIAYgBjYCCAwBCyAFKAIIIgAgBjYCDCAFIAY2AgggBkEANgIYIAYgBTYCDCAGIAA2AggLIAhBCGohAAwBCwJAIApFDQACQAJAIAYgBigCHCIFQQJ0QdDvAGoiACgCAEcNACAAIAg2AgAgCA0BQQAgCUF+IAV3cTYCpG0MAgsgCkEQQRQgCigCECAGRhtqIAg2AgAgCEUNAQsgCCAKNgIYAkAgBigCECIARQ0AIAggADYCECAAIAg2AhgLIAZBFGooAgAiAEUNACAIQRRqIAA2AgAgACAINgIYCwJAAkAgBEEPSw0AIAYgBCADaiIAQQNyNgIEIAYgAGoiACAAKAIEQQFyNgIEDAELIAYgA0EDcjYCBCAGIANqIgUgBEEBcjYCBCAFIARqIAQ2AgACQCAHRQ0AIAdBA3YiCEEDdEHI7QBqIQNBACgCtG0hAAJAAkBBASAIdCIIIAJxDQBBACAIIAJyNgKgbSADIQgMAQsgAygCCCEICyADIAA2AgggCCAANgIMIAAgAzYCDCAAIAg2AggLQQAgBTYCtG1BACAENgKobQsgBkEIaiEACyABQRBqJAAgAAv8DAEHfwJAIABFDQAgAEF4aiIBIABBfGooAgAiAkF4cSIAaiEDAkAgAkEBcQ0AIAJBA3FFDQEgASABKAIAIgJrIgFBACgCsG0iBEkNASACIABqIQACQEEAKAK0bSABRg0AAkAgAkH/AUsNACABKAIIIgQgAkEDdiIFQQN0QcjtAGoiBkYaAkAgASgCDCICIARHDQBBAEEAKAKgbUF+IAV3cTYCoG0MAwsgAiAGRhogBCACNgIMIAIgBDYCCAwCCyABKAIYIQcCQAJAIAEoAgwiBiABRg0AIAQgASgCCCICSxogAiAGNgIMIAYgAjYCCAwBCwJAIAFBFGoiAigCACIEDQAgAUEQaiICKAIAIgQNAEEAIQYMAQsDQCACIQUgBCIGQRRqIgIoAgAiBA0AIAZBEGohAiAGKAIQIgQNAAsgBUEANgIACyAHRQ0BAkACQCABKAIcIgRBAnRB0O8AaiICKAIAIAFHDQAgAiAGNgIAIAYNAUEAQQAoAqRtQX4gBHdxNgKkbQwDCyAHQRBBFCAHKAIQIAFGG2ogBjYCACAGRQ0CCyAGIAc2AhgCQCABKAIQIgJFDQAgBiACNgIQIAIgBjYCGAsgASgCFCICRQ0BIAZBFGogAjYCACACIAY2AhgMAQsgAygCBCICQQNxQQNHDQBBACAANgKobSADIAJBfnE2AgQgASAAQQFyNgIEIAEgAGogADYCAA8LIAMgAU0NACADKAIEIgJBAXFFDQACQAJAIAJBAnENAAJAQQAoArhtIANHDQBBACABNgK4bUEAQQAoAqxtIABqIgA2AqxtIAEgAEEBcjYCBCABQQAoArRtRw0DQQBBADYCqG1BAEEANgK0bQ8LAkBBACgCtG0gA0cNAEEAIAE2ArRtQQBBACgCqG0gAGoiADYCqG0gASAAQQFyNgIEIAEgAGogADYCAA8LIAJBeHEgAGohAAJAAkAgAkH/AUsNACADKAIIIgQgAkEDdiIFQQN0QcjtAGoiBkYaAkAgAygCDCICIARHDQBBAEEAKAKgbUF+IAV3cTYCoG0MAgsgAiAGRhogBCACNgIMIAIgBDYCCAwBCyADKAIYIQcCQAJAIAMoAgwiBiADRg0AQQAoArBtIAMoAggiAksaIAIgBjYCDCAGIAI2AggMAQsCQCADQRRqIgIoAgAiBA0AIANBEGoiAigCACIEDQBBACEGDAELA0AgAiEFIAQiBkEUaiICKAIAIgQNACAGQRBqIQIgBigCECIEDQALIAVBADYCAAsgB0UNAAJAAkAgAygCHCIEQQJ0QdDvAGoiAigCACADRw0AIAIgBjYCACAGDQFBAEEAKAKkbUF+IAR3cTYCpG0MAgsgB0EQQRQgBygCECADRhtqIAY2AgAgBkUNAQsgBiAHNgIYAkAgAygCECICRQ0AIAYgAjYCECACIAY2AhgLIAMoAhQiAkUNACAGQRRqIAI2AgAgAiAGNgIYCyABIABBAXI2AgQgASAAaiAANgIAIAFBACgCtG1HDQFBACAANgKobQ8LIAMgAkF+cTYCBCABIABBAXI2AgQgASAAaiAANgIACwJAIABB/wFLDQAgAEEDdiICQQN0QcjtAGohAAJAAkBBACgCoG0iBEEBIAJ0IgJxDQBBACAEIAJyNgKgbSAAIQIMAQsgACgCCCECCyAAIAE2AgggAiABNgIMIAEgADYCDCABIAI2AggPC0EfIQICQCAAQf///wdLDQAgAEEIdiICIAJBgP4/akEQdkEIcSICdCIEIARBgOAfakEQdkEEcSIEdCIGIAZBgIAPakEQdkECcSIGdEEPdiACIARyIAZyayICQQF0IAAgAkEVanZBAXFyQRxqIQILIAFCADcCECABQRxqIAI2AgAgAkECdEHQ7wBqIQQCQAJAAkACQEEAKAKkbSIGQQEgAnQiA3ENAEEAIAYgA3I2AqRtIAQgATYCACABQRhqIAQ2AgAMAQsgAEEAQRkgAkEBdmsgAkEfRht0IQIgBCgCACEGA0AgBiIEKAIEQXhxIABGDQIgAkEddiEGIAJBAXQhAiAEIAZBBHFqQRBqIgMoAgAiBg0ACyADIAE2AgAgAUEYaiAENgIACyABIAE2AgwgASABNgIIDAELIAQoAggiACABNgIMIAQgATYCCCABQRhqQQA2AgAgASAENgIMIAEgADYCCAtBAEEAKALAbUF/aiIBQX8gARs2AsBtCwsHAD8AQRB0C1ABAn9BACgC+FYiASAAQQNqQXxxIgJqIQACQAJAIAJFDQAgACABTQ0BCwJAIAAQbU0NACAAEAVFDQELQQAgADYC+FYgAQ8LEGpBMDYCAEF/C64BAAJAAkAgAUGACEgNACAARAAAAAAAAOB/oiEAAkAgAUH/D08NACABQYF4aiEBDAILIABEAAAAAAAA4H+iIQAgAUH9FyABQf0XSRtBgnBqIQEMAQsgAUGBeEoNACAARAAAAAAAAGADoiEAAkAgAUG4cE0NACABQckHaiEBDAELIABEAAAAAAAAYAOiIQAgAUHwaCABQfBoSxtBkg9qIQELIAAgAUH/B2qtQjSGv6ILDAAgACAAoSIAIACjCw8AIAGaIAEgABsQciABogsVAQF/IwBBEGsiASAAOQMIIAErAwgLDwAgAEQAAAAAAAAAcBBxCw8AIABEAAAAAAAAABAQcQsFACAAmQuVCQMGfwN+CXwjAEEQayICJAAgAb0iCEI0iKciA0H/D3EiBEHCd2ohBQJAAkACQCAAvSIJQjSIpyIGQYFwakGCcEkNAEEAIQcgBUH/fksNAQsCQCAIQgGGIgpCf3xC/////////29UDQBEAAAAAAAA8D8hCyAKUA0CIAlCgICAgICAgPg/UQ0CAkACQCAJQgGGIglCgICAgICAgHBWDQAgCkKBgICAgICAcFQNAQsgACABoCELDAMLIAlCgICAgICAgPD/AFENAkQAAAAAAAAAACABIAGiIAhCP4inQQFzIAlCgICAgICAgPD/AFRGGyELDAILAkAgCUIBhkJ/fEL/////////b1QNACAAIACiIQsCQCAJQn9VDQAgC5ogCyAIEHdBAUYbIQsLIAhCf1UNAiACRAAAAAAAAPA/IAujOQMIIAIrAwghCwwCC0EAIQcCQCAJQn9VDQACQCAIEHciBw0AIAAQcCELDAMLIAZB/w9xIQYgCUL///////////8AgyEJIAdBAUZBEnQhBwsCQCAFQf9+Sw0ARAAAAAAAAPA/IQsgCUKAgICAgICA+D9RDQICQCAEQb0HSw0AIAEgAZogCUKAgICAgICA+D9WG0QAAAAAAADwP6AhCwwDCwJAIANBgBBJIAlCgYCAgICAgPg/VEYNAEEAEHMhCwwDC0EAEHQhCwwCCyAGDQAgAEQAAAAAAAAwQ6K9Qv///////////wCDQoCAgICAgIDgfHwhCQsCQCAIQoCAgECDvyIMIAkgCUKAgICAsNXajEB8IghCgICAgICAgHiDfSIJQoCAgIAIfEKAgICAcIO/IgsgCEItiKdB/wBxQQV0IgVB+DZqKwMAIg2iRAAAAAAAAPC/oCIAIABBACsDwDYiDqIiD6IiECAIQjSHp7ciEUEAKwOwNqIgBUGIN2orAwCgIhIgACANIAm/IAuhoiIToCIAoCILoCINIBAgCyANoaAgEyAPIA4gAKIiDqCiIBFBACsDuDaiIAVBkDdqKwMAoCAAIBIgC6GgoKCgIAAgACAOoiILoiALIAsgAEEAKwPwNqJBACsD6DagoiAAQQArA+A2okEAKwPYNqCgoiAAQQArA9A2okEAKwPINqCgoqAiD6AiC71CgICAQIO/Ig6iIgC9IglCNIinQf8PcSIFQbd4akE/SQ0AAkAgBUHIB0sNACAARAAAAAAAAPA/oCIAmiAAIAcbIQsMAgsgBUGJCEkhBkEAIQUgBg0AAkAgCUJ/VQ0AIAcQdCELDAILIAcQcyELDAELIAEgDKEgDqIgDyANIAuhoCALIA6hoCABoqAgAEEAKwPAJaJBACsDyCUiAaAiCyABoSIBQQArA9gloiABQQArA9AloiAAoKCgIgAgAKIiASABoiAAQQArA/glokEAKwPwJaCiIAEgAEEAKwPoJaJBACsD4CWgoiALvSIJp0EEdEHwD3EiBkGwJmorAwAgAKCgoCEAIAZBuCZqKQMAIAkgB618Qi2GfCEIAkAgBQ0AIAAgCCAJEHghCwwBCyAIvyIBIACiIAGgIQsLIAJBEGokACALC1UCAn8BfkEAIQECQCAAQjSIp0H/D3EiAkH/B0kNAEECIQEgAkGzCEsNAEEAIQFCAUGzCCACa62GIgNCf3wgAINCAFINAEECQQEgAyAAg1AbIQELIAELgwICAX8EfCMAQRBrIgMkAAJAAkAgAqdBAEgNACABQoCAgICAgID4QHy/IgQgAKIgBKBEAAAAAAAAAH+iIQAMAQsCQCABQoCAgICAgIDwP3wiAb8iBCAAoiIFIASgIgAQdUQAAAAAAADwP2NFDQAgA0KAgICAgICACDcDCCADIAMrAwhEAAAAAAAAEACiOQMIIAFCgICAgICAgICAf4O/IABEAAAAAAAA8L9EAAAAAAAA8D8gAEQAAAAAAAAAAGMbIgagIgcgBSAEIAChoCAAIAYgB6GgoKAgBqEiACAARAAAAAAAAAAAYRshAAsgAEQAAAAAAAAQAKIhAAsgA0EQaiQAIAALjwQBA38CQCACQYAESQ0AIAAgASACEAYaIAAPCyAAIAJqIQMCQAJAIAEgAHNBA3ENAAJAAkAgAEEDcQ0AIAAhAgwBCwJAIAINACAAIQIMAQsgACECA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgJBA3FFDQEgAiADSQ0ACwsCQCADQXxxIgRBwABJDQAgAiAEQUBqIgVLDQADQCACIAEoAgA2AgAgAiABKAIENgIEIAIgASgCCDYCCCACIAEoAgw2AgwgAiABKAIQNgIQIAIgASgCFDYCFCACIAEoAhg2AhggAiABKAIcNgIcIAIgASgCIDYCICACIAEoAiQ2AiQgAiABKAIoNgIoIAIgASgCLDYCLCACIAEoAjA2AjAgAiABKAI0NgI0IAIgASgCODYCOCACIAEoAjw2AjwgAUHAAGohASACQcAAaiICIAVNDQALCyACIARPDQEDQCACIAEoAgA2AgAgAUEEaiEBIAJBBGoiAiAESQ0ADAILAAsCQCADQQRPDQAgACECDAELAkAgA0F8aiIEIABPDQAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCwJAIAIgA08NAANAIAIgAS0AADoAACABQQFqIQEgAkEBaiICIANHDQALCyAAC/ICAgN/AX4CQCACRQ0AIAAgAToAACACIABqIgNBf2ogAToAACACQQNJDQAgACABOgACIAAgAToAASADQX1qIAE6AAAgA0F+aiABOgAAIAJBB0kNACAAIAE6AAMgA0F8aiABOgAAIAJBCUkNACAAQQAgAGtBA3EiBGoiAyABQf8BcUGBgoQIbCIBNgIAIAMgAiAEa0F8cSIEaiICQXxqIAE2AgAgBEEJSQ0AIAMgATYCCCADIAE2AgQgAkF4aiABNgIAIAJBdGogATYCACAEQRlJDQAgAyABNgIYIAMgATYCFCADIAE2AhAgAyABNgIMIAJBcGogATYCACACQWxqIAE2AgAgAkFoaiABNgIAIAJBZGogATYCACAEIANBBHFBGHIiBWsiAkEgSQ0AIAGtQoGAgIAQfiEGIAMgBWohAQNAIAEgBjcDGCABIAY3AxAgASAGNwMIIAEgBjcDACABQSBqIQEgAkFgaiICQR9LDQALCyAAC/YCAQJ/AkAgACABRg0AAkAgASAAIAJqIgNrQQAgAkEBdGtLDQAgACABIAIQeQ8LIAEgAHNBA3EhBAJAAkACQCAAIAFPDQACQCAERQ0AIAAhAwwDCwJAIABBA3ENACAAIQMMAgsgACEDA0AgAkUNBCADIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiADQQFqIgNBA3FFDQIMAAsACwJAIAQNAAJAIANBA3FFDQADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAwDCwALIAJBA00NAANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIAJBfGoiAkEDSw0ACwsgAkUNAANAIAMgAS0AADoAACADQQFqIQMgAUEBaiEBIAJBf2oiAg0ACwsgAAsVAAJAIAANAEEADwsQaiAANgIAQX8L1gIBB38jAEEgayIDJAAgAyAAKAIcIgQ2AhAgACgCFCEFIAMgAjYCHCADIAE2AhggAyAFIARrIgE2AhQgASACaiEGQQIhByADQRBqIQECQAJAAkACQCAAKAI8IANBEGpBAiADQQxqEAcQfA0AA0AgBiADKAIMIgRGDQIgBEF/TA0DIAEgBCABKAIEIghLIgVBA3RqIgkgCSgCACAEIAhBACAFG2siCGo2AgAgAUEMQQQgBRtqIgkgCSgCACAIazYCACAGIARrIQYgACgCPCABQQhqIAEgBRsiASAHIAVrIgcgA0EMahAHEHxFDQALCyAGQX9HDQELIAAgACgCLCIBNgIcIAAgATYCFCAAIAEgACgCMGo2AhAgAiEEDAELQQAhBCAAQQA2AhwgAEIANwMQIAAgACgCAEEgcjYCACAHQQJGDQAgAiABKAIEayEECyADQSBqJAAgBAsEAEEACwQAQgALXAEBfyAAIAAoAkgiAUF/aiABcjYCSAJAIAAoAgAiAUEIcUUNACAAIAFBIHI2AgBBfw8LIABCADcCBCAAIAAoAiwiATYCHCAAIAE2AhQgACABIAAoAjBqNgIQQQALzQEBA38CQAJAIAIoAhAiAw0AQQAhBCACEIABDQEgAigCECEDCwJAIAMgAigCFCIFayABTw0AIAIgACABIAIoAiQRAQAPCwJAAkAgAigCUEEATg0AQQAhAwwBCyABIQQDQAJAIAQiAw0AQQAhAwwCCyAAIANBf2oiBGotAABBCkcNAAsgAiAAIAMgAigCJBEBACIEIANJDQEgACADaiEAIAEgA2shASACKAIUIQULIAUgACABEHkaIAIgAigCFCABajYCFCADIAFqIQQLIAQLWwECfyACIAFsIQQCQAJAIAMoAkxBf0oNACAAIAQgAxCBASEADAELIAMQhgEhBSAAIAQgAxCBASEAIAVFDQAgAxCHAQsCQCAAIARHDQAgAkEAIAEbDwsgACABbgseAQF/IAAQiAEhAkF/QQAgAiAAQQEgAiABEIIBRxsLkQEBA38jAEEQayICJAAgAiABOgAPAkACQCAAKAIQIgMNAEF/IQMgABCAAQ0BIAAoAhAhAwsCQCAAKAIUIgQgA0YNACAAKAJQIAFB/wFxIgNGDQAgACAEQQFqNgIUIAQgAToAAAwBC0F/IQMgACACQQ9qQQEgACgCJBEBAEEBRw0AIAItAA8hAwsgAkEQaiQAIAMLjwEBAn9BACEBAkBBACgCzFdBAEgNAEGA1wAQhgEhAQsCQAJAIABBgNcAEIMBQQBODQBBfyEADAELAkBBACgC0FdBCkYNAEEAKAKUVyICQQAoApBXRg0AQQAhAEEAIAJBAWo2ApRXIAJBCjoAAAwBC0GA1wBBChCEAUEfdSEACwJAIAFFDQBBgNcAEIcBCyAACwQAQQELAgALhwEBA38gACEBAkACQCAAQQNxRQ0AIAAhAQNAIAEtAABFDQIgAUEBaiIBQQNxDQALCwNAIAEiAkEEaiEBIAIoAgAiA0F/cyADQf/9+3dqcUGAgYKEeHFFDQALAkAgA0H/AXENACACIABrDwsDQCACLQABIQMgAkEBaiIBIQIgAw0ACwsgASAAawsEACMACwYAIAAkAAsSAQJ/IwAgAGtBcHEiASQAIAELDQAgASACIAMgABERAAskAQF+IAAgASACrSADrUIghoQgBBCMASEFIAVCIIinEAggBacLC6BQAgBBgAgL+E5wb3NDb3VudD09bm9ybUNvdW50AGdldAB2ZWN0b3IAc3JjL3dhc20vcmF5dHJhY2VyL21hdGVyaWFsLmhwcABzcmMvd2FzbS9yYXl0cmFjZXIvdGV4dHVyZS5ocHAAc3JjL3dhc20vQlZILmhwcABzcmMvd2FzbS9tYWluLmNwcABzdGQ6OmV4Y2VwdGlvbgBjb25zdHJ1Y3RfQlZIX2ludGVybmFsAGNyZWF0ZU1hdGVyaWFsAGNyZWF0ZUJvdW5kaW5nAGFsbG9jYXRvcjxUPjo6YWxsb2NhdGUoc2l6ZV90IG4pICduJyBleGNlZWRzIG1heGltdW0gc3VwcG9ydGVkIHNpemUASGVsbG8gV0FTTSBXb3JsZABzdGQ6Om1pbih7c3VyeCxzdXJ5LHN1cnp9KSE9SU5GRgB0eXBlID09IDAAaWQgPCAoaW50KXRleHR1cmVzLnNpemUoKQAAAAAAAKAFAAADAAAATjlSYXl0cmFjZXI3RGlmZnVzZUUATjlSYXl0cmFjZXI4TWF0ZXJpYWxFAABAEgAAgQUAAGgSAABsBQAAmAUAAAAAAAAAAAAAAAAAAJx1AIg85Dd+nHUAiDzkN36cdQCIPOQ3fv////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8L8AAAAAAADwv5x1AIg85Dd+nHUAiDzkN34DAAAABAAAAAQAAAAGAAAAg/miAERObgD8KRUA0VcnAN009QBi28AAPJmVAEGQQwBjUf4Au96rALdhxQA6biQA0k1CAEkG4AAJ6i4AHJLRAOsd/gApsRwA6D6nAPU1ggBEuy4AnOmEALQmcABBfl8A1pE5AFODOQCc9DkAi1+EACj5vQD4HzsA3v+XAA+YBQARL+8AClqLAG0fbQDPfjYACcsnAEZPtwCeZj8ALepfALondQDl68cAPXvxAPc5BwCSUooA+2vqAB+xXwAIXY0AMANWAHv8RgDwq2sAILzPADb0mgDjqR0AXmGRAAgb5gCFmWUAoBRfAI1AaACA2P8AJ3NNAAYGMQDKVhUAyahzAHviYABrjMAAGcRHAM1nwwAJ6NwAWYMqAIt2xACmHJYARK/dABlX0QClPgUABQf/ADN+PwDCMugAmE/eALt9MgAmPcMAHmvvAJ/4XgA1HzoAf/LKAPGHHQB8kCEAaiR8ANVu+gAwLXcAFTtDALUUxgDDGZ0ArcTCACxNQQAMAF0Ahn1GAONxLQCbxpoAM2IAALTSfAC0p5cAN1XVANc+9gCjEBgATXb8AGSdKgBw16sAY3z4AHqwVwAXFecAwElWADvW2QCnhDgAJCPLANaKdwBaVCMAAB+5APEKGwAZzt8AnzH/AGYeagCZV2EArPtHAH5/2AAiZbcAMuiJAOa/YADvxM0AbDYJAF0/1AAW3tcAWDveAN6bkgDSIigAKIboAOJYTQDGyjIACOMWAOB9ywAXwFAA8x2nABjgWwAuEzQAgxJiAINIAQD1jlsArbB/AB7p8gBISkMAEGfTAKrd2ACuX0IAamHOAAoopADTmbQABqbyAFx3fwCjwoMAYTyIAIpzeACvjFoAb9e9AC2mYwD0v8sAjYHvACbBZwBVykUAytk2ACio0gDCYY0AEsl3AAQmFAASRpsAxFnEAMjFRABNspEAABfzANRDrQApSeUA/dUQAAC+/AAelMwAcM7uABM+9QDs8YAAs+fDAMf4KACTBZQAwXE+AC4JswALRfMAiBKcAKsgewAutZ8AR5LCAHsyLwAMVW0AcqeQAGvnHwAxy5YAeRZKAEF54gD034kA6JSXAOLmhACZMZcAiO1rAF9fNgC7/Q4ASJq0AGekbABxckIAjV0yAJ8VuAC85QkAjTElAPd0OQAwBRwADQwBAEsIaAAs7lgAR6qQAHTnAgC91iQA932mAG5IcgCfFu8AjpSmALSR9gDRU1EAzwryACCYMwD1S34AsmNoAN0+XwBAXQMAhYl/AFVSKQA3ZMAAbdgQADJIMgBbTHUATnHUAEVUbgALCcEAKvVpABRm1QAnB50AXQRQALQ72wDqdsUAh/kXAElrfQAdJ7oAlmkpAMbMrACtFFQAkOJqAIjZiQAsclAABKS+AHcHlADzMHAAAPwnAOpxqABmwkkAZOA9AJfdgwCjP5cAQ5T9AA2GjAAxQd4AkjmdAN1wjAAXt+cACN87ABU3KwBcgKAAWoCTABARkgAP6NgAbICvANv/SwA4kA8AWRh2AGKlFQBhy7sAx4m5ABBAvQDS8gQASXUnAOu29gDbIrsAChSqAIkmLwBkg3YACTszAA6UGgBROqoAHaPCAK/trgBcJhIAbcJNAC16nADAVpcAAz+DAAnw9gArQIwAbTGZADm0BwAMIBUA2MNbAPWSxADGrUsATsqlAKc3zQDmqTYAq5KUAN1CaAAZY94AdozvAGiLUgD82zcArqGrAN8VMQAArqEADPvaAGRNZgDtBbcAKWUwAFdWvwBH/zoAavm5AHW+8wAok98Aq4AwAGaM9gAEyxUA+iIGANnkHQA9s6QAVxuPADbNCQBOQukAE76kADMjtQDwqhoAT2WoANLBpQALPw8AW3jNACP5dgB7iwQAiRdyAMamUwBvbuIA7+sAAJtKWADE2rcAqma6AHbPzwDRAh0AsfEtAIyZwQDDrXcAhkjaAPddoADGgPQArPAvAN3smgA/XLwA0N5tAJDHHwAq27YAoyU6AACvmgCtU5MAtlcEACkttABLgH4A2genAHaqDgB7WaEAFhIqANy3LQD65f0Aidv+AIm+/QDkdmwABqn8AD6AcACFbhUA/Yf/ACg+BwBhZzMAKhiGAE296gCz568Aj21uAJVnOQAxv1sAhNdIADDfFgDHLUMAJWE1AMlwzgAwy7gAv2z9AKQAogAFbOQAWt2gACFvRwBiEtIAuVyEAHBhSQBrVuAAmVIBAFBVNwAe1bcAM/HEABNuXwBdMOQAhS6pAB2ywwChMjYACLekAOqx1AAW9yEAj2nkACf/dwAMA4AAjUAtAE/NoAAgpZkAs6LTAC9dCgC0+UIAEdrLAH2+0ACb28EAqxe9AMqigQAIalwALlUXACcAVQB/FPAA4QeGABQLZACWQY0Ah77eANr9KgBrJbYAe4k0AAXz/gC5v54AaGpPAEoqqABPxFoALfi8ANdamAD0x5UADU2NACA6pgCkV18AFD+xAIA4lQDMIAEAcd2GAMnetgC/YPUATWURAAEHawCMsKwAssDQAFFVSAAe+w4AlXLDAKMGOwDAQDUABtx7AOBFzABOKfoA1srIAOjzQQB8ZN4Am2TYANm+MQCkl8MAd1jUAGnjxQDw2hMAujo8AEYYRgBVdV8A0r31AG6SxgCsLl0ADkTtABw+QgBhxIcAKf3pAOfW8wAifMoAb5E1AAjgxQD/140AbmriALD9xgCTCMEAfF10AGutsgDNbp0APnJ7AMYRagD3z6kAKXPfALXJugC3AFEA4rINAHS6JADlfWAAdNiKAA0VLACBGAwAfmaUAAEpFgCfenYA/f2+AFZF7wDZfjYA7NkTAIu6uQDEl/wAMagnAPFuwwCUxTYA2KhWALSotQDPzA4AEoktAG9XNAAsVokAmc7jANYguQBrXqoAPiqcABFfzAD9C0oA4fT7AI47bQDihiwA6dSEAPy0qQDv7tEALjXJAC85YQA4IUQAG9nIAIH8CgD7SmoALxzYAFO0hABOmYwAVCLMACpV3ADAxtYACxmWABpwuABplWQAJlpgAD9S7gB/EQ8A9LURAPzL9QA0vC0ANLzuAOhdzADdXmAAZ46bAJIz7wDJF7gAYVibAOFXvABRg8YA2D4QAN1xSAAtHN0ArxihACEsRgBZ89cA2XqYAJ5UwABPhvoAVgb8AOV5rgCJIjYAOK0iAGeT3ABV6KoAgiY4AMrnmwBRDaQAmTOxAKnXDgBpBUgAZbLwAH+IpwCITJcA+dE2ACGSswB7gkoAmM8hAECf3ADcR1UA4XQ6AGfrQgD+nd8AXtRfAHtnpAC6rHoAVfaiACuIIwBBulUAWW4IACEqhgA5R4MAiePmAOWe1ABJ+0AA/1bpABwPygDFWYoAlPorANPBxQAPxc8A21quAEfFhgCFQ2IAIYY7ACx5lAAQYYcAKkx7AIAsGgBDvxIAiCaQAHg8iQCoxOQA5dt7AMQ6wgAm9OoA92eKAA2SvwBloysAPZOxAL18CwCkUdwAJ91jAGnh3QCalBkAqCmVAGjOKAAJ7bQARJ8gAE6YygBwgmMAfnwjAA+5MgCn9Y4AFFbnACHxCAC1nSoAb35NAKUZUQC1+asAgt/WAJbdYQAWNgIAxDqfAIOioQBy7W0AOY16AIK4qQBrMlwARidbAAA07QDSAHcA/PRVAAFZTQDgcYAAAAAAAAAAAAAAAABA+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1AAAAAFQRAAAEAAAABQAAAAYAAABTdDlleGNlcHRpb24AAAAAQBIAAEQRAAAAAAAAgBEAAAEAAAAHAAAACAAAAFN0MTFsb2dpY19lcnJvcgBoEgAAcBEAAFQRAAAAAAAAtBEAAAEAAAAJAAAACAAAAFN0MTJsZW5ndGhfZXJyb3IAAAAAaBIAAKARAACAEQAAU3Q5dHlwZV9pbmZvAAAAAEASAADAEQAATjEwX19jeHhhYml2MTE2X19zaGltX3R5cGVfaW5mb0UAAAAAaBIAANgRAADQEQAATjEwX19jeHhhYml2MTE3X19jbGFzc190eXBlX2luZm9FAAAAaBIAAAgSAAD8EQAAAAAAACwSAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAAAAAAACwEgAACgAAABIAAAAMAAAADQAAAA4AAAATAAAAFAAAABUAAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAAAAAaBIAAIgSAAAsEgAAAAAAAP6CK2VHFWdAAAAAAAAAOEMAAPr+Qi52vzo7nrya9wy9vf3/////3z88VFVVVVXFP5ErF89VVaU/F9CkZxERgT8AAAAAAADIQu85+v5CLuY/JMSC/72/zj+19AzXCGusP8xQRtKrsoM/hDpOm+DXVT8AAAAAAAAAAAAAAAAAAPA/br+IGk87mzw1M/upPfbvP13c2JwTYHG8YYB3Pprs7z/RZocQel6QvIV/bugV4+8/E/ZnNVLSjDx0hRXTsNnvP/qO+SOAzou83vbdKWvQ7z9hyOZhTvdgPMibdRhFx+8/mdMzW+SjkDyD88bKPr7vP217g12mmpc8D4n5bFi17z/87/2SGrWOPPdHciuSrO8/0ZwvcD2+Pjyi0dMy7KPvPwtukIk0A2q8G9P+r2ab7z8OvS8qUlaVvFFbEtABk+8/VepOjO+AULzMMWzAvYrvPxb01bkjyZG84C2prpqC7z+vVVzp49OAPFGOpciYeu8/SJOl6hUbgLx7UX08uHLvPz0y3lXwH4+86o2MOPlq7z+/UxM/jImLPHXLb+tbY+8/JusRdpzZlrzUXASE4FvvP2AvOj737Jo8qrloMYdU7z+dOIbLguePvB3Z/CJQTe8/jcOmREFvijzWjGKIO0bvP30E5LAFeoA8ltx9kUk/7z+UqKjj/Y6WPDhidW56OO8/fUh08hhehzw/prJPzjHvP/LnH5grR4A83XziZUUr7z9eCHE/e7iWvIFj9eHfJO8/MasJbeH3gjzh3h/1nR7vP/q/bxqbIT28kNna0H8Y7z+0CgxygjeLPAsD5KaFEu8/j8vOiZIUbjxWLz6prwzvP7arsE11TYM8FbcxCv4G7z9MdKziAUKGPDHYTPxwAe8/SvjTXTndjzz/FmSyCPzuPwRbjjuAo4a88Z+SX8X27j9oUEvM7UqSvMupOjen8e4/ji1RG/gHmbxm2AVtruzuP9I2lD7o0XG895/lNNvn7j8VG86zGRmZvOWoE8Mt4+4/bUwqp0ifhTwiNBJMpt7uP4ppKHpgEpO8HICsBEXa7j9biRdIj6dYvCou9yEK1u4/G5pJZ5ssfLyXqFDZ9dHuPxGswmDtY0M8LYlhYAjO7j/vZAY7CWaWPFcAHe1Byu4/eQOh2uHMbjzQPMG1osbuPzASDz+O/5M83tPX8CrD7j+wr3q7zpB2PCcqNtXav+4/d+BU670dkzwN3f2ZsrzuP46jcQA0lI+8pyyddrK57j9Jo5PczN6HvEJmz6Latu4/XzgPvcbeeLyCT51WK7TuP/Zce+xGEoa8D5JdyqSx7j+O1/0YBTWTPNontTZHr+4/BZuKL7eYezz9x5fUEq3uPwlUHOLhY5A8KVRI3Qer7j/qxhlQhcc0PLdGWYomqe4/NcBkK+YylDxIIa0Vb6fuP592mWFK5Iy8Cdx2ueGl7j+oTe87xTOMvIVVOrB+pO4/rukriXhThLwgw8w0RqPuP1hYVnjdzpO8JSJVgjii7j9kGX6AqhBXPHOpTNRVoe4/KCJev++zk7zNO39mnqDuP4K5NIetEmq8v9oLdRKg7j/uqW2472djvC8aZTyyn+4/UYjgVD3cgLyElFH5fZ/uP88+Wn5kH3i8dF/s6HWf7j+wfYvASu6GvHSBpUian+4/iuZVHjIZhrzJZ0JW65/uP9PUCV7LnJA8P13eT2mg7j8dpU253DJ7vIcB63MUoe4/a8BnVP3slDwywTAB7aHuP1Vs1qvh62U8Yk7PNvOi7j9Cz7MvxaGIvBIaPlQnpO4/NDc78bZpk7wTzkyZiaXuPx7/GTqEXoC8rccjRhqn7j9uV3LYUNSUvO2SRJvZqO4/AIoOW2etkDyZZorZx6ruP7Tq8MEvt40826AqQuWs7j//58WcYLZlvIxEtRYyr+4/RF/zWYP2ezw2dxWZrrHuP4M9HqcfCZO8xv+RC1u07j8pHmyLuKldvOXFzbA3t+4/WbmQfPkjbLwPUsjLRLruP6r59CJDQ5K8UE7en4K97j9LjmbXbMqFvLoHynDxwO4/J86RK/yvcTyQ8KOCkcTuP7tzCuE10m08IyPjGWPI7j9jImIiBMWHvGXlXXtmzO4/1THi44YcizwzLUrsm9DuPxW7vNPRu5G8XSU+sgPV7j/SMe6cMcyQPFizMBOe2e4/s1pzboRphDy//XlVa97uP7SdjpfN34K8evPTv2vj7j+HM8uSdxqMPK3TWpmf6O4/+tnRSo97kLxmto0pB+7uP7qu3FbZw1W8+xVPuKLz7j9A9qY9DqSQvDpZ5Y1y+e4/NJOtOPTWaLxHXvvydv/uPzWKWGvi7pG8SgahMLAF7z/N3V8K1/90PNLBS5AeDO8/rJiS+vu9kbwJHtdbwhLvP7MMrzCubnM8nFKF3ZsZ7z+U/Z9cMuOOPHrQ/1+rIO8/rFkJ0Y/ghDxL0Vcu8SfvP2caTjivzWM8tecGlG0v7z9oGZJsLGtnPGmQ79wgN+8/0rXMgxiKgLz6w11VCz/vP2/6/z9drY+8fIkHSi1H7z9JqXU4rg2QvPKJDQiHT+8/pwc9poWjdDyHpPvcGFjvPw8iQCCekYK8mIPJFuNg7z+sksHVUFqOPIUy2wPmae8/S2sBrFk6hDxgtAHzIXPvPx8+tAch1YK8X5t7M5d87z/JDUc7uSqJvCmh9RRGhu8/04g6YAS2dDz2P4vnLpDvP3FynVHsxYM8g0zH+1Ga7z/wkdOPEvePvNqQpKKvpO8/fXQj4piujbzxZ44tSK/vPwggqkG8w448J1ph7hu67z8y66nDlCuEPJe6azcrxe8/7oXRMalkijxARW5bdtDvP+3jO+S6N468FL6crf3b7z+dzZFNO4l3PNiQnoHB5+8/icxgQcEFUzzxcY8rwvPvPwA4+v5CLuY/MGfHk1fzLj0AAAAAAADgv2BVVVVVVeW/BgAAAAAA4D9OVVmZmZnpP3qkKVVVVeW/6UVIm1tJ8r/DPyaLKwDwPwAAAAAAoPY/AAAAAAAAAAAAyLnygizWv4BWNygktPo8AAAAAACA9j8AAAAAAAAAAAAIWL+90dW/IPfg2AilHL0AAAAAAGD2PwAAAAAAAAAAAFhFF3d21b9tULbVpGIjvQAAAAAAQPY/AAAAAAAAAAAA+C2HrRrVv9VnsJ7khOa8AAAAAAAg9j8AAAAAAAAAAAB4d5VfvtS/4D4pk2kbBL0AAAAAAAD2PwAAAAAAAAAAAGAcwoth1L/MhExIL9gTPQAAAAAA4PU/AAAAAAAAAAAAqIaGMATUvzoLgu3zQtw8AAAAAADA9T8AAAAAAAAAAABIaVVMptO/YJRRhsaxID0AAAAAAKD1PwAAAAAAAAAAAICYmt1H07+SgMXUTVklPQAAAAAAgPU/AAAAAAAAAAAAIOG64ujSv9grt5keeyY9AAAAAABg9T8AAAAAAAAAAACI3hNaidK/P7DPthTKFT0AAAAAAGD1PwAAAAAAAAAAAIjeE1qJ0r8/sM+2FMoVPQAAAAAAQPU/AAAAAAAAAAAAeM/7QSnSv3baUygkWha9AAAAAAAg9T8AAAAAAAAAAACYacGYyNG/BFTnaLyvH70AAAAAAAD1PwAAAAAAAAAAAKirq1xn0b/wqIIzxh8fPQAAAAAA4PQ/AAAAAAAAAAAASK75iwXRv2ZaBf3EqCa9AAAAAADA9D8AAAAAAAAAAACQc+Iko9C/DgP0fu5rDL0AAAAAAKD0PwAAAAAAAAAAANC0lCVA0L9/LfSeuDbwvAAAAAAAoPQ/AAAAAAAAAAAA0LSUJUDQv38t9J64NvC8AAAAAACA9D8AAAAAAAAAAABAXm0Yuc+/hzyZqypXDT0AAAAAAGD0PwAAAAAAAAAAAGDcy63wzr8kr4actyYrPQAAAAAAQPQ/AAAAAAAAAAAA8CpuByfOvxD/P1RPLxe9AAAAAAAg9D8AAAAAAAAAAADAT2shXM2/G2jKu5G6IT0AAAAAAAD0PwAAAAAAAAAAAKCax/ePzL80hJ9oT3knPQAAAAAAAPQ/AAAAAAAAAAAAoJrH94/MvzSEn2hPeSc9AAAAAADg8z8AAAAAAAAAAACQLXSGwsu/j7eLMbBOGT0AAAAAAMDzPwAAAAAAAAAAAMCATsnzyr9mkM0/Y066PAAAAAAAoPM/AAAAAAAAAAAAsOIfvCPKv+rBRtxkjCW9AAAAAACg8z8AAAAAAAAAAACw4h+8I8q/6sFG3GSMJb0AAAAAAIDzPwAAAAAAAAAAAFD0nFpSyb/j1MEE2dEqvQAAAAAAYPM/AAAAAAAAAAAA0CBloH/Ivwn623+/vSs9AAAAAABA8z8AAAAAAAAAAADgEAKJq8e/WEpTcpDbKz0AAAAAAEDzPwAAAAAAAAAAAOAQAomrx79YSlNykNsrPQAAAAAAIPM/AAAAAAAAAAAA0BnnD9bGv2bisqNq5BC9AAAAAAAA8z8AAAAAAAAAAACQp3Aw/8W/OVAQn0OeHr0AAAAAAADzPwAAAAAAAAAAAJCncDD/xb85UBCfQ54evQAAAAAA4PI/AAAAAAAAAAAAsKHj5SbFv49bB5CL3iC9AAAAAADA8j8AAAAAAAAAAACAy2wrTcS/PHg1YcEMFz0AAAAAAMDyPwAAAAAAAAAAAIDLbCtNxL88eDVhwQwXPQAAAAAAoPI/AAAAAAAAAAAAkB4g/HHDvzpUJ02GePE8AAAAAACA8j8AAAAAAAAAAADwH/hSlcK/CMRxFzCNJL0AAAAAAGDyPwAAAAAAAAAAAGAv1Sq3wb+WoxEYpIAuvQAAAAAAYPI/AAAAAAAAAAAAYC/VKrfBv5ajERikgC69AAAAAABA8j8AAAAAAAAAAACQ0Hx+18C/9FvoiJZpCj0AAAAAAEDyPwAAAAAAAAAAAJDQfH7XwL/0W+iIlmkKPQAAAAAAIPI/AAAAAAAAAAAA4Nsxkey/v/Izo1xUdSW9AAAAAAAA8j8AAAAAAAAAAAAAK24HJ76/PADwKiw0Kj0AAAAAAADyPwAAAAAAAAAAAAArbgcnvr88APAqLDQqPQAAAAAA4PE/AAAAAAAAAAAAwFuPVF68vwa+X1hXDB29AAAAAADA8T8AAAAAAAAAAADgSjptkrq/yKpb6DU5JT0AAAAAAMDxPwAAAAAAAAAAAOBKOm2Sur/IqlvoNTklPQAAAAAAoPE/AAAAAAAAAAAAoDHWRcO4v2hWL00pfBM9AAAAAACg8T8AAAAAAAAAAACgMdZFw7i/aFYvTSl8Ez0AAAAAAIDxPwAAAAAAAAAAAGDlitLwtr/aczPJN5cmvQAAAAAAYPE/AAAAAAAAAAAAIAY/Bxu1v1dexmFbAh89AAAAAABg8T8AAAAAAAAAAAAgBj8HG7W/V17GYVsCHz0AAAAAAEDxPwAAAAAAAAAAAOAbltdBs7/fE/nM2l4sPQAAAAAAQPE/AAAAAAAAAAAA4BuW10Gzv98T+czaXiw9AAAAAAAg8T8AAAAAAAAAAACAo+42ZbG/CaOPdl58FD0AAAAAAADxPwAAAAAAAAAAAIARwDAKr7+RjjaDnlktPQAAAAAAAPE/AAAAAAAAAAAAgBHAMAqvv5GONoOeWS09AAAAAADg8D8AAAAAAAAAAACAGXHdQqu/THDW5XqCHD0AAAAAAODwPwAAAAAAAAAAAIAZcd1Cq79McNbleoIcPQAAAAAAwPA/AAAAAAAAAAAAwDL2WHSnv+6h8jRG/Cy9AAAAAADA8D8AAAAAAAAAAADAMvZYdKe/7qHyNEb8LL0AAAAAAKDwPwAAAAAAAAAAAMD+uYeeo7+q/ib1twL1PAAAAAAAoPA/AAAAAAAAAAAAwP65h56jv6r+JvW3AvU8AAAAAACA8D8AAAAAAAAAAAAAeA6bgp+/5Al+fCaAKb0AAAAAAIDwPwAAAAAAAAAAAAB4DpuCn7/kCX58JoApvQAAAAAAYPA/AAAAAAAAAAAAgNUHG7mXvzmm+pNUjSi9AAAAAABA8D8AAAAAAAAAAAAA/LCowI+/nKbT9nwe37wAAAAAAEDwPwAAAAAAAAAAAAD8sKjAj7+cptP2fB7fvAAAAAAAIPA/AAAAAAAAAAAAABBrKuB/v+RA2g0/4hm9AAAAAAAg8D8AAAAAAAAAAAAAEGsq4H+/5EDaDT/iGb0AAAAAAADwPwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA7z8AAAAAAAAAAAAAiXUVEIA/6CudmWvHEL0AAAAAAIDvPwAAAAAAAAAAAICTWFYgkD/S9+IGW9wjvQAAAAAAQO8/AAAAAAAAAAAAAMkoJUmYPzQMWjK6oCq9AAAAAAAA7z8AAAAAAAAAAABA54ldQaA/U9fxXMARAT0AAAAAAMDuPwAAAAAAAAAAAAAu1K5mpD8o/b11cxYsvQAAAAAAgO4/AAAAAAAAAAAAwJ8UqpSoP30mWtCVeRm9AAAAAABA7j8AAAAAAAAAAADA3c1zy6w/ByjYR/JoGr0AAAAAACDuPwAAAAAAAAAAAMAGwDHqrj97O8lPPhEOvQAAAAAA4O0/AAAAAAAAAAAAYEbRO5exP5ueDVZdMiW9AAAAAACg7T8AAAAAAAAAAADg0af1vbM/107bpV7ILD0AAAAAAGDtPwAAAAAAAAAAAKCXTVrptT8eHV08BmksvQAAAAAAQO0/AAAAAAAAAAAAwOoK0wC3PzLtnamNHuw8AAAAAAAA7T8AAAAAAAAAAABAWV1eM7k/2ke9OlwRIz0AAAAAAMDsPwAAAAAAAAAAAGCtjchquz/laPcrgJATvQAAAAAAoOw/AAAAAAAAAAAAQLwBWIi8P9OsWsbRRiY9AAAAAABg7D8AAAAAAAAAAAAgCoM5x74/4EXmr2jALb0AAAAAAEDsPwAAAAAAAAAAAODbOZHovz/9CqFP1jQlvQAAAAAAAOw/AAAAAAAAAAAA4CeCjhfBP/IHLc547yE9AAAAAADg6z8AAAAAAAAAAADwI34rqsE/NJk4RI6nLD0AAAAAAKDrPwAAAAAAAAAAAICGDGHRwj+htIHLbJ0DPQAAAAAAgOs/AAAAAAAAAAAAkBWw/GXDP4lySyOoL8Y8AAAAAABA6z8AAAAAAAAAAACwM4M9kcQ/eLb9VHmDJT0AAAAAACDrPwAAAAAAAAAAALCh5OUnxT/HfWnl6DMmPQAAAAAA4Oo/AAAAAAAAAAAAEIy+TlfGP3guPCyLzxk9AAAAAADA6j8AAAAAAAAAAABwdYsS8MY/4SGc5Y0RJb0AAAAAAKDqPwAAAAAAAAAAAFBEhY2Jxz8FQ5FwEGYcvQAAAAAAYOo/AAAAAAAAAAAAADnrr77IP9Es6apUPQe9AAAAAABA6j8AAAAAAAAAAAAA99xaWsk/b/+gWCjyBz0AAAAAAADqPwAAAAAAAAAAAOCKPO2Tyj9pIVZQQ3IovQAAAAAA4Ok/AAAAAAAAAAAA0FtX2DHLP6rhrE6NNQy9AAAAAADA6T8AAAAAAAAAAADgOziH0Ms/thJUWcRLLb0AAAAAAKDpPwAAAAAAAAAAABDwxvtvzD/SK5bFcuzxvAAAAAAAYOk/AAAAAAAAAAAAkNSwPbHNPzWwFfcq/yq9AAAAAABA6T8AAAAAAAAAAAAQ5/8OU84/MPRBYCcSwjwAAAAAACDpPwAAAAAAAAAAAADd5K31zj8RjrtlFSHKvAAAAAAAAOk/AAAAAAAAAAAAsLNsHJnPPzDfDMrsyxs9AAAAAADA6D8AAAAAAAAAAABYTWA4cdA/kU7tFtuc+DwAAAAAAKDoPwAAAAAAAAAAAGBhZy3E0D/p6jwWixgnPQAAAAAAgOg/AAAAAAAAAAAA6CeCjhfRPxzwpWMOISy9AAAAAABg6D8AAAAAAAAAAAD4rMtca9E/gRal982aKz0AAAAAAEDoPwAAAAAAAAAAAGhaY5m/0T+3vUdR7aYsPQAAAAAAIOg/AAAAAAAAAAAAuA5tRRTSP+q6Rrrehwo9AAAAAADg5z8AAAAAAAAAAACQ3HzwvtI/9ARQSvqcKj0AAAAAAMDnPwAAAAAAAAAAAGDT4fEU0z+4PCHTeuIovQAAAAAAoOc/AAAAAAAAAAAAEL52Z2vTP8h38bDNbhE9AAAAAACA5z8AAAAAAAAAAAAwM3dSwtM/XL0GtlQ7GD0AAAAAAGDnPwAAAAAAAAAAAOjVI7QZ1D+d4JDsNuQIPQAAAAAAQOc/AAAAAAAAAAAAyHHCjXHUP3XWZwnOJy+9AAAAAAAg5z8AAAAAAAAAAAAwF57gydQ/pNgKG4kgLr0AAAAAAADnPwAAAAAAAAAAAKA4B64i1T9Zx2SBcL4uPQAAAAAA4OY/AAAAAAAAAAAA0MhT93vVP+9AXe7trR89AAAAAADA5j8AAAAAAAAAAABgWd+91dU/3GWkCCoLCr0AQfjWAAuYAaA8UAAAAAAABQAAAAAAAAAAAAAAFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAABgAAACYOAAAAAQAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAP////8KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJUBCXByb2R1Y2VycwIIbGFuZ3VhZ2UCA0M5OQAOQ19wbHVzX3BsdXNfMTQADHByb2Nlc3NlZC1ieQEFY2xhbmdWMTQuMC4wIChodHRwczovL2dpdGh1Yi5jb20vbGx2bS9sbHZtLXByb2plY3QgNDM0OGNkNDJjMzg1ZTcxYjYzZTVkYTdlNDkyMTcyY2ZmNmE3OWQ3Yik=";

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
       * @param {string} url wasm file url
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
    exports.GLTFLoader = GLTFLoader;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aHRyYWNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvcmVuZGVyZXIvUmVuZGVyZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IzLnRzIiwiLi4vLi4vc3JjL21hdGgvVmVjdG9yNC50cyIsIi4uLy4uL3NyYy9tYXRoL01hdHJpeDQudHMiLCIuLi8uLi9zcmMvbWF0aC9RdWF0ZXJuaW9uLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvVHJhbnNmb3JtLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTW9kZWwudHMiLCIuLi8uLi9zcmMvY29yZS9tb2RlbC9HTFRGTG9hZGVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTWF0ZXJpYWwudHMiLCIuLi8uLi9zcmMvY29yZS9jYW1lcmEvQ2FtZXJhLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9UZXh0dXJlLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtQnVmZmVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTW9kdWxlLmpzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTWFuYWdlci50cyIsIi4uLy4uL3NyYy9tYXRoL1ZlY3RvcjIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCwiLyogZXNsaW50LWRpc2FibGUgcHJlZmVyLXJlc3QtcGFyYW1zICovXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnMgKi9cbi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1zcHJlYWQgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXJldHVybi1hc3NpZ24gKi9cbi8qIGVzbGludC1kaXNhYmxlIGNvbnNpc3RlbnQtcmV0dXJuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1tdWx0aS1hc3NpZ24gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnRpbnVlICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wbHVzcGx1cyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tbmVzdGVkLXRlcm5hcnkgKi9cbi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1kZXN0cnVjdHVyaW5nICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1iaXR3aXNlICovXG4vKiBlc2xpbnQtZGlzYWJsZSB2YXJzLW9uLXRvcCAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcGFyYW0tcmVhc3NpZ24gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXNoYWRvdyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tdXNlLWJlZm9yZS1kZWZpbmUgKi9cbi8qIGVzbGludC1kaXNhYmxlIGdsb2JhbC1yZXF1aXJlICovXG4vKiBlc2xpbnQtZGlzYWJsZSBjYW1lbGNhc2UgKi9cbmltcG9ydCBtYWluV2FzbSBmcm9tICcuLi8uLi8uLi9idWlsZC93YXNtL21haW4ud2FzbSc7XG5cbmV4cG9ydCAvKipcbiAqIFdhc20gbW9kdWxlIGdlbmVyYXRvci4gVGhpcyBjb2RlIGlzIGJhc2VkIG9uIEVtc2NyaXB0ZW4gZGVmYXVsdCBqcyB0ZW1wbGF0ZS5cbiAqXG4gKiBAcmV0dXJuIHsqfSBcbiAqL1xuY29uc3QgV2FzbU1vZHVsZUdlbmVyYXRvciA9ICh3b3JrZXJHbG9iYWxTY29wZSA9IG51bGwpID0+IHtcbiAgICBjb25zdCBNb2R1bGUgPSB7fTtcbiAgICBsZXQgYXJndW1lbnRzXyA9IFtdO1xuICAgIGxldCB0aGlzUHJvZ3JhbSA9IFwiLi90aGlzLnByb2dyYW1cIjtcbiAgICBsZXQgcXVpdF8gPSBmdW5jdGlvbihzdGF0dXMsIHRvVGhyb3cpIHtcbiAgICAgICAgdGhyb3cgdG9UaHJvd1xuICAgIH07XG4gICAgY29uc3QgRU5WSVJPTk1FTlRfSVNfV0VCID0gdHlwZW9mIHdpbmRvdyA9PT0gXCJvYmplY3RcIjtcbiAgICBjb25zdCBFTlZJUk9OTUVOVF9JU19XT1JLRVIgPSB0eXBlb2YgaW1wb3J0U2NyaXB0cyA9PT0gXCJmdW5jdGlvblwiO1xuICAgIGNvbnN0IEVOVklST05NRU5UX0lTX05PREUgPSB0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcHJvY2Vzcy52ZXJzaW9ucyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcHJvY2Vzcy52ZXJzaW9ucy5ub2RlID09PSBcInN0cmluZ1wiO1xuICAgIGxldCBzY3JpcHREaXJlY3RvcnkgPSBcIlwiO1xuXG4gICAgZnVuY3Rpb24gbG9jYXRlRmlsZShwYXRoKSB7XG4gICAgICAgIGlmIChNb2R1bGUubG9jYXRlRmlsZSkge1xuICAgICAgICAgICAgcmV0dXJuIE1vZHVsZS5sb2NhdGVGaWxlKHBhdGgsIHNjcmlwdERpcmVjdG9yeSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2NyaXB0RGlyZWN0b3J5ICsgcGF0aFxuICAgIH1cbiAgICBsZXQgcmVhZF87IGxldCByZWFkQXN5bmM7IGxldCByZWFkQmluYXJ5O1xuXG4gICAgZnVuY3Rpb24gbG9nRXhjZXB0aW9uT25FeGl0KGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFeGl0U3RhdHVzKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRvTG9nID0gZTtcbiAgICAgICAgZXJyKGBleGl0aW5nIGR1ZSB0byBleGNlcHRpb246ICR7ICB0b0xvZ31gKVxuICAgIH1cbiAgICBsZXQgbm9kZUZTO1xuICAgIGxldCBub2RlUGF0aDtcbiAgICBpZiAoRU5WSVJPTk1FTlRfSVNfTk9ERSkge1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBgJHtyZXF1aXJlKFwicGF0aFwiKS5kaXJuYW1lKHNjcmlwdERpcmVjdG9yeSkgIH0vYFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gYCR7X19kaXJuYW1lICB9L2BcbiAgICAgICAgfVxuICAgICAgICByZWFkXyA9IGZ1bmN0aW9uIHNoZWxsX3JlYWQoZmlsZW5hbWUsIGJpbmFyeSkge1xuICAgICAgICAgICAgaWYgKCFub2RlRlMpIG5vZGVGUyA9IHJlcXVpcmUoXCJmc1wiKTtcbiAgICAgICAgICAgIGlmICghbm9kZVBhdGgpIG5vZGVQYXRoID0gcmVxdWlyZShcInBhdGhcIik7XG4gICAgICAgICAgICBmaWxlbmFtZSA9IG5vZGVQYXRoLm5vcm1hbGl6ZShmaWxlbmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZUZTLnJlYWRGaWxlU3luYyhmaWxlbmFtZSwgYmluYXJ5ID8gbnVsbCA6IFwidXRmOFwiKVxuICAgICAgICB9O1xuICAgICAgICByZWFkQmluYXJ5ID0gZnVuY3Rpb24gcmVhZEJpbmFyeShmaWxlbmFtZSkge1xuICAgICAgICAgICAgbGV0IHJldCA9IHJlYWRfKGZpbGVuYW1lLCB0cnVlKTtcbiAgICAgICAgICAgIGlmICghcmV0LmJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldCA9IG5ldyBVaW50OEFycmF5KHJldClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFzc2VydChyZXQuYnVmZmVyKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZEFzeW5jID0gZnVuY3Rpb24gcmVhZEFzeW5jKGZpbGVuYW1lLCBvbmxvYWQsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICghbm9kZUZTKSBub2RlRlMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICBpZiAoIW5vZGVQYXRoKSBub2RlUGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xuICAgICAgICAgICAgZmlsZW5hbWUgPSBub2RlUGF0aC5ub3JtYWxpemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgbm9kZUZTLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgb25lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIGVsc2Ugb25sb2FkKGRhdGEuYnVmZmVyKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHByb2Nlc3MuYXJndi5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aGlzUHJvZ3JhbSA9IHByb2Nlc3MuYXJndlsxXS5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxuICAgICAgICB9XG4gICAgICAgIGFyZ3VtZW50c18gPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZHVsZVxuICAgICAgICB9XG4gICAgICAgIHByb2Nlc3Mub24oXCJ1bmNhdWdodEV4Y2VwdGlvblwiLCAoZXgpID0+IHtcbiAgICAgICAgICAgIGlmICghKGV4IGluc3RhbmNlb2YgRXhpdFN0YXR1cykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBleFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcHJvY2Vzcy5vbihcInVuaGFuZGxlZFJlamVjdGlvblwiLCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyByZWFzb25cbiAgICAgICAgfSk7XG4gICAgICAgIHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgICAgICBpZiAoa2VlcFJ1bnRpbWVBbGl2ZSgpKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5leGl0Q29kZSA9IHN0YXR1cztcbiAgICAgICAgICAgICAgICB0aHJvdyB0b1Rocm93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2dFeGNlcHRpb25PbkV4aXQodG9UaHJvdyk7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoc3RhdHVzKVxuICAgICAgICB9O1xuICAgICAgICBNb2R1bGUuaW5zcGVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiW0Vtc2NyaXB0ZW4gTW9kdWxlIG9iamVjdF1cIlxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChFTlZJUk9OTUVOVF9JU19XRUIgfHwgRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLWdsb2JhbHNcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IHNlbGYubG9jYXRpb24uaHJlZlxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkb2N1bWVudC5jdXJyZW50U2NyaXB0KSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBkb2N1bWVudC5jdXJyZW50U2NyaXB0LnNyY1xuICAgICAgICB9XG4gICAgICAgIGlmIChzY3JpcHREaXJlY3RvcnkuaW5kZXhPZihcImJsb2I6XCIpICE9PSAwKSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBzY3JpcHREaXJlY3Rvcnkuc3Vic3RyKDAsIHNjcmlwdERpcmVjdG9yeS5yZXBsYWNlKC9bPyNdLiovLCBcIlwiKS5sYXN0SW5kZXhPZihcIi9cIikgKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIlxuICAgICAgICB9XG4gICAgICAgIHJlYWRfID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIGZhbHNlKTtcbiAgICAgICAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgcmVhZEJpbmFyeSA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuICAgICAgICAgICAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSh4aHIucmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVhZEFzeW5jID0gZnVuY3Rpb24odXJsLCBvbmxvYWQsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgICAgIHhoci5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuICAgICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDAgfHwgeGhyLnN0YXR1cyA9PT0gMCAmJiB4aHIucmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgb25sb2FkKHhoci5yZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbmVycm9yKClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB4aHIub25lcnJvciA9IG9uZXJyb3I7XG4gICAgICAgICAgICB4aHIuc2VuZChudWxsKVxuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IG91dCA9IE1vZHVsZS5wcmludCB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGNvbnN0IGVyciA9IE1vZHVsZS5wcmludEVyciB8fCBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIGlmIChNb2R1bGUuYXJndW1lbnRzKSBhcmd1bWVudHNfID0gTW9kdWxlLmFyZ3VtZW50cztcbiAgICBpZiAoTW9kdWxlLnRoaXNQcm9ncmFtKSB0aGlzUHJvZ3JhbSA9IE1vZHVsZS50aGlzUHJvZ3JhbTtcbiAgICBpZiAoTW9kdWxlLnF1aXQpIHF1aXRfID0gTW9kdWxlLnF1aXQ7XG5cbiAgICBmdW5jdGlvbiBiYXNlNjRUb0FycmF5QnVmZmVyKGJhc2U2NCkge1xuICAgICAgICBsZXQgYmluYXJ5X3N0cmluZyA9ICcnO1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfTk9ERSkge1xuICAgICAgICAgICAgYmluYXJ5X3N0cmluZyA9IEJ1ZmZlci5mcm9tKGJhc2U2NCwgJ2Jhc2U2NCcpLnRvU3RyaW5nKCdhc2NpaScpO1xuICAgICAgICB9IGVsc2UgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSB3b3JrZXJHbG9iYWxTY29wZS5hdG9iKGJhc2U2NCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSB3aW5kb3cuYXRvYihiYXNlNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICBjb25zdCBsZW4gPSBiaW5hcnlfc3RyaW5nLmxlbmd0aDtcbiAgICAgICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShsZW4pO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGJ5dGVzW2ldID0gYmluYXJ5X3N0cmluZy5jaGFyQ29kZUF0KGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlcy5idWZmZXI7XG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbUJpbmFyeSA9IGJhc2U2NFRvQXJyYXlCdWZmZXIobWFpbldhc20pO1xuICAgIGNvbnN0IG5vRXhpdFJ1bnRpbWUgPSBNb2R1bGUubm9FeGl0UnVudGltZSB8fCB0cnVlO1xuICAgIGlmICh0eXBlb2YgV2ViQXNzZW1ibHkgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgYWJvcnQoXCJubyBuYXRpdmUgd2FzbSBzdXBwb3J0IGRldGVjdGVkXCIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0VmFsdWUocHRyLCB2YWx1ZSwgdHlwZSkge1xuICAgICAgICB0eXBlID0gdHlwZSB8fCBcImk4XCI7XG4gICAgICAgIGlmICh0eXBlLmNoYXJBdCh0eXBlLmxlbmd0aCAtIDEpID09PSBcIipcIikgdHlwZSA9IFwiaTMyXCI7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImkxXCI6XG4gICAgICAgICAgICAgICAgSEVBUDhbcHRyID4+IDBdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaThcIjpcbiAgICAgICAgICAgICAgICBIRUFQOFtwdHIgPj4gMF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJpMTZcIjpcbiAgICAgICAgICAgICAgICBIRUFQMTZbcHRyID4+IDFdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaTMyXCI6XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciA+PiAyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImk2NFwiOlxuICAgICAgICAgICAgICAgIHRlbXBJNjQgPSBbXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID4+PiAwLFxuICAgICAgICAgICAgICAgICAgICAodGVtcERvdWJsZSA9IHZhbHVlLCArTWF0aC5hYnModGVtcERvdWJsZSkgPj0gMSA/IHRlbXBEb3VibGUgPiAwID8gKE1hdGgubWluKCtNYXRoLmZsb29yKHRlbXBEb3VibGUgLyA0Mjk0OTY3Mjk2KSwgNDI5NDk2NzI5NSkgfCAwKSA+Pj4gMCA6IH5+K01hdGguY2VpbCgodGVtcERvdWJsZSAtICsofn50ZW1wRG91YmxlID4+PiAwKSkgLyA0Mjk0OTY3Mjk2KSA+Pj4gMCA6IDApXTtcbiAgICAgICAgICAgICAgICBIRUFQMzJbcHRyID4+IDJdID0gdGVtcEk2NFswXTtcbiAgICAgICAgICAgICAgICBIRUFQMzJbcHRyICsgNCA+PiAyXSA9IHRlbXBJNjRbMV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICAgICAgICBIRUFQRjMyW3B0ciA+PiAyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImRvdWJsZVwiOlxuICAgICAgICAgICAgICAgIEhFQVBGNjRbcHRyID4+IDNdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFib3J0KGBpbnZhbGlkIHR5cGUgZm9yIHNldFZhbHVlOiAkeyAgdHlwZX1gKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VmFsdWUocHRyLCB0eXBlKSB7XG4gICAgICAgIHR5cGUgPSB0eXBlIHx8IFwiaThcIjtcbiAgICAgICAgaWYgKHR5cGUuY2hhckF0KHR5cGUubGVuZ3RoIC0gMSkgPT09IFwiKlwiKSB0eXBlID0gXCJpMzJcIjtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFwiaTFcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDhbcHRyID4+IDBdO1xuICAgICAgICAgICAgY2FzZSBcImk4XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3B0ciA+PiAwXTtcbiAgICAgICAgICAgIGNhc2UgXCJpMTZcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDE2W3B0ciA+PiAxXTtcbiAgICAgICAgICAgIGNhc2UgXCJpMzJcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJpNjRcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBIRUFQRjMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKEhFQVBGNjRbcHRyID4+IDNdKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYWJvcnQoYGludmFsaWQgdHlwZSBmb3IgZ2V0VmFsdWU6ICR7ICB0eXBlfWApXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgbGV0IHdhc21NZW1vcnk7XG4gICAgbGV0IEFCT1JUID0gZmFsc2U7XG4gICAgbGV0IEVYSVRTVEFUVVM7XG5cbiAgICBmdW5jdGlvbiBhc3NlcnQoY29uZGl0aW9uLCB0ZXh0KSB7XG4gICAgICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgICAgICBhYm9ydChgQXNzZXJ0aW9uIGZhaWxlZDogJHsgIHRleHR9YClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldENGdW5jKGlkZW50KSB7XG4gICAgICAgIGNvbnN0IGZ1bmMgPSBNb2R1bGVbYF8keyAgaWRlbnR9YF07XG4gICAgICAgIGFzc2VydChmdW5jLCBgQ2Fubm90IGNhbGwgdW5rbm93biBmdW5jdGlvbiAkeyAgaWRlbnQgIH0sIG1ha2Ugc3VyZSBpdCBpcyBleHBvcnRlZGApO1xuICAgICAgICByZXR1cm4gZnVuY1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNjYWxsKGlkZW50LCByZXR1cm5UeXBlLCBhcmdUeXBlcywgYXJncykge1xuICAgICAgICBjb25zdCB0b0MgPSB7XG4gICAgICAgICAgICBcInN0cmluZ1wiOiBmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0ID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoc3RyICE9PSBudWxsICYmIHN0ciAhPT0gdW5kZWZpbmVkICYmIHN0ciAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSAoc3RyLmxlbmd0aCA8PCAyKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldCA9IHN0YWNrQWxsb2MobGVuKTtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5nVG9VVEY4KHN0ciwgcmV0LCBsZW4pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcImFycmF5XCI6IGZ1bmN0aW9uKGFycikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldCA9IHN0YWNrQWxsb2MoYXJyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgd3JpdGVBcnJheVRvTWVtb3J5KGFyciwgcmV0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gY29udmVydFJldHVyblZhbHVlKHJldCkge1xuICAgICAgICAgICAgaWYgKHJldHVyblR5cGUgPT09IFwic3RyaW5nXCIpIHJldHVybiBVVEY4VG9TdHJpbmcocmV0KTtcbiAgICAgICAgICAgIGlmIChyZXR1cm5UeXBlID09PSBcImJvb2xlYW5cIikgcmV0dXJuIEJvb2xlYW4ocmV0KTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdW5jID0gZ2V0Q0Z1bmMoaWRlbnQpO1xuICAgICAgICBjb25zdCBjQXJncyA9IFtdO1xuICAgICAgICBsZXQgc3RhY2sgPSAwO1xuICAgICAgICBpZiAoYXJncykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udmVydGVyID0gdG9DW2FyZ1R5cGVzW2ldXTtcbiAgICAgICAgICAgICAgICBpZiAoY29udmVydGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGFjayA9PT0gMCkgc3RhY2sgPSBzdGFja1NhdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgY0FyZ3NbaV0gPSBjb252ZXJ0ZXIoYXJnc1tpXSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjQXJnc1tpXSA9IGFyZ3NbaV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHJldCA9IGZ1bmMoLi4uY0FyZ3MpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRG9uZShyZXQpIHtcbiAgICAgICAgICAgIGlmIChzdGFjayAhPT0gMCkgc3RhY2tSZXN0b3JlKHN0YWNrKTtcbiAgICAgICAgICAgIHJldHVybiBjb252ZXJ0UmV0dXJuVmFsdWUocmV0KVxuICAgICAgICB9XG4gICAgICAgIHJldCA9IG9uRG9uZShyZXQpO1xuICAgICAgICByZXR1cm4gcmV0XG4gICAgfVxuICAgIGNvbnN0IFVURjhEZWNvZGVyID0gdHlwZW9mIFRleHREZWNvZGVyICE9PSBcInVuZGVmaW5lZFwiID8gbmV3IFRleHREZWNvZGVyKFwidXRmOFwiKSA6IHVuZGVmaW5lZDtcblxuICAgIGZ1bmN0aW9uIFVURjhBcnJheVRvU3RyaW5nKGhlYXAsIGlkeCwgbWF4Qnl0ZXNUb1JlYWQpIHtcbiAgICAgICAgY29uc3QgZW5kSWR4ID0gaWR4ICsgbWF4Qnl0ZXNUb1JlYWQ7XG4gICAgICAgIGxldCBlbmRQdHIgPSBpZHg7XG4gICAgICAgIHdoaWxlIChoZWFwW2VuZFB0cl0gJiYgIShlbmRQdHIgPj0gZW5kSWR4KSkgKytlbmRQdHI7XG4gICAgICAgIGlmIChlbmRQdHIgLSBpZHggPiAxNiAmJiBoZWFwLnN1YmFycmF5ICYmIFVURjhEZWNvZGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gVVRGOERlY29kZXIuZGVjb2RlKGhlYXAuc3ViYXJyYXkoaWR4LCBlbmRQdHIpKVxuICAgICAgICB9IFxuICAgICAgICAgICAgbGV0IHN0ciA9IFwiXCI7XG4gICAgICAgICAgICB3aGlsZSAoaWR4IDwgZW5kUHRyKSB7XG4gICAgICAgICAgICAgICAgbGV0IHUwID0gaGVhcFtpZHgrK107XG4gICAgICAgICAgICAgICAgaWYgKCEodTAgJiAxMjgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHUwKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgdTEgPSBoZWFwW2lkeCsrXSAmIDYzO1xuICAgICAgICAgICAgICAgIGlmICgodTAgJiAyMjQpID09PSAxOTIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKHUwICYgMzEpIDw8IDYgfCB1MSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHUyID0gaGVhcFtpZHgrK10gJiA2MztcbiAgICAgICAgICAgICAgICBpZiAoKHUwICYgMjQwKSA9PT0gMjI0KSB7XG4gICAgICAgICAgICAgICAgICAgIHUwID0gKHUwICYgMTUpIDw8IDEyIHwgdTEgPDwgNiB8IHUyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdTAgPSAodTAgJiA3KSA8PCAxOCB8IHUxIDw8IDEyIHwgdTIgPDwgNiB8IGhlYXBbaWR4KytdICYgNjNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHUwIDwgNjU1MzYpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodTApXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2ggPSB1MCAtIDY1NTM2O1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSg1NTI5NiB8IGNoID4+IDEwLCA1NjMyMCB8IGNoICYgMTAyMylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gc3RyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gVVRGOFRvU3RyaW5nKHB0ciwgbWF4Qnl0ZXNUb1JlYWQpIHtcbiAgICAgICAgcmV0dXJuIHB0ciA/IFVURjhBcnJheVRvU3RyaW5nKEhFQVBVOCwgcHRyLCBtYXhCeXRlc1RvUmVhZCkgOiBcIlwiXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RyaW5nVG9VVEY4QXJyYXkoc3RyLCBoZWFwLCBvdXRJZHgsIG1heEJ5dGVzVG9Xcml0ZSkge1xuICAgICAgICBpZiAoIShtYXhCeXRlc1RvV3JpdGUgPiAwKSkgcmV0dXJuIDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0SWR4ID0gb3V0SWR4O1xuICAgICAgICBjb25zdCBlbmRJZHggPSBvdXRJZHggKyBtYXhCeXRlc1RvV3JpdGUgLSAxO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IHUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIGlmICh1ID49IDU1Mjk2ICYmIHUgPD0gNTczNDMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1MSA9IHN0ci5jaGFyQ29kZUF0KCsraSk7XG4gICAgICAgICAgICAgICAgdSA9IDY1NTM2ICsgKCh1ICYgMTAyMykgPDwgMTApIHwgdTEgJiAxMDIzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodSA8PSAxMjcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSB1XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHUgPD0gMjA0Nykge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAxID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxOTIgfCB1ID4+IDY7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodSA8PSA2NTUzNSkge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAyID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAyMjQgfCB1ID4+IDEyO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiA2ICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dElkeCArIDMgPj0gZW5kSWR4KSBicmVhaztcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDI0MCB8IHUgPj4gMTg7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ID4+IDEyICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ID4+IDYgJiA2MztcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDEyOCB8IHUgJiA2M1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGhlYXBbb3V0SWR4XSA9IDA7XG4gICAgICAgIHJldHVybiBvdXRJZHggLSBzdGFydElkeFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmluZ1RvVVRGOChzdHIsIG91dFB0ciwgbWF4Qnl0ZXNUb1dyaXRlKSB7XG4gICAgICAgIHJldHVybiBzdHJpbmdUb1VURjhBcnJheShzdHIsIEhFQVBVOCwgb3V0UHRyLCBtYXhCeXRlc1RvV3JpdGUpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGVuZ3RoQnl0ZXNVVEY4KHN0cikge1xuICAgICAgICBsZXQgbGVuID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCB1ID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAodSA+PSA1NTI5NiAmJiB1IDw9IDU3MzQzKSB1ID0gNjU1MzYgKyAoKHUgJiAxMDIzKSA8PCAxMCkgfCBzdHIuY2hhckNvZGVBdCgrK2kpICYgMTAyMztcbiAgICAgICAgICAgIGlmICh1IDw9IDEyNykgKytsZW47XG4gICAgICAgICAgICBlbHNlIGlmICh1IDw9IDIwNDcpIGxlbiArPSAyO1xuICAgICAgICAgICAgZWxzZSBpZiAodSA8PSA2NTUzNSkgbGVuICs9IDM7XG4gICAgICAgICAgICBlbHNlIGxlbiArPSA0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxlblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbG9jYXRlVVRGOE9uU3RhY2soc3RyKSB7XG4gICAgICAgIGNvbnN0IHNpemUgPSBsZW5ndGhCeXRlc1VURjgoc3RyKSArIDE7XG4gICAgICAgIGNvbnN0IHJldCA9IHN0YWNrQWxsb2Moc2l6ZSk7XG4gICAgICAgIHN0cmluZ1RvVVRGOEFycmF5KHN0ciwgSEVBUDgsIHJldCwgc2l6ZSk7XG4gICAgICAgIHJldHVybiByZXRcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3cml0ZUFycmF5VG9NZW1vcnkoYXJyYXksIGJ1ZmZlcikge1xuICAgICAgICBIRUFQOC5zZXQoYXJyYXksIGJ1ZmZlcilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGlnblVwKHgsIG11bHRpcGxlKSB7XG4gICAgICAgIGlmICh4ICUgbXVsdGlwbGUgPiAwKSB7XG4gICAgICAgICAgICB4ICs9IG11bHRpcGxlIC0geCAlIG11bHRpcGxlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHhcbiAgICB9XG4gICAgbGV0IGJ1ZmZlcjsgbGV0IEhFQVA4OyBsZXQgSEVBUFU4OyBsZXQgSEVBUDE2OyBsZXQgSEVBUFUxNjsgbGV0IEhFQVAzMjsgbGV0IEhFQVBVMzI7IGxldCBIRUFQRjMyOyBsZXQgSEVBUEY2NDtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKGJ1Zikge1xuICAgICAgICBidWZmZXIgPSBidWY7XG4gICAgICAgIE1vZHVsZS5IRUFQOCA9IEhFQVA4ID0gbmV3IEludDhBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUDE2ID0gSEVBUDE2ID0gbmV3IEludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVAzMiA9IEhFQVAzMiA9IG5ldyBJbnQzMkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQVTggPSBIRUFQVTggPSBuZXcgVWludDhBcnJheShidWYpO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIE1vZHVsZS5IRUFQVTE2ID0gSEVBUFUxNiA9IG5ldyBVaW50MTZBcnJheShidWYpO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIE1vZHVsZS5IRUFQVTMyID0gSEVBUFUzMiA9IG5ldyBVaW50MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUEYzMiA9IEhFQVBGMzIgPSBuZXcgRmxvYXQzMkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQRjY0ID0gSEVBUEY2NCA9IG5ldyBGbG9hdDY0QXJyYXkoYnVmKVxuICAgIH1cbiAgICBsZXQgd2FzbVRhYmxlO1xuICAgIGNvbnN0IF9fQVRQUkVSVU5fXyA9IFtdO1xuICAgIGNvbnN0IF9fQVRJTklUX18gPSBbXTtcbiAgICBjb25zdCBfX0FUTUFJTl9fID0gW107XG4gICAgY29uc3QgX19BVFBPU1RSVU5fXyA9IFtdO1xuICAgIGNvbnN0IHJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIGtlZXBSdW50aW1lQWxpdmUoKSB7XG4gICAgICAgIHJldHVybiBub0V4aXRSdW50aW1lIHx8IHJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyID4gMFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByZVJ1bigpIHtcbiAgICAgICAgaWYgKE1vZHVsZS5wcmVSdW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnByZVJ1biA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucHJlUnVuID0gW01vZHVsZS5wcmVSdW5dO1xuICAgICAgICAgICAgd2hpbGUgKE1vZHVsZS5wcmVSdW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYWRkT25QcmVSdW4oTW9kdWxlLnByZVJ1bi5zaGlmdCgpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRQUkVSVU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0UnVudGltZSgpIHtcbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVElOSVRfXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVNYWluKCkge1xuICAgICAgICBjYWxsUnVudGltZUNhbGxiYWNrcyhfX0FUTUFJTl9fKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4aXRSdW50aW1lKCkge1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBvc3RSdW4oKSB7XG4gICAgICAgIGlmIChNb2R1bGUucG9zdFJ1bikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBNb2R1bGUucG9zdFJ1biA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucG9zdFJ1biA9IFtNb2R1bGUucG9zdFJ1bl07XG4gICAgICAgICAgICB3aGlsZSAoTW9kdWxlLnBvc3RSdW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYWRkT25Qb3N0UnVuKE1vZHVsZS5wb3N0UnVuLnNoaWZ0KCkpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVFBPU1RSVU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPblByZVJ1bihjYikge1xuICAgICAgICBfX0FUUFJFUlVOX18udW5zaGlmdChjYilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPbkluaXQoY2IpIHtcbiAgICAgICAgX19BVElOSVRfXy51bnNoaWZ0KGNiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE9uUG9zdFJ1bihjYikge1xuICAgICAgICBfX0FUUE9TVFJVTl9fLnVuc2hpZnQoY2IpXG4gICAgfVxuICAgIGxldCBydW5EZXBlbmRlbmNpZXMgPSAwO1xuICAgIGxldCBydW5EZXBlbmRlbmN5V2F0Y2hlciA9IG51bGw7XG4gICAgbGV0IGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IG51bGw7XG5cbiAgICBmdW5jdGlvbiBhZGRSdW5EZXBlbmRlbmN5KCkge1xuICAgICAgICBydW5EZXBlbmRlbmNpZXMrKztcbiAgICAgICAgaWYgKE1vZHVsZS5tb25pdG9yUnVuRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcyhydW5EZXBlbmRlbmNpZXMpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVSdW5EZXBlbmRlbmN5KCkge1xuICAgICAgICBydW5EZXBlbmRlbmNpZXMtLTtcbiAgICAgICAgaWYgKE1vZHVsZS5tb25pdG9yUnVuRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcyhydW5EZXBlbmRlbmNpZXMpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY2llcyA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY3lXYXRjaGVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChydW5EZXBlbmRlbmN5V2F0Y2hlcik7XG4gICAgICAgICAgICAgICAgcnVuRGVwZW5kZW5jeVdhdGNoZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGVwZW5kZW5jaWVzRnVsZmlsbGVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBkZXBlbmRlbmNpZXNGdWxmaWxsZWQ7XG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzRnVsZmlsbGVkID0gbnVsbDtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTW9kdWxlLnByZWxvYWRlZEltYWdlcyA9IHt9O1xuICAgIE1vZHVsZS5wcmVsb2FkZWRBdWRpb3MgPSB7fTtcblxuICAgIGZ1bmN0aW9uIGFib3J0KHdoYXQpIHtcbiAgICAgICAgaWYgKE1vZHVsZS5vbkFib3J0KSB7XG4gICAgICAgICAgICBNb2R1bGUub25BYm9ydCh3aGF0KVxuICAgICAgICB9XG4gICAgICAgIHdoYXQgPSBgQWJvcnRlZCgkeyAgd2hhdCAgfSlgO1xuICAgICAgICBlcnIod2hhdCk7XG4gICAgICAgIEFCT1JUID0gdHJ1ZTtcbiAgICAgICAgRVhJVFNUQVRVUyA9IDE7XG4gICAgICAgIHdoYXQgKz0gXCIuIEJ1aWxkIHdpdGggLXMgQVNTRVJUSU9OUz0xIGZvciBtb3JlIGluZm8uXCI7XG4gICAgICAgIGNvbnN0IGUgPSBuZXcgV2ViQXNzZW1ibHkuUnVudGltZUVycm9yKHdoYXQpO1xuICAgICAgICB0aHJvdyBlXG4gICAgfVxuICAgIGNvbnN0IGRhdGFVUklQcmVmaXggPSBcImRhdGE6YXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtO2Jhc2U2NCxcIjtcblxuICAgIGZ1bmN0aW9uIGlzRGF0YVVSSShmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZmlsZW5hbWUuc3RhcnRzV2l0aChkYXRhVVJJUHJlZml4KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRmlsZVVSSShmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZmlsZW5hbWUuc3RhcnRzV2l0aChcImZpbGU6Ly9cIilcbiAgICB9XG4gICAgbGV0IHdhc21CaW5hcnlGaWxlO1xuICAgIHdhc21CaW5hcnlGaWxlID0gbWFpbldhc207XG4gICAgaWYgKCFpc0RhdGFVUkkod2FzbUJpbmFyeUZpbGUpKSB7XG4gICAgICAgIHdhc21CaW5hcnlGaWxlID0gbG9jYXRlRmlsZSh3YXNtQmluYXJ5RmlsZSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCaW5hcnkoZmlsZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGZpbGUgPT09IHdhc21CaW5hcnlGaWxlICYmIHdhc21CaW5hcnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkod2FzbUJpbmFyeSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWFkQmluYXJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlYWRCaW5hcnkoZmlsZSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYm90aCBhc3luYyBhbmQgc3luYyBmZXRjaGluZyBvZiB0aGUgd2FzbSBmYWlsZWRcIik7XG4gICAgICAgICAgICBcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBhYm9ydChlcnIpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEJpbmFyeVByb21pc2UoKSB7XG4gICAgICAgIGlmICghd2FzbUJpbmFyeSAmJiAoRU5WSVJPTk1FTlRfSVNfV0VCIHx8IEVOVklST05NRU5UX0lTX1dPUktFUikpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmV0Y2ggPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNGaWxlVVJJKHdhc21CaW5hcnlGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCh3YXNtQmluYXJ5RmlsZSwge1xuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsczogXCJzYW1lLW9yaWdpblwiXG4gICAgICAgICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gbG9hZCB3YXNtIGJpbmFyeSBmaWxlIGF0ICckeyAgd2FzbUJpbmFyeUZpbGUgIH0nYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmFycmF5QnVmZmVyKClcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBnZXRCaW5hcnkod2FzbUJpbmFyeUZpbGUpKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBpZiAocmVhZEFzeW5jKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWFkQXN5bmMod2FzbUJpbmFyeUZpbGUsIChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUobmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UpKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgcmVqZWN0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IGdldEJpbmFyeSh3YXNtQmluYXJ5RmlsZSkpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlV2FzbSgpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgIFwiZW52XCI6IGFzbUxpYnJhcnlBcmcsXG4gICAgICAgICAgICBcIndhc2lfc25hcHNob3RfcHJldmlldzFcIjogYXNtTGlicmFyeUFyZ1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVJbnN0YW5jZShpbnN0YW5jZSkge1xuICAgICAgICAgICAgY29uc3Qge2V4cG9ydHN9ID0gaW5zdGFuY2U7XG4gICAgICAgICAgICBNb2R1bGUuYXNtID0gZXhwb3J0cztcbiAgICAgICAgICAgIHdhc21NZW1vcnkgPSBNb2R1bGUuYXNtLm1lbW9yeTtcbiAgICAgICAgICAgIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKHdhc21NZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgICAgIHdhc21UYWJsZSA9IE1vZHVsZS5hc20uX19pbmRpcmVjdF9mdW5jdGlvbl90YWJsZTtcbiAgICAgICAgICAgIGFkZE9uSW5pdChNb2R1bGUuYXNtLl9fd2FzbV9jYWxsX2N0b3JzKTtcbiAgICAgICAgICAgIHJlbW92ZVJ1bkRlcGVuZGVuY3koXCJ3YXNtLWluc3RhbnRpYXRlXCIpXG4gICAgICAgIH1cbiAgICAgICAgYWRkUnVuRGVwZW5kZW5jeShcIndhc20taW5zdGFudGlhdGVcIik7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQocmVzdWx0KSB7XG4gICAgICAgICAgICByZWNlaXZlSW5zdGFuY2UocmVzdWx0Lmluc3RhbmNlKVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlcikge1xuICAgICAgICAgICAgcmV0dXJuIGdldEJpbmFyeVByb21pc2UoKS50aGVuKChiaW5hcnkpID0+IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGJpbmFyeSwgaW5mbykpLnRoZW4oKGluc3RhbmNlKSA9PiBpbnN0YW5jZSkudGhlbihyZWNlaXZlciwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgICAgIGVycihgZmFpbGVkIHRvIGFzeW5jaHJvbm91c2x5IHByZXBhcmUgd2FzbTogJHsgIHJlYXNvbn1gKTtcbiAgICAgICAgICAgICAgICBhYm9ydChyZWFzb24pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zdGFudGlhdGVBc3luYygpIHtcbiAgICAgICAgICAgIGlmICghd2FzbUJpbmFyeSAmJiB0eXBlb2YgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcgPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNEYXRhVVJJKHdhc21CaW5hcnlGaWxlKSAmJiAhaXNGaWxlVVJJKHdhc21CaW5hcnlGaWxlKSAmJiB0eXBlb2YgZmV0Y2ggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCh3YXNtQmluYXJ5RmlsZSwge1xuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsczogXCJzYW1lLW9yaWdpblwiXG4gICAgICAgICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcocmVzcG9uc2UsIGluZm8pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnRoZW4ocmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQsIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycihgd2FzbSBzdHJlYW1pbmcgY29tcGlsZSBmYWlsZWQ6ICR7ICByZWFzb259YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoXCJmYWxsaW5nIGJhY2sgdG8gQXJyYXlCdWZmZXIgaW5zdGFudGlhdGlvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW50aWF0ZUFycmF5QnVmZmVyKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW50aWF0ZUFycmF5QnVmZmVyKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KVxuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1vZHVsZS5pbnN0YW50aWF0ZVdhc20pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhwb3J0cyA9IE1vZHVsZS5pbnN0YW50aWF0ZVdhc20oaW5mbywgcmVjZWl2ZUluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwb3J0c1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGVycihgTW9kdWxlLmluc3RhbnRpYXRlV2FzbSBjYWxsYmFjayBmYWlsZWQgd2l0aCBlcnJvcjogJHsgIGV9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaW5zdGFudGlhdGVBc3luYygpO1xuICAgICAgICByZXR1cm4ge31cbiAgICB9XG4gICAgbGV0IHRlbXBEb3VibGU7XG4gICAgbGV0IHRlbXBJNjQ7XG5cbiAgICBmdW5jdGlvbiBjYWxsUnVudGltZUNhbGxiYWNrcyhjYWxsYmFja3MpIHtcbiAgICAgICAgd2hpbGUgKGNhbGxiYWNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IGNhbGxiYWNrcy5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soTW9kdWxlKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge2Z1bmN9ID0gY2FsbGJhY2s7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suYXJnID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0V2FzbVRhYmxlRW50cnkoZnVuYykoKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFdhc21UYWJsZUVudHJ5KGZ1bmMpKGNhbGxiYWNrLmFyZylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZ1bmMoY2FsbGJhY2suYXJnID09PSB1bmRlZmluZWQgPyBudWxsIDogY2FsbGJhY2suYXJnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbVRhYmxlTWlycm9yID0gW107XG5cbiAgICBmdW5jdGlvbiBnZXRXYXNtVGFibGVFbnRyeShmdW5jUHRyKSB7XG4gICAgICAgIGxldCBmdW5jID0gd2FzbVRhYmxlTWlycm9yW2Z1bmNQdHJdO1xuICAgICAgICBpZiAoIWZ1bmMpIHtcbiAgICAgICAgICAgIGlmIChmdW5jUHRyID49IHdhc21UYWJsZU1pcnJvci5sZW5ndGgpIHdhc21UYWJsZU1pcnJvci5sZW5ndGggPSBmdW5jUHRyICsgMTtcbiAgICAgICAgICAgIHdhc21UYWJsZU1pcnJvcltmdW5jUHRyXSA9IGZ1bmMgPSB3YXNtVGFibGUuZ2V0KGZ1bmNQdHIpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZ1bmNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVFeGNlcHRpb24oZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEV4aXRTdGF0dXMgfHwgZSA9PT0gXCJ1bndpbmRcIikge1xuICAgICAgICAgICAgcmV0dXJuIEVYSVRTVEFUVVNcbiAgICAgICAgfVxuICAgICAgICBxdWl0XygxLCBlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fX2Fzc2VydF9mYWlsKGNvbmRpdGlvbiwgZmlsZW5hbWUsIGxpbmUsIGZ1bmMpIHtcbiAgICAgICAgYWJvcnQoYEFzc2VydGlvbiBmYWlsZWQ6ICR7ICBVVEY4VG9TdHJpbmcoY29uZGl0aW9uKSAgfSwgYXQ6ICR7ICBbZmlsZW5hbWUgPyBVVEY4VG9TdHJpbmcoZmlsZW5hbWUpIDogXCJ1bmtub3duIGZpbGVuYW1lXCIsIGxpbmUsIGZ1bmMgPyBVVEY4VG9TdHJpbmcoZnVuYykgOiBcInVua25vd24gZnVuY3Rpb25cIl19YClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uKHNpemUpIHtcbiAgICAgICAgcmV0dXJuIF9tYWxsb2Moc2l6ZSArIDE2KSArIDE2XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2F0ZXhpdCgpIHt9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfYXRleGl0KGEwLCBhMSkge1xuICAgICAgICByZXR1cm4gX2F0ZXhpdChhMCwgYTEpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gRXhjZXB0aW9uSW5mbyhleGNQdHIpIHtcbiAgICAgICAgdGhpcy5leGNQdHIgPSBleGNQdHI7XG4gICAgICAgIHRoaXMucHRyID0gZXhjUHRyIC0gMTY7XG4gICAgICAgIHRoaXMuc2V0X3R5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgKyA0ID4+IDJdID0gdHlwZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdldF90eXBlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDMyW3RoaXMucHRyICsgNCA+PiAyXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldF9kZXN0cnVjdG9yID0gZnVuY3Rpb24oZGVzdHJ1Y3Rvcikge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyICsgOCA+PiAyXSA9IGRlc3RydWN0b3JcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVAzMlt0aGlzLnB0ciArIDggPj4gMl1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfcmVmY291bnQgPSBmdW5jdGlvbihyZWZjb3VudCkge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyID4+IDJdID0gcmVmY291bnRcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfY2F1Z2h0ID0gZnVuY3Rpb24oY2F1Z2h0KSB7XG4gICAgICAgICAgICBjYXVnaHQgPSBjYXVnaHQgPyAxIDogMDtcbiAgICAgICAgICAgIEhFQVA4W3RoaXMucHRyICsgMTIgPj4gMF0gPSBjYXVnaHRcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfY2F1Z2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDhbdGhpcy5wdHIgKyAxMiA+PiAwXSAhPT0gMFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldF9yZXRocm93biA9IGZ1bmN0aW9uKHJldGhyb3duKSB7XG4gICAgICAgICAgICByZXRocm93biA9IHJldGhyb3duID8gMSA6IDA7XG4gICAgICAgICAgICBIRUFQOFt0aGlzLnB0ciArIDEzID4+IDBdID0gcmV0aHJvd25cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfcmV0aHJvd24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBIRUFQOFt0aGlzLnB0ciArIDEzID4+IDBdICE9PSAwXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKHR5cGUsIGRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0X3R5cGUodHlwZSk7XG4gICAgICAgICAgICB0aGlzLnNldF9kZXN0cnVjdG9yKGRlc3RydWN0b3IpO1xuICAgICAgICAgICAgdGhpcy5zZXRfcmVmY291bnQoMCk7XG4gICAgICAgICAgICB0aGlzLnNldF9jYXVnaHQoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5zZXRfcmV0aHJvd24oZmFsc2UpXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuYWRkX3JlZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBIRUFQMzJbdGhpcy5wdHIgPj4gMl07XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgPj4gMl0gPSB2YWx1ZSArIDFcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5yZWxlYXNlX3JlZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc3QgcHJldiA9IEhFQVAzMlt0aGlzLnB0ciA+PiAyXTtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciA+PiAyXSA9IHByZXYgLSAxO1xuICAgICAgICAgICAgcmV0dXJuIHByZXYgPT09IDFcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fX2N4YV90aHJvdyhwdHIsIHR5cGUsIGRlc3RydWN0b3IpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IG5ldyBFeGNlcHRpb25JbmZvKHB0cik7XG4gICAgICAgIGluZm8uaW5pdCh0eXBlLCBkZXN0cnVjdG9yKTtcbiAgICAgICAgdGhyb3cgcHRyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2Fib3J0KCkge1xuICAgICAgICBhYm9ydChcIlwiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbXNjcmlwdGVuX21lbWNweV9iaWcoZGVzdCwgc3JjLCBudW0pIHtcbiAgICAgICAgSEVBUFU4LmNvcHlXaXRoaW4oZGVzdCwgc3JjLCBzcmMgKyBudW0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlcihzaXplKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3YXNtTWVtb3J5Lmdyb3coc2l6ZSAtIGJ1ZmZlci5ieXRlTGVuZ3RoICsgNjU1MzUgPj4+IDE2KTtcbiAgICAgICAgICAgIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKHdhc21NZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgICAgIHJldHVybiAxXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1lbXB0eVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwKHJlcXVlc3RlZFNpemUpIHtcbiAgICAgICAgY29uc3Qgb2xkU2l6ZSA9IEhFQVBVOC5sZW5ndGg7XG4gICAgICAgIHJlcXVlc3RlZFNpemUgPj4+PSAwO1xuICAgICAgICBjb25zdCBtYXhIZWFwU2l6ZSA9IDIxNDc0ODM2NDg7XG4gICAgICAgIGlmIChyZXF1ZXN0ZWRTaXplID4gbWF4SGVhcFNpemUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGN1dERvd24gPSAxOyBjdXREb3duIDw9IDQ7IGN1dERvd24gKj0gMikge1xuICAgICAgICAgICAgbGV0IG92ZXJHcm93bkhlYXBTaXplID0gb2xkU2l6ZSAqICgxICsgLjIgLyBjdXREb3duKTtcbiAgICAgICAgICAgIG92ZXJHcm93bkhlYXBTaXplID0gTWF0aC5taW4ob3Zlckdyb3duSGVhcFNpemUsIHJlcXVlc3RlZFNpemUgKyAxMDA2NjMyOTYpO1xuICAgICAgICAgICAgY29uc3QgbmV3U2l6ZSA9IE1hdGgubWluKG1heEhlYXBTaXplLCBhbGlnblVwKE1hdGgubWF4KHJlcXVlc3RlZFNpemUsIG92ZXJHcm93bkhlYXBTaXplKSwgNjU1MzYpKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlcihuZXdTaXplKTtcbiAgICAgICAgICAgIGlmIChyZXBsYWNlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IFNZU0NBTExTID0ge1xuICAgICAgICBtYXBwaW5nczoge30sXG4gICAgICAgIGJ1ZmZlcnM6IFtudWxsLCBbXSxcbiAgICAgICAgICAgIFtdXG4gICAgICAgIF0sXG4gICAgICAgIHByaW50Q2hhcihzdHJlYW0sIGN1cnIpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IFNZU0NBTExTLmJ1ZmZlcnNbc3RyZWFtXTtcbiAgICAgICAgICAgIGlmIChjdXJyID09PSAwIHx8IGN1cnIgPT09IDEwKSB7XG4gICAgICAgICAgICAgICAgKHN0cmVhbSA9PT0gMSA/IG91dCA6IGVycikoVVRGOEFycmF5VG9TdHJpbmcoYnVmZmVyLCAwKSk7XG4gICAgICAgICAgICAgICAgYnVmZmVyLmxlbmd0aCA9IDBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyLnB1c2goY3VycilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgdmFyYXJnczogdW5kZWZpbmVkLFxuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICBTWVNDQUxMUy52YXJhcmdzICs9IDQ7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBIRUFQMzJbU1lTQ0FMTFMudmFyYXJncyAtIDQgPj4gMl07XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0cihwdHIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IFVURjhUb1N0cmluZyhwdHIpO1xuICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICB9LFxuICAgICAgICBnZXQ2NChsb3cpIHtcbiAgICAgICAgICAgIHJldHVybiBsb3dcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBfZmRfd3JpdGUoZmQsIGlvdiwgaW92Y250LCBwbnVtKSB7XG4gICAgICAgIGxldCBudW0gPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlvdmNudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwdHIgPSBIRUFQMzJbaW92ID4+IDJdO1xuICAgICAgICAgICAgY29uc3QgbGVuID0gSEVBUDMyW2lvdiArIDQgPj4gMl07XG4gICAgICAgICAgICBpb3YgKz0gODtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBTWVNDQUxMUy5wcmludENoYXIoZmQsIEhFQVBVOFtwdHIgKyBqXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG51bSArPSBsZW5cbiAgICAgICAgfVxuICAgICAgICBIRUFQMzJbcG51bSA+PiAyXSA9IG51bTtcbiAgICAgICAgcmV0dXJuIDBcbiAgICB9XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgZnVuY3Rpb24gX3NldFRlbXBSZXQwKHZhbCkge1xuICAgICAgICAvLyBzZXRUZW1wUmV0MCh2YWwpXG4gICAgfVxuICAgIGNvbnN0IGFzbUxpYnJhcnlBcmcgPSB7XG4gICAgICAgIFwiX19hc3NlcnRfZmFpbFwiOiBfX19hc3NlcnRfZmFpbCxcbiAgICAgICAgXCJfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb25cIjogX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbixcbiAgICAgICAgXCJfX2N4YV9hdGV4aXRcIjogX19fY3hhX2F0ZXhpdCxcbiAgICAgICAgXCJfX2N4YV90aHJvd1wiOiBfX19jeGFfdGhyb3csXG4gICAgICAgIFwiYWJvcnRcIjogX2Fib3J0LFxuICAgICAgICBcImVtc2NyaXB0ZW5fbWVtY3B5X2JpZ1wiOiBfZW1zY3JpcHRlbl9tZW1jcHlfYmlnLFxuICAgICAgICBcImVtc2NyaXB0ZW5fcmVzaXplX2hlYXBcIjogX2Vtc2NyaXB0ZW5fcmVzaXplX2hlYXAsXG4gICAgICAgIFwiZmRfd3JpdGVcIjogX2ZkX3dyaXRlLFxuICAgICAgICBcInNldFRlbXBSZXQwXCI6IF9zZXRUZW1wUmV0MFxuICAgIH07XG4gICAgY3JlYXRlV2FzbSgpO1xuICAgIGxldCBfX193YXNtX2NhbGxfY3RvcnMgPSBNb2R1bGUuX19fd2FzbV9jYWxsX2N0b3JzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX19fd2FzbV9jYWxsX2N0b3JzID0gTW9kdWxlLl9fX3dhc21fY2FsbF9jdG9ycyA9IE1vZHVsZS5hc20uX193YXNtX2NhbGxfY3RvcnMpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfbWFpbiA9IE1vZHVsZS5fbWFpbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9tYWluID0gTW9kdWxlLl9tYWluID0gTW9kdWxlLmFzbS5tYWluKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuX2NyZWF0ZVRleHR1cmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfY3JlYXRlVGV4dHVyZSA9IE1vZHVsZS5fY3JlYXRlVGV4dHVyZSA9IE1vZHVsZS5hc20uY3JlYXRlVGV4dHVyZSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9jcmVhdGVCb3VuZGluZyA9IE1vZHVsZS5fY3JlYXRlQm91bmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfY3JlYXRlQm91bmRpbmcgPSBNb2R1bGUuX2NyZWF0ZUJvdW5kaW5nID0gTW9kdWxlLmFzbS5jcmVhdGVCb3VuZGluZykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9zZXRDYW1lcmEgPSBNb2R1bGUuX3NldENhbWVyYSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9zZXRDYW1lcmEgPSBNb2R1bGUuX3NldENhbWVyYSA9IE1vZHVsZS5hc20uc2V0Q2FtZXJhKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX3JlYWRTdHJlYW0gPSBNb2R1bGUuX3JlYWRTdHJlYW0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfcmVhZFN0cmVhbSA9IE1vZHVsZS5fcmVhZFN0cmVhbSA9IE1vZHVsZS5hc20ucmVhZFN0cmVhbSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9wYXRoVHJhY2VyID0gTW9kdWxlLl9wYXRoVHJhY2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX3BhdGhUcmFjZXIgPSBNb2R1bGUuX3BhdGhUcmFjZXIgPSBNb2R1bGUuYXNtLnBhdGhUcmFjZXIpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5fX19lcnJub19sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9fX2Vycm5vX2xvY2F0aW9uID0gTW9kdWxlLl9fX2Vycm5vX2xvY2F0aW9uID0gTW9kdWxlLmFzbS5fX2Vycm5vX2xvY2F0aW9uKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgc3RhY2tTYXZlID0gTW9kdWxlLnN0YWNrU2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKHN0YWNrU2F2ZSA9IE1vZHVsZS5zdGFja1NhdmUgPSBNb2R1bGUuYXNtLnN0YWNrU2F2ZSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IHN0YWNrUmVzdG9yZSA9IE1vZHVsZS5zdGFja1Jlc3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja1Jlc3RvcmUgPSBNb2R1bGUuc3RhY2tSZXN0b3JlID0gTW9kdWxlLmFzbS5zdGFja1Jlc3RvcmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBzdGFja0FsbG9jID0gTW9kdWxlLnN0YWNrQWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja0FsbG9jID0gTW9kdWxlLnN0YWNrQWxsb2MgPSBNb2R1bGUuYXNtLnN0YWNrQWxsb2MpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfbWFsbG9jID0gTW9kdWxlLl9tYWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfbWFsbG9jID0gTW9kdWxlLl9tYWxsb2MgPSBNb2R1bGUuYXNtLm1hbGxvYykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9mcmVlID0gTW9kdWxlLl9mcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2ZyZWUgPSBNb2R1bGUuX2ZyZWUgPSBNb2R1bGUuYXNtLmZyZWUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBkeW5DYWxsX2ppamkgPSBNb2R1bGUuZHluQ2FsbF9qaWppID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoZHluQ2FsbF9qaWppID0gTW9kdWxlLmR5bkNhbGxfamlqaSA9IE1vZHVsZS5hc20uZHluQ2FsbF9qaWppKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBNb2R1bGUuY2NhbGwgPSBjY2FsbDtcbiAgICBNb2R1bGUuc2V0VmFsdWUgPSBzZXRWYWx1ZTtcbiAgICBNb2R1bGUuZ2V0VmFsdWUgPSBnZXRWYWx1ZTtcbiAgICBsZXQgY2FsbGVkUnVuO1xuXG4gICAgZnVuY3Rpb24gRXhpdFN0YXR1cyhzdGF0dXMpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gXCJFeGl0U3RhdHVzXCI7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IGBQcm9ncmFtIHRlcm1pbmF0ZWQgd2l0aCBleGl0KCR7ICBzdGF0dXMgIH0pYDtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXNcbiAgICB9XG4gICAgbGV0IGNhbGxlZE1haW4gPSBmYWxzZTtcbiAgICBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBmdW5jdGlvbiBydW5DYWxsZXIoKSB7XG4gICAgICAgIGlmICghY2FsbGVkUnVuKSBydW4oKTtcbiAgICAgICAgaWYgKCFjYWxsZWRSdW4pIGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IHJ1bkNhbGxlclxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBjYWxsTWFpbihhcmdzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5RnVuY3Rpb24gPSBNb2R1bGUuX21haW47XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IFtdO1xuICAgICAgICBjb25zdCBhcmdjID0gYXJncy5sZW5ndGggKyAxO1xuICAgICAgICBjb25zdCBhcmd2ID0gc3RhY2tBbGxvYygoYXJnYyArIDEpICogNCk7XG4gICAgICAgIEhFQVAzMlthcmd2ID4+IDJdID0gYWxsb2NhdGVVVEY4T25TdGFjayh0aGlzUHJvZ3JhbSk7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgYXJnYzsgaSsrKSB7XG4gICAgICAgICAgICBIRUFQMzJbKGFyZ3YgPj4gMikgKyBpXSA9IGFsbG9jYXRlVVRGOE9uU3RhY2soYXJnc1tpIC0gMV0pXG4gICAgICAgIH1cbiAgICAgICAgSEVBUDMyWyhhcmd2ID4+IDIpICsgYXJnY10gPSAwO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmV0ID0gZW50cnlGdW5jdGlvbihhcmdjLCBhcmd2KTtcbiAgICAgICAgICAgIGV4aXQocmV0LCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZUV4Y2VwdGlvbihlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICAgICAgY2FsbGVkTWFpbiA9IHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJ1bihhcmdzKSB7XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IGFyZ3VtZW50c187XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBwcmVSdW4oKTtcbiAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY2llcyA+IDApIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZG9SdW4oKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGVkUnVuKSByZXR1cm47XG4gICAgICAgICAgICBjYWxsZWRSdW4gPSB0cnVlO1xuICAgICAgICAgICAgTW9kdWxlLmNhbGxlZFJ1biA9IHRydWU7XG4gICAgICAgICAgICBpZiAoQUJPUlQpIHJldHVybjtcbiAgICAgICAgICAgIGluaXRSdW50aW1lKCk7XG4gICAgICAgICAgICBwcmVNYWluKCk7XG4gICAgICAgICAgICBpZiAoTW9kdWxlLm9uUnVudGltZUluaXRpYWxpemVkKSBNb2R1bGUub25SdW50aW1lSW5pdGlhbGl6ZWQoKTtcbiAgICAgICAgICAgIGlmIChzaG91bGRSdW5Ob3cpIGNhbGxNYWluKGFyZ3MpO1xuICAgICAgICAgICAgcG9zdFJ1bigpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1vZHVsZS5zZXRTdGF0dXMpIHtcbiAgICAgICAgICAgIE1vZHVsZS5zZXRTdGF0dXMoXCJSdW5uaW5nLi4uXCIpO1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIE1vZHVsZS5zZXRTdGF0dXMoXCJcIilcbiAgICAgICAgICAgICAgICB9LCAxKTtcbiAgICAgICAgICAgICAgICBkb1J1bigpXG4gICAgICAgICAgICB9LCAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9SdW4oKVxuICAgICAgICB9XG4gICAgfVxuICAgIE1vZHVsZS5ydW4gPSBydW47XG5cbiAgICBmdW5jdGlvbiBleGl0KHN0YXR1cykge1xuICAgICAgICBFWElUU1RBVFVTID0gc3RhdHVzO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHlcbiAgICAgICAgaWYgKGtlZXBSdW50aW1lQWxpdmUoKSkge30gZWxzZSB7XG4gICAgICAgICAgICBleGl0UnVudGltZSgpXG4gICAgICAgIH1cbiAgICAgICAgcHJvY0V4aXQoc3RhdHVzKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2NFeGl0KGNvZGUpIHtcbiAgICAgICAgRVhJVFNUQVRVUyA9IGNvZGU7XG4gICAgICAgIGlmICgha2VlcFJ1bnRpbWVBbGl2ZSgpKSB7XG4gICAgICAgICAgICBpZiAoTW9kdWxlLm9uRXhpdCkgTW9kdWxlLm9uRXhpdChjb2RlKTtcbiAgICAgICAgICAgIEFCT1JUID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIHF1aXRfKGNvZGUsIG5ldyBFeGl0U3RhdHVzKGNvZGUpKVxuICAgIH1cbiAgICBpZiAoTW9kdWxlLnByZUluaXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBNb2R1bGUucHJlSW5pdCA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucHJlSW5pdCA9IFtNb2R1bGUucHJlSW5pdF07XG4gICAgICAgIHdoaWxlIChNb2R1bGUucHJlSW5pdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBNb2R1bGUucHJlSW5pdC5wb3AoKSgpXG4gICAgICAgIH1cbiAgICB9XG4gICAgbGV0IHNob3VsZFJ1bk5vdyA9IHRydWU7XG4gICAgaWYgKE1vZHVsZS5ub0luaXRpYWxSdW4pIHNob3VsZFJ1bk5vdyA9IGZhbHNlO1xuICAgIHJ1bigpO1xuXG4gICAgcmV0dXJuIE1vZHVsZTtcbn1cbiIsbnVsbCxudWxsXSwibmFtZXMiOlsiUmVuZGVyZXIiLCJ3YXNtTWFuYWdlciIsInBpeGVsRGF0YSIsImNhbWVyYUJ1ZiIsInJlbmRlckN0eCIsImNvbnN0cnVjdG9yIiwiY3JlYXRlQm91bmQiLCJtb2RlbCIsImNyZWF0ZUJ1ZmZlcnMiLCJ0ZXh0dXJlIiwibWF0ZXJpYWwiLCJpc1ZhbGlkIiwiaWQiLCJidWZmZXIiLCJjYWxsRnVuY3Rpb24iLCJjYWxsQ3JlYXRlQm91bmRpbmciLCJwb3NpdGlvbkJ1ZmZlciIsImxlbmd0aCIsImluZGljaWVzQnVmZmVyIiwibm9ybWFsQnVmZmVyIiwidGV4Y29vcmRCdWZmZXIiLCJtYXRyaXhCdWZmZXIiLCJyZW5kZXIiLCJjYW52YXMiLCJjYW1lcmEiLCJ3aWR0aCIsImhlaWdodCIsImN0eCIsImdldENvbnRleHQiLCJjb25zb2xlIiwiZXJyb3IiLCJpbWFnZWRhdGEiLCJjcmVhdGVJbWFnZURhdGEiLCJwaXhlbHMiLCJkYXRhIiwicmVsZWFzZSIsImNyZWF0ZUJ1ZmZlciIsInNldEFycmF5IiwiZHVtcEFzQXJyYXkiLCJjYWxsU2V0Q2FtZXJhIiwicmVzdWx0IiwiY2FsbFBhdGhUcmFjZXIiLCJsb2ciLCJyZXN1bHQyIiwiY2FsbFJlYWRTdHJlYW0iLCJyZW5kZXJmdW5jIiwidGltZXIiLCJzZXRJbnRlcnZhbCIsImkiLCJnZXQiLCJwdXRJbWFnZURhdGEiLCJjbGVhckludGVydmFsIiwicHJlcGFyZVBhcnRpYWxSZW5kZXJpbmciLCJpbWFnZURhdGEiLCJwYXJ0aWFsUmVuZGVyaW5nIiwidXBkYXRlIiwiVmVjdG9yMyIsIngiLCJ5IiwieiIsIl94IiwiX3kiLCJfeiIsInNldCIsImxlbmd0aDIiLCJNYXRoIiwic3FydCIsImRpc3RhbmNlIiwiYSIsImFkZCIsInN1YnRyYWN0IiwibXVsdGlwbHkiLCJkaXZpZGUiLCJhc3NlcnQiLCJub3JtYWxpemUiLCJkb3QiLCJjcm9zcyIsImVxdWFsIiwiY29weSIsImdldEFycmF5IiwiRmxvYXQzMkFycmF5IiwiVmVjdG9yNCIsInciLCJfdyIsIk1hdHJpeDQiLCJtYXRyaXgiLCJudW1BcnJheSIsImV5ZSIsImVtcHR5IiwiZmlsbCIsInNjYWxlTWF0cml4Iiwic2NhbGUiLCJ0cmFuc2xhdGVNYXRyaXgiLCJtb3ZlIiwibSIsIm4iLCJzdWIiLCJtdWwiLCJ0cmFuc3Bvc2UiLCJpbnZlcnNlIiwibWF0IiwiYiIsImMiLCJkIiwiZSIsImYiLCJnIiwiaCIsImoiLCJrIiwibCIsIm8iLCJwIiwicSIsInIiLCJzIiwidCIsInUiLCJ2IiwiQSIsIkIiLCJpdmQiLCJFcnJvciIsImRlc3QiLCJnZXRTY2FsZVJvdGF0aW9uTWF0cml4IiwiZ2V0VHJhbnNsYXRlVmVjdG9yIiwiUXVhdGVybmlvbiIsImFuZ2xlQXhpcyIsImFuZ2xlIiwiX2F4aXMiLCJheGlzIiwic2luIiwiY29zIiwiZXVsYXJBbmdsZSIsInJvdCIsInhjIiwieHMiLCJ5YyIsInlzIiwiemMiLCJ6cyIsImZyb21NYXRyaXgiLCJtMDAiLCJtMTAiLCJtMjAiLCJtMDEiLCJtMTEiLCJtMjEiLCJtMDIiLCJtMTIiLCJtMjIiLCJlbGVtZW50IiwibWF4SW5kZXgiLCJsZW4iLCJUcmFuc2Zvcm0iLCJyb3RhdGlvbiIsInBvc2l0aW9uIiwidHJhbnNsYXRlIiwiTW9kZWwiLCJfcG9zaXRpb24iLCJfcG9zaXRpb25CdWZmZXIiLCJfbm9ybWFsIiwiX25vcm1hbEJ1ZmZlciIsIl90ZXhjb29yZCIsIl90ZXhjb29yZEJ1ZmZlciIsIl9pbmRpY2llcyIsIkludDMyQXJyYXkiLCJfaW5kaWNpZXNCdWZmZXIiLCJfYm91bmRpbmdCb3giLCJtaW4iLCJtYXgiLCJfbWF0cml4IiwiX21hdHJpeEJ1ZmZlciIsIl90cmFuc2Zvcm0iLCJfbWF0ZXJpYWwiLCJjcmVhdGVCb3VuZGluZ0JveCIsInBvcyIsInRyYW5zZm9ybSIsIm5vcm1hbCIsInRleGNvb3JkIiwiaW5kaWNpZXMiLCJtYW5hZ2VyIiwiY29uY2F0IiwiYm91bmRpbmdCb3giLCJHTFRGTG9hZGVyIiwicmF3SnNvbiIsImxvYWQiLCJ1cmwiLCJyZXNwb25zZSIsImZldGNoIiwiaGVhZGVycyIsImpzb24iLCJhbmFsaXplIiwibm9kZXMiLCJtZXNoZXMiLCJhY2Nlc3NvcnMiLCJidWZmZXJWaWV3cyIsImJ1ZmZlcnMiLCJBcnJheSIsImlzQXJyYXkiLCJub2RlIiwicHJpbWl0aXZlcyIsInByaW1pdGl2ZSIsImJ1ZlBvcyIsImF0dHJpYnV0ZXMiLCJQT1NJVElPTiIsImJ1Zk5vcm0iLCJOT1JNQUwiLCJidWZUZXgiLCJURVhDT09SRF8wIiwiYnVmSW5kIiwiaW5kaWNlcyIsInVyaSIsInRyYW5zbGF0aW9uIiwiYmxvYiIsImFycmF5QnVmZmVyIiwiYnl0ZU9mZnNldCIsImJ5dGVMZW5ndGgiLCJmcm9tIiwiSW50MTZBcnJheSIsIk1BVEVSSUFMX1VOSUZPUk1fTEVOR1RIIiwiTWF0ZXJpYWwiLCJjb2xvciIsIl9tYXRlcmlhbEJ1ZmZlciIsIkNhbWVyYSIsIl9wb3MiLCJfZm9yd2FyZCIsIl90b3AiLCJfcmlnaHQiLCJfZGlzdCIsInZpZXdBbmdsZSIsInRhbiIsImZvcndhcmQiLCJyaWdodCIsInRvcCIsImRpc3QiLCJhdGFuIiwibG9va0F0IiwidG8iLCJJTUFHRV9TSVpFIiwiVGV4dHVyZSIsImltYWdlIiwiaW1hZ2VBcnJheSIsInZhbGlkIiwiX2J1ZmZlciIsInNldFRleHR1cmUiLCJjbnYiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJkcmF3SW1hZ2UiLCJnZXRJbWFnZURhdGEiLCJ3YXNtIiwiV2FzbUJ1ZmZlciIsIl9tb2R1bGUiLCJfYmFzZSIsIl90eXBlIiwiX3N0cmlkZSIsIl9sZW5ndGgiLCJ0eXBlIiwibW9kdWxlIiwic2l6ZSIsIl9tYWxsb2MiLCJpbmRleCIsImdldFZhbHVlIiwidmFsdWUiLCJzZXRWYWx1ZSIsImFycmF5IiwiZm9yRWFjaCIsImdldFBvaW50ZXIiLCJfZnJlZSIsIldhc21Nb2R1bGVHZW5lcmF0b3IiLCJ3b3JrZXJHbG9iYWxTY29wZSIsIk1vZHVsZSIsImFyZ3VtZW50c18iLCJ0aGlzUHJvZ3JhbSIsInF1aXRfIiwic3RhdHVzIiwidG9UaHJvdyIsIkVOVklST05NRU5UX0lTX1dFQiIsIndpbmRvdyIsIkVOVklST05NRU5UX0lTX1dPUktFUiIsImltcG9ydFNjcmlwdHMiLCJFTlZJUk9OTUVOVF9JU19OT0RFIiwicHJvY2VzcyIsInZlcnNpb25zIiwic2NyaXB0RGlyZWN0b3J5IiwibG9jYXRlRmlsZSIsInBhdGgiLCJyZWFkXyIsInJlYWRBc3luYyIsInJlYWRCaW5hcnkiLCJsb2dFeGNlcHRpb25PbkV4aXQiLCJFeGl0U3RhdHVzIiwidG9Mb2ciLCJlcnIiLCJub2RlRlMiLCJub2RlUGF0aCIsInJlcXVpcmUiLCJkaXJuYW1lIiwiX19kaXJuYW1lIiwic2hlbGxfcmVhZCIsImZpbGVuYW1lIiwiYmluYXJ5IiwicmVhZEZpbGVTeW5jIiwicmV0IiwiVWludDhBcnJheSIsIm9ubG9hZCIsIm9uZXJyb3IiLCJyZWFkRmlsZSIsImFyZ3YiLCJyZXBsYWNlIiwic2xpY2UiLCJleHBvcnRzIiwib24iLCJleCIsInJlYXNvbiIsImtlZXBSdW50aW1lQWxpdmUiLCJleGl0Q29kZSIsImV4aXQiLCJpbnNwZWN0Iiwic2VsZiIsImxvY2F0aW9uIiwiaHJlZiIsImN1cnJlbnRTY3JpcHQiLCJzcmMiLCJpbmRleE9mIiwic3Vic3RyIiwibGFzdEluZGV4T2YiLCJ4aHIiLCJYTUxIdHRwUmVxdWVzdCIsIm9wZW4iLCJzZW5kIiwicmVzcG9uc2VUZXh0IiwicmVzcG9uc2VUeXBlIiwib3V0IiwicHJpbnQiLCJiaW5kIiwicHJpbnRFcnIiLCJ3YXJuIiwiYXJndW1lbnRzIiwicXVpdCIsImJhc2U2NFRvQXJyYXlCdWZmZXIiLCJiYXNlNjQiLCJiaW5hcnlfc3RyaW5nIiwiQnVmZmVyIiwidG9TdHJpbmciLCJhdG9iIiwiYnl0ZXMiLCJjaGFyQ29kZUF0Iiwid2FzbUJpbmFyeSIsIm1haW5XYXNtIiwibm9FeGl0UnVudGltZSIsIldlYkFzc2VtYmx5IiwiYWJvcnQiLCJwdHIiLCJjaGFyQXQiLCJIRUFQOCIsIkhFQVAxNiIsIkhFQVAzMiIsInRlbXBJNjQiLCJ0ZW1wRG91YmxlIiwiYWJzIiwiZmxvb3IiLCJjZWlsIiwiSEVBUEYzMiIsIkhFQVBGNjQiLCJOdW1iZXIiLCJ3YXNtTWVtb3J5IiwiQUJPUlQiLCJFWElUU1RBVFVTIiwiY29uZGl0aW9uIiwidGV4dCIsImdldENGdW5jIiwiaWRlbnQiLCJmdW5jIiwiY2NhbGwiLCJyZXR1cm5UeXBlIiwiYXJnVHlwZXMiLCJhcmdzIiwidG9DIiwic3RyIiwidW5kZWZpbmVkIiwic3RhY2tBbGxvYyIsInN0cmluZ1RvVVRGOCIsImFyciIsIndyaXRlQXJyYXlUb01lbW9yeSIsImNvbnZlcnRSZXR1cm5WYWx1ZSIsIlVURjhUb1N0cmluZyIsIkJvb2xlYW4iLCJjQXJncyIsInN0YWNrIiwiY29udmVydGVyIiwic3RhY2tTYXZlIiwib25Eb25lIiwic3RhY2tSZXN0b3JlIiwiVVRGOERlY29kZXIiLCJUZXh0RGVjb2RlciIsIlVURjhBcnJheVRvU3RyaW5nIiwiaGVhcCIsImlkeCIsIm1heEJ5dGVzVG9SZWFkIiwiZW5kSWR4IiwiZW5kUHRyIiwic3ViYXJyYXkiLCJkZWNvZGUiLCJ1MCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsInUxIiwidTIiLCJjaCIsIkhFQVBVOCIsInN0cmluZ1RvVVRGOEFycmF5Iiwib3V0SWR4IiwibWF4Qnl0ZXNUb1dyaXRlIiwic3RhcnRJZHgiLCJvdXRQdHIiLCJsZW5ndGhCeXRlc1VURjgiLCJhbGxvY2F0ZVVURjhPblN0YWNrIiwiYWxpZ25VcCIsIm11bHRpcGxlIiwidXBkYXRlR2xvYmFsQnVmZmVyQW5kVmlld3MiLCJidWYiLCJJbnQ4QXJyYXkiLCJIRUFQVTE2IiwiVWludDE2QXJyYXkiLCJIRUFQVTMyIiwiVWludDMyQXJyYXkiLCJGbG9hdDY0QXJyYXkiLCJ3YXNtVGFibGUiLCJfX0FUUFJFUlVOX18iLCJfX0FUSU5JVF9fIiwiX19BVE1BSU5fXyIsIl9fQVRQT1NUUlVOX18iLCJydW50aW1lS2VlcGFsaXZlQ291bnRlciIsInByZVJ1biIsImFkZE9uUHJlUnVuIiwic2hpZnQiLCJjYWxsUnVudGltZUNhbGxiYWNrcyIsImluaXRSdW50aW1lIiwicHJlTWFpbiIsInBvc3RSdW4iLCJhZGRPblBvc3RSdW4iLCJjYiIsInVuc2hpZnQiLCJhZGRPbkluaXQiLCJydW5EZXBlbmRlbmNpZXMiLCJkZXBlbmRlbmNpZXNGdWxmaWxsZWQiLCJhZGRSdW5EZXBlbmRlbmN5IiwibW9uaXRvclJ1bkRlcGVuZGVuY2llcyIsInJlbW92ZVJ1bkRlcGVuZGVuY3kiLCJjYWxsYmFjayIsInByZWxvYWRlZEltYWdlcyIsInByZWxvYWRlZEF1ZGlvcyIsIndoYXQiLCJvbkFib3J0IiwiUnVudGltZUVycm9yIiwiZGF0YVVSSVByZWZpeCIsImlzRGF0YVVSSSIsInN0YXJ0c1dpdGgiLCJpc0ZpbGVVUkkiLCJ3YXNtQmluYXJ5RmlsZSIsImdldEJpbmFyeSIsImZpbGUiLCJnZXRCaW5hcnlQcm9taXNlIiwiY3JlZGVudGlhbHMiLCJ0aGVuIiwib2siLCJjYXRjaCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY3JlYXRlV2FzbSIsImluZm8iLCJhc21MaWJyYXJ5QXJnIiwicmVjZWl2ZUluc3RhbmNlIiwiaW5zdGFuY2UiLCJhc20iLCJtZW1vcnkiLCJfX2luZGlyZWN0X2Z1bmN0aW9uX3RhYmxlIiwiX193YXNtX2NhbGxfY3RvcnMiLCJyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdCIsImluc3RhbnRpYXRlQXJyYXlCdWZmZXIiLCJyZWNlaXZlciIsImluc3RhbnRpYXRlIiwiaW5zdGFudGlhdGVBc3luYyIsImluc3RhbnRpYXRlU3RyZWFtaW5nIiwiaW5zdGFudGlhdGVXYXNtIiwiY2FsbGJhY2tzIiwiYXJnIiwiZ2V0V2FzbVRhYmxlRW50cnkiLCJ3YXNtVGFibGVNaXJyb3IiLCJmdW5jUHRyIiwiaGFuZGxlRXhjZXB0aW9uIiwiX19fYXNzZXJ0X2ZhaWwiLCJsaW5lIiwiX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbiIsIl9hdGV4aXQiLCJfX19jeGFfYXRleGl0IiwiYTAiLCJhMSIsIkV4Y2VwdGlvbkluZm8iLCJleGNQdHIiLCJzZXRfdHlwZSIsImdldF90eXBlIiwic2V0X2Rlc3RydWN0b3IiLCJkZXN0cnVjdG9yIiwiZ2V0X2Rlc3RydWN0b3IiLCJzZXRfcmVmY291bnQiLCJyZWZjb3VudCIsInNldF9jYXVnaHQiLCJjYXVnaHQiLCJnZXRfY2F1Z2h0Iiwic2V0X3JldGhyb3duIiwicmV0aHJvd24iLCJnZXRfcmV0aHJvd24iLCJpbml0IiwiYWRkX3JlZiIsInJlbGVhc2VfcmVmIiwicHJldiIsIl9fX2N4YV90aHJvdyIsIl9hYm9ydCIsIl9lbXNjcmlwdGVuX21lbWNweV9iaWciLCJudW0iLCJjb3B5V2l0aGluIiwiZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlciIsImdyb3ciLCJfZW1zY3JpcHRlbl9yZXNpemVfaGVhcCIsInJlcXVlc3RlZFNpemUiLCJvbGRTaXplIiwibWF4SGVhcFNpemUiLCJjdXREb3duIiwib3Zlckdyb3duSGVhcFNpemUiLCJuZXdTaXplIiwicmVwbGFjZW1lbnQiLCJTWVNDQUxMUyIsIm1hcHBpbmdzIiwicHJpbnRDaGFyIiwic3RyZWFtIiwiY3VyciIsInB1c2giLCJ2YXJhcmdzIiwiZ2V0U3RyIiwiZ2V0NjQiLCJsb3ciLCJfZmRfd3JpdGUiLCJmZCIsImlvdiIsImlvdmNudCIsInBudW0iLCJfc2V0VGVtcFJldDAiLCJ2YWwiLCJfX193YXNtX2NhbGxfY3RvcnMiLCJhcHBseSIsIl9tYWluIiwibWFpbiIsIl9jcmVhdGVUZXh0dXJlIiwiY3JlYXRlVGV4dHVyZSIsIl9jcmVhdGVCb3VuZGluZyIsImNyZWF0ZUJvdW5kaW5nIiwiX3NldENhbWVyYSIsInNldENhbWVyYSIsIl9yZWFkU3RyZWFtIiwicmVhZFN0cmVhbSIsIl9wYXRoVHJhY2VyIiwicGF0aFRyYWNlciIsIl9fX2Vycm5vX2xvY2F0aW9uIiwiX19lcnJub19sb2NhdGlvbiIsIm1hbGxvYyIsImZyZWUiLCJkeW5DYWxsX2ppamkiLCJjYWxsZWRSdW4iLCJuYW1lIiwibWVzc2FnZSIsInJ1bkNhbGxlciIsInJ1biIsImNhbGxNYWluIiwiZW50cnlGdW5jdGlvbiIsImFyZ2MiLCJkb1J1biIsIm9uUnVudGltZUluaXRpYWxpemVkIiwic2hvdWxkUnVuTm93Iiwic2V0U3RhdHVzIiwic2V0VGltZW91dCIsInByb2NFeGl0IiwiY29kZSIsIm9uRXhpdCIsInByZUluaXQiLCJwb3AiLCJub0luaXRpYWxSdW4iLCJXYXNtTWFuYWdlciIsIkV2ZW50VGFyZ2V0IiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiZnVuY25hbWUiLCJyYXdBcmdzIiwibWFwIiwiVmVjdG9yMiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUtBOzs7Ozs7VUFNYUE7SUFDSEMsRUFBQUEsV0FBVztJQUVYQyxFQUFBQSxTQUFTLEdBQXNCLElBQXRCO0lBRVRDLEVBQUFBLFNBQVMsR0FBc0IsSUFBdEI7O0lBR1RDLEVBQUFBLFNBQVMsR0FNTixJQU5NO0lBUWpCOzs7Ozs7O0lBTUFDLEVBQUFBLFlBQVlKO0lBQ1YsU0FBS0EsV0FBTCxHQUFtQkEsV0FBbkI7SUFDRDtJQUVEOzs7Ozs7OztJQU1PSyxFQUFBQSxXQUFXLENBQUNDLEtBQUQ7SUFDaEJBLElBQUFBLEtBQUssQ0FBQ0MsYUFBTixDQUFvQixLQUFLUCxXQUF6QjtJQUVBLFVBQU07SUFBQ1EsTUFBQUE7SUFBRCxRQUFZRixLQUFLLENBQUNHLFFBQXhCOztJQUVBLFFBQUdELE9BQU8sSUFBSUEsT0FBTyxDQUFDRSxPQUFSLEVBQVgsSUFBZ0NGLE9BQU8sQ0FBQ0csRUFBUixHQUFhLENBQTdDLElBQWtESCxPQUFPLENBQUNJLE1BQTdELEVBQXNFO0lBQ3BFLFlBQU1ELEVBQUUsR0FBRyxLQUFLWCxXQUFMLENBQWlCYSxZQUFqQixDQUE4QixlQUE5QixFQUErQ0wsT0FBTyxDQUFDSSxNQUF2RCxDQUFYO0lBQ0FKLE1BQUFBLE9BQU8sQ0FBQ0csRUFBUixHQUFhQSxFQUFiO0lBQ0FMLE1BQUFBLEtBQUssQ0FBQ0csUUFBTixDQUFlRixhQUFmLENBQTZCLEtBQUtQ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
