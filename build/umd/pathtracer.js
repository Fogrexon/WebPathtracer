
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
        (_this$_materialBuffer = this._materialBuffer) === null || _this$_materialBuffer === void 0 ? void 0 : _this$_materialBuffer.setArray( // [
        //   0,
        //   this.texture ? this.texture.id : -1,
        //   this.color.x,
        //   this.color.y,
        //   this.color.z,
        // ] as MaterialUniformsArray
        [1, 1.5]);
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

    var mainWasm = "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QAJAIAIgByAGEDlFDQAgAyAHEEArAwA5AwggByEJAkADQCAJIAYiBRBAKwMAOQMAAkAgBSAARw0AIAAhBQwCCyAFIQkgAiADQQhqIAVBeGoiBhA5DQALCyAFIANBCGoQQCsDADkDACAIQQFqIghBCEYNAQsgByEGIAdBCGohBwwBCwsgB0EIaiABRiEECyADQRBqJAAgBAsEACAACwgAQZgIEBIACzEBAX8gAEEBIAAbIQECQANAIAEQayIADQECQBBKIgBFDQAgABEKAAwBCwsQBAALIAALBgAgABBsCw8AIABB4CJBCGo2AgAgAAs5AQJ/IAEQiAEiAkENahBCIgNBADYCCCADIAI2AgQgAyACNgIAIAAgAxBGIAEgAkEBahB5NgIAIAALBwAgAEEMagseACAAEEQaIABBjCNBCGo2AgAgAEEEaiABEEUaIAALBABBAQsHACAAKAIACwgAQcjtABBJCwQAIAALBgAgABBDCwUAQeEICxwAIABBjCNBCGo2AgAgAEEEahBPGiAAEEsaIAALJwEBfwJAIAAQSEUNACAAKAIAEFAiAUEIahBRQX9KDQAgARBDCyAACwcAIABBdGoLFQEBfyAAIAAoAgBBf2oiATYCACABCwgAIAAQThBDCwkAIABBBGoQVAsHACAAKAIACwsAIAAQThogABBDCwQAIAALWQECfyABLQAAIQICQCAALQAAIgNFDQAgAyACQf8BcUcNAANAIAEtAAEhAiAALQABIgNFDQEgAUEBaiEBIABBAWohACADIAJB/wFxRg0ACwsgAyACQf8BcWsLCQAgABBWGiAACwIACwIACwsAIAAQWBogABBDCwsAIAAQWBogABBDCy0AAkAgAg0AIAAoAgQgASgCBEYPCwJAIAAgAUcNAEEBDwsgABBeIAEQXhBXRQsHACAAKAIEC6sBAQJ/IwBBwABrIgMkAEEBIQQCQCAAIAFBABBdDQBBACEEIAFFDQBBACEEIAFBrCRB3CRBABBgIgFFDQAgA0EIakEEckEAQTQQehogA0EBNgI4IANBfzYCFCADIAA2AhAgAyABNgIIIAEgA0EIaiACKAIAQQEgASgCACgCHBEDAAJAIAMoAiAiBEEBRw0AIAIgAygCGDYCAAsgBEEBRiEECyADQcAAaiQAIAQLqAIBA38jAEHAAGsiBCQAIAAoAgAiBUF8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";

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
