
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
      _materialBuffer = null;

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
      texture = null;

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

    var mainWasm = "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AkIANwOoAiADKAIEIAMoAgAiCWsiAUEMbSEEIAEEQCAEQdaq1aoBTw0CIAIgARArIgM2AqgCIAIgAyAEQQxsajYCsAIgAiABQQBKBH8gAyAJIAEQSCABQQxuQQxsagUgAws2AqwCCyACQagCaiEOIwBBEGsiDCQAIAJByAJqIgMgAkG4AmoiAUcEQAJAIAEoAgQiECABKAIAIglrIgRBBnUiDSADKAIIIg8gAygCACIBa0EGdU0EQCAJIAMoAgQgAWsiBGogECANIARBBnUiD0sbIhEgCWsiBARAIAEgCSAEEEoaCyANIA9LBEAgAygCBCEJIAMgECARayIBQQBKBH8gCSARIAEQSCABagUgCQs2AgQMAgsgAyABIARqNgIEDAELIAEEQCADIAE2AgQgARBAIANBADYCCCADQgA3AgBBACEPCwJAIARBAEgNACANIA9BBXUiASABIA1JG0H///8fIA9BBnVB////D0kbIgFBgICAIE8NACADIAFBBnQiDRArIgE2AgAgAyABNgIEIAMgASANajYCCCADIAQEfyABIAkgBBBIIARqBSABCzYCBAwBCxAqAAsLIAMgAygCDDYCECADQQxqQQEQFSAMQQA2AgggDEIANwMAIA4oAgQgDigCACIJayIBQQxtIQQCQAJAIAEEQCAEQdaq1aoBTw0BIAwgARArIg42AgAgDCAOIARBDGxqNgIIIAwgAUEASgR/IA4gCSABEEggAUEMbkEMbGoFIA4LNgIECyADIAxBABAWIAwoAgAiAwRAIAwgAzYCBCADEEALIAxBEGokAAwBCxAqAAsgAigCqAIiAQRAIAIgATYCrAIgARBACyACKAK4AiIBBEAgAiABNgK8AiABEEALIAJBADYCECACQgA3AwggAigCzAIgAigCyAIiBGsiAQRAIAFBAEgNAyACIAEQKyIDNgIIIAIgAzYCDCACIAMgAUEGdUEGdGo2AhAgAiADIAQgARBIIAFqNgIMCyACQQA2AhwgAkIANwIUIAIoAtgCIAIoAtQCIglrIgFByABtIQQgAQRAIARB5PG4HE8NBCACIAEQKyIDNgIUIAIgAzYCGCACIAMgBEHIAGxqNgIcIAIgAUEASgR/IAMgCSABEEggAUHIAG5ByABsagUgAws2AhgLIAJBIGogCkGAARBIIQogAkGgAWogAEGAARBIGiACIAU2AqACAkBBlO0AKAIAIgFBmO0AKAIARwRAIAFBADYCCCABQgA3AgAgAigCDCACKAIIayIEBEAgBEEASA0HIAEgBBArIgM2AgAgASADNgIEIAEgAyAEQQZ1QQZ0ajYCCCABIAIoAgwgAigCCCIAayIEQQBKBH8gAyAAIAQQSCAEagUgAws2AgQLIAFCADcCDCABQQA2AhQgAigCGCACKAIUayIDQcgAbSEEIAMEQCAEQeTxuBxPDQggASADECsiAzYCDCABIAM2AhAgASADIARByABsajYCFCABIAIoAhggAigCFCIAayIEQQBKBH8gAyAAIAQQSCAEQcgAbkHIAGxqBSADCzYCEAsgAUEYaiAKQYQCEEgaQZTtACABQaACajYCAAwBCyACQQhqIQQCQAJAAkBBlO0AKAIAQZDtACgCACIAa0GgAm0iA0EBaiIBQbmcjgdJBEAgAUGY7QAoAgAgAGtBoAJtIgBBAXQiCiABIApLG0G4nI4HIABBnI7HA0kbIgEEfyABQbmcjgdPDQIgAUGgAmwQKwVBAAsiCiADQaACbGoiAEEANgIIIABCADcCAAJAAkACQCAEIgMoAgQgAygCAGsiCQRAIAlBAEgNASAAIAkQKyIFNgIAIAAgBTYCBCAAIAUgCUEGdUEGdGo2AgggACADKAIEIAMoAgAiDGsiCUEASgR/IAUgDCAJEEggCWoFIAULNgIECyAAQgA3AgwgAEEANgIUIAMoAhAgAygCDGsiBUHIAG0hCSAFBEAgCUHk8bgcTw0CIAAgBRArIgU2AgwgACAFNgIQIAAgBSAJQcgAbGo2AhQgACADKAIQIAMoAgwiCWsiA0EASgR/IAUgCSADEEggA0HIAG5ByABsagUgBQs2AhALDAILECoACxAqAAsgAEEYaiAEQRhqQYQCEEgaIAogAUGgAmxqIQUgAEGgAmohCUGU7QAoAgAiAUGQ7QAoAgAiA0YNAgNAIABBoAJrIgBBADYCCCAAQgA3AwAgACABQaACayIBKAIANgIAIAAgASgCBDYCBCAAIAEoAgg2AgggAUEANgIIIAFCADcDACAAQRRqIgRBADYCACAAQgA3AgwgACABKAIMNgIMIAAgASgCEDYCECAEIAFBFGoiCigCADYCACAKQQA2AgAgAUIANwIMIABBGGogAUEYakGEAhBIGiABIANHDQALQZjtACAFNgIAQZTtACgCACEBQZTtACAJNgIAQZDtACgCACEDQZDtACAANgIAIAEgA0YNAwNAIAFBoAJrIQAgAUGUAmsoAgAiBARAIAFBkAJrIAQ2AgAgBBBACyAAKAIAIgQEQCABQZwCayAENgIAIAQQQAsgAyAAIgFHDQALDAMLECoAC0GWCRANAAtBmO0AIAU2AgBBlO0AIAk2AgBBkO0AIAA2AgALIAMEQCADEEALCyMAQRBrIgQkAAJAAkACQEGg7QAoAgAiAyAGQQFqIgBJBEACQAJAQaTtACgCACIFQQV0IgEgACADayIJSQ0AIAMgASAJa0sNAEGg7QAgADYCACADQR9xIQFBnO0AKAIAIANBA3ZB/P///wFxaiEADAELIARBADYCCCAEQgA3AwAgAEEASA0DIwBBEGsiCiQAAkACQAJAIAFB/v///wNNBH8gAEEfakFgcSIAIAVBBnQiAyAAIANLGwVB/////wcLIgAgBCgCCEEFdE0NACAKQQA2AgggCkIANwMAIABBAEgNASAAQQFrQQV2QQFqIgxBAnQQKyEBIAogDDYCCCAKIAE2AgAgBCgCACEDIAogBCgCBCIANgIEIAFBACAAQQFrQQV2IABBIUkbQQJ0akEANgIAAkAgAEEATA0AIAEgAyAAQQV2Ig1BAnQiBRBKIQ4gACANQQV0ayIAQQBMDQAgBSAOaiIFIAUoAgBBf0EgIABrdiIAQX9zcSADIA1BAnRqKAIAIABxcjYCAAsgBCAMNgIIIAQgATYCACADRQ0AIAMQQAsgCkEQaiQADAELECoACyAEQaDtACgCACIBIAlqNgIEQZztACgCACEDIAQoAgAhAAJAIAFBAEwEQEEAIQEMAQsgACADIAFBBXYiCkECdCIFEEogBWohAAJAIAEgCkEFdGsiAUEATARAQQAhAQwBCyAAIAAoAgBBf0EgIAFrdiIKQX9zcSADIAVqKAIAIApxcjYCAAtBnO0AKAIAIQMLQZztACAEKAIANgIAIAQgAzYCAEGg7QAoAgAhBUGg7QAgBCgCBDYCACAEIAU2AgRBpO0AKAIAIQVBpO0AIAQoAgg2AgAgBCAFNgIIIANFDQAgAxBACyAJRQ0BIAEEfyAAIAAoAgBBfyABdEF/QSAgAWsiASAJIAEgASAJSxsiAWt2cUF/c3E2AgAgCSABayEJIABBBGoFIAALIAlBBXZBAnQiARBJIQAgCUEfcSIJRQ0BIAAgAWoiASABKAIAQX9BICAJa3ZBf3NxNgIADAELQaDtACAANgIACyAEQRBqJAAMAQsQKgALQZztACgCACAGQQN2Qfz///8BcWoiASABKAIAQQEgBnRyNgIAIAIoAhQiAQRAIAIgATYCGCABEEALIAIoAggiAQRAIAIgATYCDCABEEALIAIoAtQCIgEEQCACIAE2AtgCIAEQQAsgAigCyAIiAQRAIAIgATYCzAIgARBACyACQeACaiQADAYLECoACxAqAAsQKgALECoACxAqAAsQKgALIAcoAoACIgUEQCAHIAU2AoQCIAUQQAsgBygCkAIiBQRAIAcgBTYClAIgBRBACyAIBEAgCBBACyALBEAgCxBACyAHQcAEaiQAQQAPCxAqAAtBlgkQDQALECoACxAqAAtBgAhBzwhBM0GHCRAAAAvPAQECfSAAKgIAIQEgACoCBCECQcDsACAAKgIIuzkDAEG47AAgArs5AwBBsOwAIAG7OQMAIAAqAgwhASAAKgIQIQJB2OwAIAAqAhS7OQMAQdDsACACuzkDAEHI7AAgAbs5AwAgACoCGCEBIAAqAhwhAkHw7AAgACoCILs5AwBB6OwAIAK7OQMAQeDsACABuzkDACAAKgIkIQEgACoCKCECQYjtACAAKgIsuzkDAEGA7QAgArs5AwBB+OwAIAG7OQMAQajsACAAKgIwuzkDAEEAC4IlAhN/JnwjAEHQAGsiBCQAAn9Bf0GY7AAtAABFDQAaQaTsACgCACERQaDsACgCACEPQaYKEFFBuO0AKAIAIgZBpOwAKAIATgRAIBFBAEoEQCARQQFrIQ4gD0EBayEGIA9BAEwhEgNAIBJFBEAgDyATbCELQbztACgCACAOIBMgDiATSBtBDGxqKAIAIRBBACEJA0AgECAGIAkgBiAJSBtBGGxqIgMrAxAhFiADKwMAIRUgAysDCCEXIAAgCSALakEEdGoiA0H/ATYCDCADAn8gF0QAAAAAAAAAAKBEF1100UUX3T8QRkQAAAAAAOBvQKIiF5lEAAAAAAAA4EFjBEAgF6oMAQtBgICAgHgLNgIEIAMCfyAVRAAAAAAAAAAAoEQXXXTRRRfdPxBGRAAAAAAA4G9AoiIVmUQAAAAAAADgQWMEQCAVqgwBC0GAgICAeAs2AgAgAwJ/IBZEAAAAAAAAAACgRBdddNFFF90/EEZEAAAAAADgb0CiIhaZRAAAAAAAAOBBYwRAIBaqDAELQYCAgIB4CzYCCCAJQQFqIgkgD0cNAAsLIBNBAWoiEyARRw0ACwtBmOwAQQA6AABBAAwBCyARQQJtIQkgD0ECbSEDAkAgBiARTgRAIAYhCQwBCyAJtyE3IAO3ITggEbchNiAGIQ4DQCAPQQBKBEAgDiAPbCETIA63ITlBACEJA0BBgOwAKAIAIgNBAnRBwNgAaiIMIANBjQNqQfAEcEECdEHA2ABqKAIAIANBAWpB8ARwIgZBAnRBwNgAaiIFKAIAIgtBAXFB3+GiyHlscyALQf7///8HcSAMKAIAQYCAgIB4cXJBAXZzIgM2AgAgBSAGQY0DakHwBHBBAnRBwNgAaigCACAGQQFqQfAEcCIMQQJ0QcDYAGoiCygCACIQQQFxQd/hosh5bHMgEEH+////B3EgBSgCAEGAgICAeHFyQQF2cyIGNgIAIAsgDEGNA2pB8ARwQQJ0QcDYAGooAgAgDEEBakHwBHAiBUECdEHA2ABqIhAoAgAiEkEBcUHf4aLIeWxzIBJB/v///wdxIAsoAgBBgICAgHhxckEBdnMiDDYCACAQIAVBjQNqQfAEcEECdEHA2ABqKAIAIAVBAWpB8ARwIgtBAnRBwNgAaigCACISQQFxQd/hosh5bHMgEkH+////B3EgECgCAEGAgICAeHFyQQF2cyIFNgIAQYDsACALNgIAQcDsACsDACEXQdjsACsDACEsQfDsACsDACEtQYjtACsDACEuQbDsACsDACEeQcjsACsDACEiQeDsACsDACEvQfjsACsDACEwQbjsACsDACEqQdDsACsDACExQajsACsDACEWQejsACsDACEyQYDtACsDACEzQZDsACsDACEoQYjsACsDACEVIARBwOwAKQMANwMwIARBuOwAKQMANwMoIARBsOwAKQMANwMgIAQgHiAeIBYgIqKhIC8gFSAoIBWhIiggBUELdiAFcyIFQQd0QYCtsel5cSAFcyIFQQ90QYCAmP5+cSAFcyIFQRJ2IAVzuEQAAAAAAADwQaIgDEELdiAMcyIFQQd0QYCtsel5cSAFcyIFQQ90QYCAmP5+cSAFcyIFQRJ2IAVzuKBEAAAAAAAA8DuioqAgOaAgN6GaIDajIiKioSAwIBUgKCAGQQt2IAZzIgZBB3RBgK2x6XlxIAZzIgZBD3RBgICY/n5xIAZzIgZBEnYgBnO4RAAAAAAAAPBBoiADQQt2IANzIgNBB3RBgK2x6XlxIANzIgNBD3RBgICY/n5xIANzIgNBEnYgA3O4oEQAAAAAAADwO6KioCAJt6AgOKEgNqMiFaKhoSIeIBcgFyAWICyioSAtICKioSAVIC6ioaEiFyAXoiAeIB6iICogKiAWIDGioSAyICKioSAVIDOioaEiFiAWoqCgnyIVozkDOCAEIBYgFaM5A0AgBCAXIBWjOQNIQQAhBiMAQZAFayIBJAAgBEEgaiIHKwMoIRQgBysDICEcIAcrAxghGSAHKwMQISkgBysDCCEjIAcrAwAhJCABQoCAgICAgICKwAA3A4gFIAFCgICAgICAgIrAADcDgAUgAUKAgICAgICAisAANwP4BCABQoCAgICAgID4PzcD8AQgAUIANwPoBCABQoCAgICAgICEwAA3A+AEIAFCADcD2AQgBEIANwMQIARCADcDCCAEQgA3AwAgBEKAgICAgICA+D83AxhEAAAAAAAA8D8hF0QAAAAAAADwPyElRAAAAAAAAPA/IR4CQANAAkAgAUHgA2oiByAjOQMAIAFB6ANqIgggKTkDACABQcgDaiICIBw5AwAgAUHQA2oiCiAUOQMAIAEgBykDADcDUCABIAgpAwA3A1ggASACKQMANwM4IAFBQGsgCikDADcDACABICQ5A9gDIAEgGTkDwAMgASABKQPYAzcDSCABIAEpA8ADNwMwIAFB8ANqQZDtACABQcgAaiABQTBqEAkgAS0A8ANBAXFFDQAgASsDwAQhGyABKwPIBCEgIAErA5gEIRggASsDoAQhGiABKwOoBCEdIAErA/gDISQgASsDgAQhIyABIAErA4gEIik5A7gDIAEgIzkDsAMgASAkOQOoAyABIB05A6ADIAEgGjkDmAMgASAYOQOQAyABQgA3A4gDIAEgIDkDgAMgASAbOQP4AiABKALQBCEHIAEgGCAZmiImoiAaIByioSAUIB2ioTkD6AIgASAmRAAAAAAAAAAARAAAAAAAAPA/IBiZRM3MzMzMzOw/ZCIIGyIZIBggHUQAAAAAAAAAAKIgGCAZoiAaRAAAAAAAAPA/RAAAAAAAAAAAIAgbIh+ioKAiGaKhIhtEAAAAAAAAAAAgHSAZoqEiICAgoiAbIBuiIB8gGiAZoqEiGyAboqCgnyIfoyIZoiAbIB+jIhsgHKKhIBQgICAfoyIgoqE5A+ACIAEgJiAaICCiIBsgHaKhIiKiIB0gGaIgICAYoqEiKCAcoqEgFCAYIBuiIBkgGqKhIiqioTkD8AIgAUHYAmoiCEIANwMAIAFB0AJqIgJCADcDACABQgA3A8gCIAFBkAFqIAcgAUHgAmogAUHIAmogAUHAAmogAUH4AmpBqO0AIAcoAgAoAgARCgAgASsDkAEhHCABKwOYASEsIAErA6ABIR8gCCsDACEdIAIrAwAhGCABKwPAAiEaIAErA5ADIS0gASsDmAMhLiABKwOgAyEvIAErA8gCISYgAUG4AmoiEEIANwMAIAFBsAJqIhJCADcDACABQgA3A6gCIAFBoAJqIgdCADcDACABQZgCaiIIQgA3AwAgAUIANwOQAkGA7AAoAgAiC0ECdEHA2ABqIg0gC0GNA2pB8ARwQQJ0QcDYAGooAgAgC0EBakHwBHAiDEECdEHA2ABqIgooAgAiAkEBcUHf4aLIeWxzIAJB/v///wdxIA0oAgBBgICAgHhxckEBdnMiCzYCACAKIAxBjQNqQfAEcEECdEHA2ABqKAIAIAxBAWpB8ARwIg1BAnRBwNgAaiICKAIAIgNBAXFB3+GiyHlscyADQf7///8HcSAKKAIAQYCAgIB4cXJBAXZzIgw2AgAgAiANQY0DakHwBHBBAnRBwNgAaigCACANQQFqQfAEcCIKQQJ0QcDYAGoiAygCACIFQQFxQd/hosh5bHMgBUH+////B3EgAigCAEGAgICAeHFyQQF2cyINNgIAIAMgCkGNA2pB8ARwQQJ0QcDYAGooAgAgCkEBakHwBHAiAkECdEHA2ABqKAIAIgVBAXFB3+GiyHlscyAFQf7///8HcSADKAIAQYCAgIB4cXJBAXZzIgo2AgBBgOwAIAI2AgAgAUGQA2oiAisDECEwIAIrAwAhMSACKwMIITIgAUGoA2oiAisDECEnIAIrAwghKyACKwMAITQgAUHYBGoiAysDECE1IAMrAwAhFUGI7AArAwAhFEGQ7AArAwAhFiABQagCaiIFIAMrAxgiIUQAAAAAAAAAAKIgAysDCKAiMzkDCCAFIBUgISAUIBYgFKEiFiAMQQt2IAxzIgJBB3RBgK2x6XlxIAJzIgJBD3RBgICY/n5xIAJzIgJBEnYgAnO4RAAAAAAAAPBBoiALQQt2IAtzIgJBB3RBgK2x6XlxIAJzIgJBD3RBgICY/n5xIAJzIgJBEnYgAnO4oEQAAAAAAADwO6KioEQAAAAAAADgv6CioCIVOQMAIAUgNSAhIBQgFiAKQQt2IApzIgJBB3RBgK2x6XlxIAJzIgJBD3RBgICY/n5xIAJzIgJBEnYgAnO4RAAAAAAAAPBBoiANQQt2IA1zIgJBB3RBgK2x6XlxIAJzIgJBD3RBgICY/n5xIAJzIgJBEnYgAnO4oEQAAAAAAADwO6KioEQAAAAAAADgv6CioCIUOQMQIAFBkAJqIgIgFCAnoSIUIBQgFKIgFSA0oSIUIBSiIDMgK6EiISAhoqCgIjSfIiejIis5AxAgAiAhICejIiE5AwggAiAUICejIhQ5AwAgAysDKCEnIAMrAyAhNSABQfgBaiICIAMrAzAgISAURAAAAAAAAAAAoqEgK0QAAAAAAAAAAKKhICsgMKIgFCAxoiAyICGioKCimSA0oyIUojkDECACICcgFKI5AwggAiA1IBSiOQMAIAFBgAFqIgIgIzkDACABQYgBaiIKICk5AwAgAUHoAGoiDSAIKwMAOQMAIAFB8ABqIgggBysDADkDACABIAIpAwA3AyAgASAKKQMANwMoIAEgDSkDADcDCCABIAgpAwA3AxAgASAkOQN4IAEgASsDkAI5A2AgASABKQN4NwMYIAEgASkDYDcDACABQZABakGQ7QAgAUEYaiABEAkgFyAfIBiZIhSiIBqjoiEfICUgLCAUoiAao6IhJSAeIBwgFKIgGqOiIRoCQCABLQCQAUEBcQRAIBArAwAgKaEiFCAUoiABKwOoAiAkoSIUIBSiIBIrAwAgI6EiFCAUoqCgIAErA6gBICmhIhQgFKIgASsDmAEgJKEiFCAUoiABKwOgASAjoSIUIBSioKBjRQ0BCyABKwOIAiEUIAErA4ACIRwgBCAaIAErA/gBoiAEKwMAoDkDACAEICUgHKIgBCsDCKA5AwggBCAfIBSiIAQrAxCgOQMQC0GA7AAoAgAiB0ECdEHA2ABqIgogB0GNA2pB8ARwQQJ0QcDYAGooAgAgB0EBakHwBHAiCEECdEHA2ABqIgIoAgAiDUEBcUHf4aLIeWxzIA1B/v///wdxIAooAgBBgICAgHhxckEBdnMiBzYCACACIAhBjQNqQfAEcEECdEHA2ABqKAIAIAhBAWpB8ARwIgpBAnRBwNgAaigCACINQQFxQd/hosh5bHMgDUH+////B3EgAigCAEGAgICAeHFyQQF2cyIINgIAQYDsACAKNgIAQZDsACsDAEGI7AArAwAiFKEgCEELdiAIcyIIQQd0QYCtsel5cSAIcyIIQQ90QYCAmP5+cSAIcyIIQRJ2IAhzuEQAAAAAAADwQaIgB0ELdiAHcyIHQQd0QYCtsel5cSAHcyIHQQ90QYCAmP5+cSAHcyIHQRJ2IAdzuKBEAAAAAAAA8DuioiAUoEQrhxbZzvfvP2YNAiAdIC+iICYgIKIgKiAYoqCgIRQgHSAuoiAmIBuiICggGKKgoCEcIB0gLaIgJiAZoiAiIBiioKAhGSAfRCuHFtnO9+8/oyEXICVEK4cW2c737z+jISUgGkQrhxbZzvfvP6MhHiAGQQFqIgZBCkcNAQwCCwsgBCAeIBREAAAAAAAAAACiIBlEAAAAAAAAAACiIBygoJkiGKIgBCsDAKA5AwAgBCAlIBiiIAQrAwigOQMIIAQgFyAYoiAEKwMQoDkDEAsgAUGQBWokACAEKwMAIRYgBCsDCCEVQbztACgCACAOQQxsaigCACAJQRhsaiIDIAQrAxBEAAAAAAAAAACgIhc5AxAgAyAVRAAAAAAAAAAAoCIVOQMIIAMgFkQAAAAAAAAAAKAiFjkDACAAIAkgE2pBBHRqIgMCfyAVRAAAAAAA4G9AoiIVmUQAAAAAAADgQWMEQCAVqgwBC0GAgICAeAs2AgQgAwJ/IBZEAAAAAADgb0CiIhaZRAAAAAAAAOBBYwRAIBaqDAELQYCAgIB4CzYCACADAn8gF0QAAAAAAOBvQKIiFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLNgIIIANB/wE2AgwgCUEBaiIJIA9HDQALQbjtACgCACEGCyAOQQFqIgkgEU4NASAOIAZBCWpIIQMgCSEOIAMNAAsLQbjtACAJNgIAQQELIQkgBEHQAGokACAJC6cMAQ1/IwBBEGsiCyQAQX8hBAJAAkBBmOwALQAADQBBoOwAIAE2AgBBmOwAQQE6AABBpOwAIAI2AgBBwO0AKAIAIgVBvO0AKAIAIgZHBEADQCAFQQxrIgMoAgAiBwRAIAVBCGsgBzYCACAHEEALIAMhBSADIAZHDQALC0HA7QAgBjYCACALQQA2AgggC0IANwMAIAEEQCABQavVqtUATw0CIAsgAUEYbCIDECsiBTYCACALIAMgBWo2AgggCyAFIANBGGtBGG5BGGxBGGoiAxBJIANqNgIECyALIQUCQAJAAkACQCACIgdBxO0AKAIAIgNBvO0AKAIAIgRrQQxtTQRAQcDtACgCACAEa0EMbSIGIAcgBiAHSRsiAwRAA0AgBCAFRwRAAkAgBSgCBCIOIAUoAgAiDWsiCUEYbSIIIAQoAggiDCAEKAIAIgprQRhtTQRAIA0gBCgCBCAKa0EYbSIJQRhsaiAOIAggCUsbIg8gDWsiDARAIAogDSAMEEoaCyAIIAlLBEAgBCgCBCENIAQgDiAPayIIQQBKBH8gDSAPIAgQSCAIQRhuQRhsagUgDQs2AgQMAgsgBCAKIAxBGG1BGGxqNgIEDAELIAoEQCAEIAo2AgQgChBAIARBADYCCCAEQgA3AgBBACEMCwJAIAhBq9Wq1QBPDQAgCCAMQRhtIgpBAXQiDiAIIA5LG0Gq1arVACAKQdWq1SpJGyIIQavVqtUATw0AIAQgCEEYbCIKECsiCDYCACAEIAg2AgQgBCAIIApqNgIIIAQgCUEASgR/IAggDSAJEEggCUEYbkEYbGoFIAgLNgIEDAELECoACwsgBEEMaiEEIANBAWsiAw0ACwsgBiAHSQRAQcDtACgCACEEQcDtACAHIAZrIgMEfyAEIANBDGxqIQkDQCAEQQA2AgggBEIANwIAIAUoAgQgBSgCAGsiA0EYbSEGIAMEQCAGQavVqtUATw0FIAQgAxArIgM2AgAgBCADNgIEIAQgAyAGQRhsajYCCCAEIAUoAgQgBSgCACIHayIGQQBKBH8gAyAHIAYQSCAGQRhuQRhsagUgAws2AgQLIARBDGoiBCAJRw0ACyAJBSAECzYCAAwFC0HA7QAoAgAiBUG87QAoAgAgB0EMbGoiBkcEQANAIAVBDGsiBCgCACIDBEAgBUEIayADNgIAIAMQQAsgBCEFIAQgBkcNAAsLQcDtACAGNgIADAQLIAQEQCAEQcDtACgCACIGRgR/IAQFA0AgBkEMayIDKAIAIgkEQCAGQQhrIAk2AgAgCRBACyADIQYgAyAERw0AC0G87QAoAgALIQNBwO0AIAQ2AgAgAxBAQcTtAEEANgIAQbztAEIANwIAQQAhAwsgB0HWqtWqAU8NASAHIANBDG0iBEEBdCIDIAMgB0kbQdWq1aoBIARBqtWq1QBJGyIEQdaq1aoBTw0BQbztACAEQQxsIgMQKyIENgIAQcDtACAENgIAQcTtACADIARqNgIAIAQgB0EMbGohBiAFKAIEIAUoAgAiDGsiA0EYbSIHQavVqtUASSEJIANBAEwhDiADQRhuQRhsIQ8DQCAEQQA2AgggBEIANwIAIAMEQCAJRQ0EIAQgAxArIgU2AgAgBCAFNgIEIAQgBSAHQRhsajYCCCAEIA4EfyAFBSAFIAwgAxBIIA9qCzYCBAsgBEEMaiIEIAZHDQALQcDtACAGNgIADAMLECoACxAqAAsQKgALIAsoAgAiAwRAIAsgAzYCBCADEEALQQAhBEG47QBBADYCACABIAJsQQJ0IgNBAEwNACADQQRxIQZBACEFIANBAWtBB08EQCADQXhxIQFBACEHA0AgACAFQQJ0IgNqQf8BNgIAIAAgA0EEcmpB/wE2AgAgACADQQhyakH/ATYCACAAIANBDHJqQf8BNgIAIAAgA0EQcmpB/wE2AgAgACADQRRyakH/ATYCACAAIANBGHJqQf8BNgIAIAAgA0EccmpB/wE2AgAgBUEIaiEFIAdBCGoiByABRw0ACwsgBkUNAEEAIQMDQCAAIAVBAnRqQf8BNgIAIAVBAWohBSADQQFqIgMgBkcNAAsLIAtBEGokACAEDwsQKgALxAcCCXwCfyABKwMoIQkgAisDCCEKQYDsACgCACIBQQJ0QcDYAGoiECABQY0DakHwBHBBAnRBwNgAaigCACABQQFqQfAEcCIFQQJ0QcDYAGoiBigCACIRQQFxQd/hosh5bHMgEUH+////B3EgECgCAEGAgICAeHFyQQF2cyIBNgIAIAYgBUGNA2pB8ARwQQJ0QcDYAGooAgAgBUEBakHwBHAiEEECdEHA2ABqKAIAIhFBAXFB3+GiyHlscyARQf7///8HcSAGKAIAQYCAgIB4cXJBAXZzIgU2AgBBgOwAIBA2AgBEAAAAAAAA8D9EAAAAAAAA8L8gCkQAAAAAAAAAAGQiBhshDAJ/QZDsACsDAEGI7AArAwAiB6EgBUELdiAFcyIFQQd0QYCtsel5cSAFcyIFQQ90QYCAmP5+cSAFcyIFQRJ2IAVzuEQAAAAAAADwQaIgAUELdiABcyIBQQd0QYCtsel5cSABcyIBQQ90QYCAmP5+cSABcyIBQRJ2IAFzuKBEAAAAAAAA8DuioiAHoEQAAAAAAADwP0QAAAAAAADwPyAJIAYbIgcgCUQAAAAAAADwPyAGGyIIoSAHIAigoyIJIAmiIgmhRAAAAAAAAPA/IAqZIguhRAAAAAAAABRAEEaiIAmgIgljBEAgAyACKwMQIgcgB0QAAAAAAAAAAKIgAisDACIHRAAAAAAAAAAAoiAKIAyioKAiCCAIoCIIRAAAAAAAAAAAoiILoTkDECADIAogDCAIoqE5AwggAyAHIAuhOQMAIAQgCTkDACADQQhqDAELIAIrAwAhDSAHIAijIgdEAAAAAAAA8D8gCyALoqFEAAAAAAAAAACln6IiCCAIoiIIRAAAAAAAAPA/ZEUEQCADIAcgAisDECILRAAAAAAAAAAAoiANRAAAAAAAAAAAoiAKIAyioKAiDkQAAAAAAAAAAKIiDyALoaJEAAAAAAAA8D8gCKGfIghEAAAAAAAAAACiIguhOQMQIAMgByAMIA6iIAqhoiAMIAiioTkDCCADIAcgDyANoaIgC6E5AwAgBEQAAAAAAADwPyAJoSIKOQMAIAcgB6IgCqIhCSADQQhqDAELIAMgAisDECIHIAdEAAAAAAAAAACiIA1EAAAAAAAAAACiIAwgCqKgoCIHIAegIgdEAAAAAAAAAACiIgihOQMQIAMgCiAMIAeioTkDCCADIA0gCKE5AwAgBEQAAAAAAADwPyAJoSIJOQMAIANBCGoLIQMgACAJIAMrAwCZoyIKOQMQIAAgCjkDCCAAIAo5AwALjg4DBnwHfwF+IwBBIGsiESQAQYDsACgCACICQQJ0QcDYAGoiDyACQY0DakHwBHBBAnRBwNgAaigCACACQQFqQfAEcCINQQJ0QcDYAGoiDigCACIQQQFxQd/hosh5bHMgEEH+////B3EgDygCAEGAgICAeHFyQQF2cyICNgIAIA4gDUGNA2pB8ARwQQJ0QcDYAGooAgAgDUEBakHwBHAiD0ECdEHA2ABqIhAoAgAiEkEBcUHf4aLIeWxzIBJB/v///wdxIA4oAgBBgICAgHhxckEBdnMiDTYCACAQIA9BjQNqQfAEcEECdEHA2ABqKAIAIA9BAWpB8ARwIg5BAnRBwNgAaiISKAIAIhNBAXFB3+GiyHlscyATQf7///8HcSAQKAIAQYCAgIB4cXJBAXZzIg82AgAgEiAOQY0DakHwBHBBAnRBwNgAaigCACAOQQFqQfAEcCIQQQJ0QcDYAGooAgAiE0EBcUHf4aLIeWxzIBNB/v///wdxIBIoAgBBgICAgHhxckEBdnMiDjYCAEGA7AAgEDYCACADAnxEAAAAAAAA8D9BkOwAKwMAQYjsACsDACIIoSIKIA1BC3YgDXMiDUEHdEGArbHpeXEgDXMiDUEPdEGAgJj+fnEgDXMiDUESdiANc7hEAAAAAAAA8EGiIAJBC3YgAnMiAkEHdEGArbHpeXEgAnMiAkEPdEGAgJj+fnEgAnMiAkESdiACc7igRAAAAAAAAPA7oqIgCKAiByAHoKEiB70iFEIgiKdB/////wdxIgJBgIDA/wNPBEBEAAAAAAAAAABEGC1EVPshCUAgFEIAWRsgFKcgAkGAgMD/A2tyRQ0BGkQAAAAAAAAAACAHIAehowwBCwJ8IAJB/////gNNBEBEGC1EVPsh+T8gAkGBgIDjA0kNARpEB1wUMyamkTwgByAHIAeiECGioSAHoUQYLURU+yH5P6AMAgsgFEIAUwRARBgtRFT7Ifk/IAdEAAAAAAAA8D+gRAAAAAAAAOA/oiIHnyIJIAkgBxAhokQHXBQzJqaRvKCgoSIHIAegDAILRAAAAAAAAPA/IAehRAAAAAAAAOA/oiIJnyILIAkQIaIgCSALvUKAgICAcIO/IgcgB6KhIAsgB6CjoCAHoCIHIAegCwtEAAAAAAAA4D+iIgcQHSIJOQMIIAMgBxAfIgcgCCAKIA5BC3YgDnMiAkEHdEGArbHpeXEgAnMiAkEPdEGAgJj+fnEgAnMiAkESdiACc7hEAAAAAAAA8EGiIA9BC3YgD3MiAkEHdEGArbHpeXEgAnMiAkEPdEGAgJj+fnEgAnMiAkESdiACc7igRAAAAAAAAPA7oqKgRBgtRFT7IRlAoiIIEB+iOQMQIAMgByAIEB2iOQMAIAQgCUQYLURU+yEJQKM5AwAgEUEIaiEOAkAgASgCICICIAYoAgQgBigCACIEa0ECdUgEQCAOAnwgAkEASARARAAAAAAAAPA/IQtEAAAAAAAA8D8hCkQAAAAAAADwPwwBCwJ/IAUrAwhEAAAAAAAAkECiIgicIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIGtyEHAn8gCJsiCZlEAAAAAAAA4EFjBEAgCaoMAQtBgICAgHgLIQ0gCCAHoSEIIA1BCnQhDQJ/IAUrAwBEAAAAAAAAkECiIgmbIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyEDRAAAAAAAAPA/IAihIgcgBCACQQJ0aigCACICIAZBCnQiBCADakEEdGoiBSgCALdEAAAAAADgb0CjoiAIIAIgAyANakEEdGoiAygCALdEAAAAAADgb0CjoqAhC0QAAAAAAADwPyAJAn8gCZwiCplEAAAAAAAA4EFjBEAgCqoMAQtBgICAgHgLIga3oSIJoSIMIAIgBCAGakEEdGoiBCgCALdEAAAAAADgb0CjIAeiIAggAiAGIA1qQQR0aiICKAIAt0QAAAAAAOBvQKOioKIgCSALoqAhCiAMIAQoAgi3RAAAAAAA4G9AoyAHoiAIIAIoAgi3RAAAAAAA4G9Ao6KgoiAJIAcgBSgCCLdEAAAAAADgb0CjoiAIIAMoAgi3RAAAAAAA4G9Ao6KgoqAhCyAMIAQoAgS3RAAAAAAA4G9AoyAHoiAIIAIoAgS3RAAAAAAA4G9Ao6KgoiAJIAcgBSgCBLdEAAAAAADgb0CjoiAIIAMoAgS3RAAAAAAA4G9Ao6KgoqALOQMIIA4gCzkDECAOIAo5AwAMAQtBjApBnwhBGEGUCBAAAAsgASsDECEIIAErAwghCiARKwMIIQcgESsDECEJIAAgASsDGCARKwMYokQYLURU+yEJQKM5AxAgACAIIAmiRBgtRFT7IQlAozkDCCAAIAogB6JEGC1EVPshCUCjOQMAIBFBIGokAAuTGAIZfAp/IwBBgANrIh8kAAJAAkAgASgCDCIhIARByABsai0AMA0AIAMrAwAiD0QAAAAAAAAAAGEgAysDCCIRRAAAAAAAAAAAYXEgAysDECIQRAAAAAAAAAAAYXEhJiACKwMQIQwgAisDCCEOIAIrAwAhCgNAICEgISAEQcgAbGoiICgCNCInQcgAbGoiHisDGCIFIB4rAwAiCCAFIAhjIgQbIQcgCCAFIAQbIQsgHisDECEFIB4rAyghCCAeKwMIIgYgHisDICIJZCEeAkAgD0QAAAAAAAAAAGIiI0UEQEScdQCIPOQ3/kScdQCIPOQ3fiAHIAplRSAKIAtlRXIiBBshB0ScdQCIPOQ3fkScdQCIPOQ3/iAEGyELDAELIAsgCqEgD6MiDSAHIAqhIA+jIgcgByANZBsiC0ScdQCIPOQ3/iALRJx1AIg85Df+ZBshCyANIAcgByANYxsiB0ScdQCIPOQ3fiAHRJx1AIg85Dd+YxshBwsgBSAIZCEEICBBOGohICAJIAYgHhshDSAGIAkgHhshBgJAIBFEAAAAAAAAAABiIiRFBEBEnHUAiDzkN/4gByANIA5lRSAGIA5mRXIiHhshBkScdQCIPOQ3fiALIB4bIQkMAQsgBiAOoSARoyIGIA0gDqEgEaMiDSAGIA1jGyIJIAsgCSALZBshCSAGIA0gBiANZBsiBiAHIAYgB2MbIQYLIAggBSAEGyEHIAUgCCAEGyEFICAoAgAhBAJAAkAgEEQAAAAAAAAAAGIiJUUEQEEBISIgByAMZUUNAiAFIAxmDQEMAgsgBSAMoSAQoyIFIAcgDKEgEKMiCCAFIAhjGyIHIAkgByAJZBshCSAFIAggBSAIZBsiBSAGIAUgBmMbIQYLIAYgCWMgBkQAAAAAAAAAAGNyICZyISILICEgBEHIAGxqIh4rAxgiBSAeKwMAIgggBSAIYyIgGyEHIAggBSAgGyELIB4rAxAhBSAeKwMoIQggHisDCCIGIB4rAyAiCWQhHgJAICNFBEBEnHUAiDzkN/5EnHUAiDzkN34gByAKZUUgCiALZUVyIiAbIQdEnHUAiDzkN35EnHUAiDzkN/4gIBshCwwBCyALIAqhIA+jIg0gByAKoSAPoyIHIAcgDWQbIgtEnHUAiDzkN/4gC0ScdQCIPOQ3/mQbIQsgDSAHIAcgDWMbIgdEnHUAiDzkN34gB0ScdQCIPOQ3fmMbIQcLIAUgCGQhICAJIAYgHhshDSAGIAkgHhshBgJAICRFBEBEnHUAiDzkN/4gByANIA5lRSAGIA5mRXIiHhshBkScdQCIPOQ3fiALIB4bIQkMAQsgBiAOoSARoyIGIA0gDqEgEaMiDSAGIA1jGyIJIAsgCSALZBshCSAGIA0gBiANZBsiBiAHIAYgB2MbIQYLIAggBSAgGyEHIAUgCCAgGyEFAkACfwJAAkAgJUUEQCAHIAxlRQ0CIAUgDGYNAQwCCyAFIAyhIBCjIgUgByAMoSAQoyIIIAUgCGMbIgcgCSAHIAlkGyEJIAUgCCAFIAhkGyIFIAYgBSAGYxshBgsgBiAJYyAGRAAAAAAAAAAAY3IgJnINACAiBEAgH0GgAmohICAfQbgCagwCCyAfIAJBCGoiHikDADcDUCAfIAJBEGoiISkDADcDWCAfIAIpAwA3A0ggHyADQQhqIiApAwA3AzggH0FAayADQRBqIiIpAwA3AwAgHyADKQMANwMwIB9BwAFqIAEgH0HIAGogH0EwaiAnEBQgHyAeKQMANwMgIB8gISkDADcDKCAfIAIpAwA3AxggHyAgKQMANwMIIB8gIikDADcDECAfIAMpAwA3AwAgH0HgAGogASAfQRhqIB8gBBAUIB8tAGBBAEcgHysDeCAMoSIFIAWiIB8rA2ggCqEiBSAFoiAfKwNwIA6hIgUgBaKgoCIIREivvJry13o+ZHEhHgJAIB8tAMABQQBHIB8rA9gBIAyhIgUgBaIgHysDyAEgCqEiCiAKoiAfKwPQASAOoSIOIA6ioKAiDkRIr7ya8td6PmRxIgQNACAeDQAgAEIANwMoIABBfzYCICAAQpzrgcDIh/mb/gA3AwggAEEAOgAAIABCnOuBwMiH+Zv+ADcDUCAAQoCAgICAgID4v383A0ggAEKAgICAgICA+L9/NwNAIABCnOuBwMiH+Zv+ADcDGCAAQpzrgcDIh/mb/gA3AxAgAEIANwMwIABCADcDOCAAQpzrgcDIh/mb/gA3A1gMBgsgBEUEQCAAIB9B4ABqQeAAEEgaDAYLIB5FBEAgACAfQcABakHgABBIGgwGCyAIIA5mBEAgACAfQcABakHgABBIGgwGCyAAIB9B4ABqQeAAEEgaDAULICINASAfQdACaiEgICchBCAfQegCagshHiAgIAIpAwA3AwAgICACKQMQNwMQICAgAikDCDcDCCAeIAMpAxA3AxAgHiADKQMINwMIIB4gAykDADcDACAhIARByABsai0AMEUNAQwCCwsgAEIANwMoIABBfzYCICAAQpzrgcDIh/mb/gA3AwggAEEAOgAAIABCnOuBwMiH+Zv+ADcDUCAAQoCAgICAgID4v383A0ggAEKAgICAgICA+L9/NwNAIABCnOuBwMiH+Zv+ADcDGCAAQpzrgcDIh/mb/gA3AxAgAEIANwMwIABCADcDOCAAQpzrgcDIh/mb/gA3A1gMAQsCQCABKAIAIh4gISAEQcgAbGoiISgCRCIjQQZ0aiIgKwMQIB4gISgCPCIkQQZ0aiIiKwMQIhChIgggAysDACIOmqIiEiAeICFBQGsoAgAiJUEGdGoiISsDCCAiKwMIIgehIgyiICArAwAgIisDACILoSIGIAMrAwgiCpqiIhMgISsDECAQoSIJoiAgKwMIIAehIg8gAysDECIFmqIiFCAhKwMAIAuhIhGiIAYgBaIiFSAMoiAPIA6iIhYgCaIgESAIIAqiIheioKCgoKAiDZlEI0KSDKGcxztjDQAgCSACKwMAIhsgC6EiC5qiIhggD6IgESACKwMIIhwgB6EiB5qiIhkgCKIgDCACKwMQIh0gEKEiEJqiIhogBqIgESAQoiIRIA+iIAwgC6IiDyAIoiAGIAkgB6IiCaKgoKCgoEQAAAAAAADwPyANoyIMoiIGRAAAAAAAAAAAYw0AIBIgB6IgEyAQoiAUIAuiIBUgB6IgFiAQoiALIBeioKCgoKAgDKIiCEQAAAAAAAAAAGMNACAYIAqiIBkgBaIgGiAOoiARIAqiIA8gBaIgCSAOoqCgoKCgIAyiIgxEAAAAAAAAAABjDQAgCCAMoEQAAAAAAADwP2QNACAeICNBBnRqIiErAzAhESAeICVBBnRqIiArAzAhECAeICRBBnRqIh4rAzAhByAhKwM4IQsgICsDOCENIB4rAzghEiAhKwMoIQkgHisDKCEPICArAyghEyAhKwMYIRQgHisDGCEVICArAxghFiAhKwMgIRcgHisDICEYICArAyAhGSAAIAQ2AiAgACAGIAWiIB2gOQMYIAAgBiAKoiAcoDkDECAAIAYgDqIgG6A5AwggAEEBOgAAAkAgCSAMIAyiIgogCiAIIAiiIhpEAAAAAAAA8D8gCKEgDKEiDiAOoiIGoKAiCqMiBaIgDyAGIAqjIgaiIBMgGiAKoyIKoqCgIgkgCaIgBSAUoiAGIBWiIAogFqKgoCIPIA+iIAUgF6IgBiAYoiAKIBmioKAiCiAKoqCgnyIFRAAAAAAAAAAAYQRAIABBKGoiHkIANwMAIB5CADcDECAeQgA3AwgMAQsgACAJIAWjOQM4IAAgCiAFozkDMCAAIA8gBaM5AygLIAAgDDkDSCAAIAg5A0AgACAMIAuiIA4gEqIgCCANoqCgOQNYIAAgDCARoiAOIAeiIAggEKKgoDkDUAwBCyAAQgA3AyggAEF/NgIgIABCnOuBwMiH+Zv+ADcDCCAAQQA6AAAgAEKc64HAyIf5m/4ANwNQIABCgICAgICAgPi/fzcDSCAAQoCAgICAgID4v383A0AgAEKc64HAyIf5m/4ANwMYIABCnOuBwMiH+Zv+ADcDECAAQgA3AzAgAEIANwM4IABCnOuBwMiH+Zv+ADcDWAsgH0GAA2okAAusAgEGfyABIAAoAggiAiAAKAIEIgNrQcgAbU0EQCAAIAEEfyADIAFByABsQcgAa0HIAG5ByABsQcgAaiIBEEkgAWoFIAMLNgIEDwsCQCADIAAoAgAiBmsiA0HIAG0iBSABaiIEQeTxuBxJBEAgBUHIAGwCfyAEIAIgBmtByABtIgJBAXQiBSAEIAVLG0Hj8bgcIAJB8bicDkkbIgIEQCACQeTxuBxPDQMgAkHIAGwQKyEHCyAHC2ogAUHIAGxByABrQcgAbkHIAGxByABqIgQQSSIFIANBuH9tQcgAbGohASAEIAVqIQQgByACQcgAbGohByADQQBKBEAgASAGIAMQSBoLIAAgBzYCCCAAIAQ2AgQgACABNgIAIAYEQCAGEEALDwsQKgALQZYJEA0AC6A5AhN/GHwjAEHAAWsiBCQAIAEoAgQgASgCACIHayIIQQxtIQwCQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAhBDEgNACAIQQxGBEAgACgCACIDIAdBCGoiDigCAEEGdGoiBSsDACEWIAMgBygCBEEGdGoiASsDACEXIAMgBygCAEEGdGoiAysDACEYIAUrAxAhGSABKwMQIRwgAysDECEdIAUrAwghGiABKwMIIR4gAysDCCEfIAQgDigAADYAswEgBCAHKQAANwCrASAAKAIMIAJByABsaiIDIBogHiAfRJx1AIg85Dd+IB9EnHUAiDzkN35jGyIbIBsgHmQbIhsgGiAbYxs5AwggAyAZIBwgHUScdQCIPOQ3fiAdRJx1AIg85Dd+YxsiGyAbIBxkGyIbIBkgG2MbOQMQIAMgFiAXIBhEnHUAiDzkN/4gGEScdQCIPOQ3/mQbIhsgFyAbZBsiGyAWIBtkGzkDGCADQQE6ADAgAyAWIBcgGEScdQCIPOQ3fiAYRJx1AIg85Dd+YxsiGCAXIBhjGyIXIBYgF2MbOQMAIAMgGiAeIB9EnHUAiDzkN/4gH0ScdQCIPOQ3/mQbIhYgFiAeYxsiFiAWIBpjGzkDICADIBkgHCAdRJx1AIg85Df+IB1EnHUAiDzkN/5kGyIWIBYgHGMbIhYgFiAZYxs5AyggA0FAayAEKQCvATcAACADIAQpAKgBNwA5IAMgBCkAoAE3ADEMAQsgDEEDdCIFECsgBRBJIg4gBWohDyAAKAIAIQUDQCAOIANBA3RqIAUgByADQQxsaiIKKAIAQQZ0aisDACAFIAooAgRBBnRqKwMAoCAFIAooAghBBnRqKwMAoEQAAAAAAAAIQKM5AwAgA0EBaiIDIAxHDQALIA4gDyAEQaABahAiIA4gCEEYbUEDdGoiECsDACEnIAxBAXEiEUUEQCAnIA4gDEEBa0ECbUEDdGorAwCgRAAAAAAAAOA/oiEnCyAEQgA3A7ABIARCADcDqAEgBEIANwOgASAMQQEgDEEBShshDSAAKAIAIQMgASgCACEFRJx1AIg85Df+IRtEnHUAiDzkN34hIUEAIQpEnHUAiDzkN34hIkScdQCIPOQ3fiEjRJx1AIg85Df+ISREnHUAiDzkN/4hJUScdQCIPOQ3fiEmRJx1AIg85Dd+IShEnHUAiDzkN34hKUScdQCIPOQ3/iEgRJx1AIg85Df+ISpEnHUAiDzkN/4hKwNAAkAgJyADIAUgCkEMbCIHaiIFKAIAQQZ0aisDACADIAUoAgRBBnRqKwMAoCADIAUoAghBBnRqKwMAoEQAAAAAAAAIQKNkBEACQCAEKAKkASIDIAQoAqgBRwRAIAMgBSkCADcCACADIAUoAgg2AgggBCADQQxqNgKkAQwBCyADIAQoAqABIglrIghBDG0iA0EBaiIGQdaq1aoBTw0FIAYgA0EBdCILIAYgC0sbQdWq1aoBIANBqtWq1QBJGyIGBH8gBkHWqtWqAU8NByAGQQxsECsFQQALIgsgA0EMbGoiAyAFKQIANwIAIAMgBSgCCDYCCCADIAhBdG1BDGxqIQUgCyAGQQxsaiEGIANBDGohAyAIQQBKBEAgBSAJIAgQSBoLIAQgBjYCqAEgBCADNgKkASAEIAU2AqABIAlFDQAgCRBACyAAKAIAIgMgASgCACIFIAdqIgcoAghBBnRqIggrAxAiFiADIAcoAgRBBnRqIgkrAxAiFyADIAcoAgBBBnRqIgcrAxAiGCAlIBggJWQbIhkgFyAZZBsiGSAWIBlkGyElIAgrAwgiGSAJKwMIIhwgBysDCCIdICQgHSAkZBsiGiAaIBxjGyIaIBkgGmQbISQgCCsDACIaIAkrAwAiHiAHKwMAIh8gGyAbIB9jGyIbIBsgHmMbIhsgGiAbZBshGyAWIBcgGCAjIBggI2MbIhggFyAYYxsiFyAWIBdjGyEjIBkgHCAdICIgHSAiYxsiFiAWIBxkGyIWIBYgGWQbISIgGiAeIB8gISAfICFjGyIWIBYgHmQbIhYgFiAaZBshIQwBCwJAIAQoArABIgMgBCgCtAFHBEAgAyAFKQIANwIAIAMgBSgCCDYCCCAEIANBDGo2ArABDAELIAMgBCgCrAEiCWsiCEEMbSIDQQFqIgZB1qrVqgFPDQYgBiADQQF0IgsgBiALSxtB1arVqgEgA0Gq1arVAEkbIgYEfyAGQdaq1aoBTw0IIAZBDGwQKwVBAAsiCyADQQxsaiIDIAUpAgA3AgAgAyAFKAIINgIIIAMgCEF0bUEMbGohBSALIAZBDGxqIQYgA0EMaiEDIAhBAEoEQCAFIAkgCBBIGgsgBCAGNgK0ASAEIAM2ArABIAQgBTYCrAEgCUUNACAJEEALIAAoAgAiAyABKAIAIgUgB2oiBygCCEEGdGoiCCsDECIWIAMgBygCBEEGdGoiCSsDECIXIAMgBygCAEEGdGoiBysDECIYICsgGCArZBsiGSAXIBlkGyIZIBYgGWQbISsgCCsDCCIZIAkrAwgiHCAHKwMIIh0gKiAdICpkGyIaIBogHGMbIhogGSAaZBshKiAIKwMAIhogCSsDACIeIAcrAwAiHyAgIB8gIGQbIiAgHiAgZBsiICAaICBkGyEgIBYgFyAYICkgGCApYxsiGCAXIBhjGyIXIBYgF2MbISkgGSAcIB0gKCAdIChjGyIWIBYgHGQbIhYgFiAZZBshKCAaIB4gHyAmIB8gJmMbIhYgFiAeZBsiFiAWIBpkGyEmCyAKQQFqIgogDUcNAAsCfAJAIAQoAqABIAQoAqQBRg0AIAQoAqwBIAQoArABRg0AIBsgIaEiFiAkICKhIheiIBcgJSAjoSIYoiAYIBaioKAiFiAWoCAgICahIhYgKiAooSIXoiAXICsgKaEiGKIgGCAWoqCgIhYgFqCgDAELRJx1AIg85Dd+CyEsIAxBASAMQQFKGyEHIAEoAgAhCCAAKAIAIQVBACEDA0AgDiADQQN0aiAFIAggA0EMbGoiCigCAEEGdGorAwggBSAKKAIEQQZ0aisDCKAgBSAKKAIIQQZ0aisDCKBEAAAAAAAACECjOQMAIANBAWoiAyAHRw0ACyAOIA8gBEGAAWoQIiAQKwMAIScgEUUEQCAnIA4gDEEBa0ECbUEDdGorAwCgRAAAAAAAAOA/oiEnCyAEQgA3A5ABIARCADcDiAEgBEIANwOAASAMQQEgDEEBShshDSAAKAIAIQMgASgCACEFRJx1AIg85Df+IRtEnHUAiDzkN34hIUEAIQpEnHUAiDzkN34hIkScdQCIPOQ3fiEjRJx1AIg85Df+ISREnHUAiDzkN/4hJUScdQCIPOQ3fiEmRJx1AIg85Dd+IShEnHUAiDzkN34hKUScdQCIPOQ3/iEgRJx1AIg85Df+ISpEnHUAiDzkN/4hKwNAAkAgJyADIAUgCkEMbCIHaiIFKAIAQQZ0aisDCCADIAUoAgRBBnRqKwMIoCADIAUoAghBBnRqKwMIoEQAAAAAAAAIQKNkBEACQCAEKAKEASIDIAQoAogBRwRAIAMgBSkCADcCACADIAUoAgg2AgggBCADQQxqNgKEAQwBCyADIAQoAoABIglrIghBDG0iA0EBaiIGQdaq1aoBTw0JIAYgA0EBdCILIAYgC0sbQdWq1aoBIANBqtWq1QBJGyIGBH8gBkHWqtWqAU8NCyAGQQxsECsFQQALIgsgA0EMbGoiAyAFKQIANwIAIAMgBSgCCDYCCCADIAhBdG1BDGxqIQUgCyAGQQxsaiEGIANBDGohAyAIQQBKBEAgBSAJIAgQSBoLIAQgBjYCiAEgBCADNgKEASAEIAU2AoABIAlFDQAgCRBACyAAKAIAIgMgASgCACIFIAdqIgcoAghBBnRqIggrAxAiFiADIAcoAgRBBnRqIgkrAxAiFyADIAcoAgBBBnRqIgcrAxAiGCAlIBggJWQbIhkgFyAZZBsiGSAWIBlkGyElIAgrAwgiGSAJKwMIIhwgBysDCCIdICQgHSAkZBsiGiAaIBxjGyIaIBkgGmQbISQgCCsDACIaIAkrAwAiHiAHKwMAIh8gGyAbIB9jGyIbIBsgHmMbIhsgGiAbZBshGyAWIBcgGCAjIBggI2MbIhggFyAYYxsiFyAWIBdjGyEjIBkgHCAdICIgHSAiYxsiFiAWIBxkGyIWIBYgGWQbISIgGiAeIB8gISAfICFjGyIWIBYgHmQbIhYgFiAaZBshIQwBCwJAIAQoApABIgMgBCgClAFHBEAgAyAFKQIANwIAIAMgBSgCCDYCCCAEIANBDGo2ApABDAELIAMgBCgCjAEiCWsiCEEMbSIDQQFqIgZB1qrVqgFPDQogBiADQQF0IgsgBiALSxtB1arVqgEgA0Gq1arVAEkbIgYEfyAGQdaq1aoBTw0MIAZBDGwQKwVBAAsiCyADQQxsaiIDIAUpAgA3AgAgAyAFKAIINgIIIAMgCEF0bUEMbGohBSALIAZBDGxqIQYgA0EMaiEDIAhBAEoEQCAFIAkgCBBIGgsgBCAGNgKUASAEIAM2ApABIAQgBTYCjAEgCUUNACAJEEALIAAoAgAiAyABKAIAIgUgB2oiBygCCEEGdGoiCCsDECIWIAMgBygCBEEGdGoiCSsDECIXIAMgBygCAEEGdGoiBysDECIYICsgGCArZBsiGSAXIBlkGyIZIBYgGWQbISsgCCsDCCIZIAkrAwgiHCAHKwMIIh0gKiAdICpkGyIaIBogHGMbIhogGSAaZBshKiAIKwMAIhogCSsDACIeIAcrAwAiHyAgIB8gIGQbIiAgHiAgZBsiICAaICBkGyEgIBYgFyAYICkgGCApYxsiGCAXIBhjGyIXIBYgF2MbISkgGSAcIB0gKCAdIChjGyIWIBYgHGQbIhYgFiAZZBshKCAaIB4gHyAmIB8gJmMbIhYgFiAeZBsiFiAWIBpkGyEmCyAKQQFqIgogDUcNAAsCfAJAIAQoAoABIAQoAoQBRg0AIAQoAowBIAQoApABRg0AIBsgIaEiFiAkICKhIheiIBcgJSAjoSIYoiAYIBaioKAiFiAWoCAgICahIhYgKiAooSIXoiAXICsgKaEiGKIgGCAWoqCgIhYgFqCgDAELRJx1AIg85Dd+CyEtIAxBASAMQQFKGyEHIAEoAgAhCCAAKAIAIQVBACEDA0AgDiADQQN0aiAFIAggA0EMbGoiCigCAEEGdGorAxAgBSAKKAIEQQZ0aisDEKAgBSAKKAIIQQZ0aisDEKBEAAAAAAAACECjOQMAIANBAWoiAyAHRw0ACyAOIA8gBEHgAGoQIiAQKwMAIScgEUUEQCAnIA4gDEEBa0ECbUEDdGorAwCgRAAAAAAAAOA/oiEnCyAEQgA3A3AgBEIANwNoIARCADcDYCAMQQEgDEEBShshDSAAKAIAIQMgASgCACEFRJx1AIg85Df+IRtEnHUAiDzkN34hIUEAIQpEnHUAiDzkN34hIkScdQCIPOQ3fiEjRJx1AIg85Df+ISREnHUAiDzkN/4hJUScdQCIPOQ3fiEmRJx1AIg85Dd+IShEnHUAiDzkN34hKUScdQCIPOQ3/iEgRJx1AIg85Df+ISpEnHUAiDzkN/4hKwNAAkAgJyADIAUgCkEMbCIHaiIFKAIAQQZ0aisDECADIAUoAgRBBnRqKwMQoCADIAUoAghBBnRqKwMQoEQAAAAAAAAIQKNkBEACQCAEKAJkIgMgBCgCaEcEQCADIAUpAgA3AgAgAyAFKAIINgIIIAQgA0EMajYCZAwBCyADIAQoAmAiCWsiCEEMbSIDQQFqIgZB1qrVqgFPDQ0gBiADQQF0IgsgBiALSxtB1arVqgEgA0Gq1arVAEkbIgYEfyAGQdaq1aoBTw0PIAZBDGwQKwVBAAsiCyADQQxsaiIDIAUpAgA3AgAgAyAFKAIINgIIIAMgCEF0bUEMbGohBSALIAZBDGxqIQYgA0EMaiEDIAhBAEoEQCAFIAkgCBBIGgsgBCAGNgJoIAQgAzYCZCAEIAU2AmAgCUUNACAJEEALIAAoAgAiAyABKAIAIgUgB2oiBygCCEEGdGoiCCsDECIWIAMgBygCBEEGdGoiCSsDECIXIAMgBygCAEEGdGoiBysDECIYICUgGCAlZBsiGSAXIBlkGyIZIBYgGWQbISUgCCsDCCIZIAkrAwgiHCAHKwMIIh0gJCAdICRkGyIaIBogHGMbIhogGSAaZBshJCAIKwMAIhogCSsDACIeIAcrAwAiHyAbIBsgH2MbIhsgGyAeYxsiGyAaIBtkGyEbIBYgFyAYICMgGCAjYxsiGCAXIBhjGyIXIBYgF2MbISMgGSAcIB0gIiAdICJjGyIWIBYgHGQbIhYgFiAZZBshIiAaIB4gHyAhIB8gIWMbIhYgFiAeZBsiFiAWIBpkGyEhDAELAkAgBCgCcCIDIAQoAnRHBEAgAyAFKQIANwIAIAMgBSgCCDYCCCAEIANBDGo2AnAMAQsgAyAEKAJsIglrIghBDG0iA0EBaiIGQdaq1aoBTw0OIAYgA0EBdCILIAYgC0sbQdWq1aoBIANBqtWq1QBJGyIGBH8gBkHWqtWqAU8NECAGQQxsECsFQQALIgsgA0EMbGoiAyAFKQIANwIAIAMgBSgCCDYCCCADIAhBdG1BDGxqIQUgCyAGQQxsaiEGIANBDGohAyAIQQBKBEAgBSAJIAgQSBoLIAQgBjYCdCAEIAM2AnAgBCAFNgJsIAlFDQAgCRBACyAAKAIAIgMgASgCACIFIAdqIgcoAghBBnRqIggrAxAiFiADIAcoAgRBBnRqIgkrAxAiFyADIAcoAgBBBnRqIgcrAxAiGCArIBggK2QbIhkgFyAZZBsiGSAWIBlkGyErIAgrAwgiGSAJKwMIIhwgBysDCCIdICogHSAqZBsiGiAaIBxjGyIaIBkgGmQbISogCCsDACIaIAkrAwAiHiAHKwMAIh8gICAfICBkGyIgIB4gIGQbIiAgGiAgZBshICAWIBcgGCApIBggKWMbIhggFyAYYxsiFyAWIBdjGyEpIBkgHCAdICggHSAoYxsiFiAWIBxkGyIWIBYgGWQbISggGiAeIB8gJiAfICZjGyIWIBYgHmQbIhYgFiAaZBshJgsgCkEBaiIKIA1HDQALAnwCQCAEKAJgIAQoAmRGDQAgBCgCbCAEKAJwRg0AIBsgIaEiFiAkICKhIheiIBcgJSAjoSIYoiAYIBaioKAiFiAWoCAgICahIhYgKiAooSIXoiAXICsgKaEiGKIgGCAWoqCgIhYgFqCgDAELRJx1AIg85Dd+CyEmIAxBASAMQQFKGyEMIAEoAgAhCCAAKAIAIQNEnHUAiDzkN/4hG0ScdQCIPOQ3fiEhQQAhBUScdQCIPOQ3fiEiRJx1AIg85Dd+ISNEnHUAiDzkN/4hJEScdQCIPOQ3/iElA0AgAyAIIAVBDGxqIgEoAghBBnRqIgorAxAiFiADIAEoAgRBBnRqIgcrAxAiFyADIAEoAgBBBnRqIgErAxAiGCAlIBggJWQbIhkgFyAZZBsiGSAWIBlkGyElIAorAwgiGSAHKwMIIhwgASsDCCIdICQgHSAkZBsiGiAaIBxjGyIaIBkgGmQbISQgCisDACIaIAcrAwAiHiABKwMAIh8gGyAbIB9jGyIbIBsgHmMbIhsgGiAbZBshGyAWIBcgGCAjIBggI2MbIhggFyAYYxsiFyAWIBdjGyEjIBkgHCAdICIgHSAiYxsiFiAWIBxkGyIWIBYgGWQbISIgGiAeIB8gISAfICFjGyIWIBYgHmQbIhYgFiAaZBshISAFQQFqIgUgDEcNAAsCQCAAKAIQIAAoAgwiA2tByABtIgVBfU0EQCAAQQxqIgNBAhAVIAMoAgAhAwwBCyAAIAVByABsIANqQZABajYCEAsgAyACQcgAbGoiAyAFNgI0IANBADoAMCADIBs5AxggAyAjOQMQIAMgIjkDCCADICE5AwAgAyAFQQFqIhE2AjggAyAlOQMoIAMgJDkDICAmIC0gLCAsIC1kGyIWIBYgJmQbRJx1AIg85Dd+YQ0NQcgAECshAyAEKAKsASEHIAQoArABIQogBCgCoAEhASAEKAKkASEMIANBADYCECADICw5AwggAyAMIAFrIgtBDG0iEyAKIAdrIg1BdG1qIgogCkEfdSIKaiAKczYCACAEKAKMASEMIAQoApABIQggBCgCgAEhCiAEKAKEASEJIANBATYCKCADIC05AyAgAyAJIAprIgJBDG0iFCAIIAxrIgZBdG1qIgggCEEfdSIIaiAIczYCGCAEKAJsIQggBCgCcCEPIAQoAmAhCSAEKAJkIRAgA0FAa0ECNgIAIAMgJjkDOCADIBAgCWsiEkEMbSIVIA8gCGsiD0F0bWoiECAQQR91IhBqIBBzNgIwIAMgA0HIAGogBEG4AWoQFwJAAkACQAJAAkAgAygCEA4CAAECCyAEQQA2AlggBEIANwNQIAsEQCATQdaq1aoBTw0TIAQgCxArIgY2AlAgBCAGIBNBDGxqNgJYIAQgC0EASgR/IAYgASALEEggC0EMbkEMbGoFIAYLNgJUCyAAIARB0ABqIAUQFiAEKAJQIgUEQCAEIAU2AlQgBRBACyAEQQA2AkggBEIANwNAIA1BDG0hBiANBEAgBkHWqtWqAU8NFCAEIA0QKyIFNgJAIAQgBSAGQQxsajYCSCAEIA1BAEoEfyAFIAcgDRBIIA1BDG5BDGxqBSAFCzYCRAsgACAEQUBrIBEQFiAEKAJAIgVFDQMgBCAFNgJEDAILIARBADYCOCAEQgA3AzAgAgRAIBRB1qrVqgFPDRQgBCACECsiDTYCMCAEIA0gFEEMbGo2AjggBCACQQBKBH8gDSAKIAIQSCACQQxuQQxsagUgDQs2AjQLIAAgBEEwaiAFEBYgBCgCMCIFBEAgBCAFNgI0IAUQQAsgBEEANgIoIARCADcDICAGQQxtIQ0gBgRAIA1B1qrVqgFPDRUgBCAGECsiBTYCICAEIAUgDUEMbGo2AiggBCAGQQBKBH8gBSAMIAYQSCAGQQxuQQxsagUgBQs2AiQLIAAgBEEgaiAREBYgBCgCICIFRQ0CIAQgBTYCJAwBCyAEQQA2AhggBEIANwMQIBIEQCAVQdaq1aoBTw0VIAQgEhArIg02AhAgBCANIBVBDGxqNgIYIAQgEkEASgR/IA0gCSASEEggEkEMbkEMbGoFIA0LNgIUCyAAIARBEGogBRAWIAQoAhAiBQRAIAQgBTYCFCAFEEALIARBADYCCCAEQgA3AwAgD0EMbSENIA8EQCANQdaq1aoBTw0WIAQgDxArIgU2AgAgBCAFIA1BDGxqNgIIIAQgD0EASgR/IAUgCCAPEEggD0EMbkEMbGoFIAULNgIECyAAIAQgERAWIAQoAgAiBUUNASAEIAU2AgQLIAUQQAsgAxBAIAgEQCAEIAg2AnAgCBBACyAJBEAgBCAJNgJkIAkQQAsgDARAIAQgDDYCkAEgDBBACyAKBEAgBCAKNgKEASAKEEALIAcEQCAEIAc2ArABIAcQQAsgAQRAIAQgATYCpAEgARBACyAOEEALIARBwAFqJAAPCxAqAAtBlgkQDQALECoAC0GWCRANAAsQKgALQZYJEA0ACxAqAAtBlgkQDQALECoAC0GWCRANAAsQKgALQZYJEA0AC0HrCUG+CEHTAUHwCBAAAAsQKgALECoACxAqAAsQKgALECoACxAqAAuzEAINfwJ8A0AgAUEIayELIAFBEGshDCABQTBrIQ8gAUEYayEJA0ACQAJAAkACQAJAAkAgASAAayIDQRhtDgYFBQABAgMECwJAIAFBGGsiBigCACIDIAAoAgAiBUgEQCABQRBrKwMAIRAgACsDCCERDAELIAMgBUoNBSABQRBrKwMAIhAgACsDCCIRYw0AIBAgEWQNBSABQQhrKAIAIAAoAhBODQULIAAgAzYCACAGIAU2AgAgACAQOQMIIAFBEGsgETkDACAAKAIQIQMgACABQQhrIgUoAgA2AhAgBSADNgIADwsgACAAQRhqIAFBGGsQGBoPCyAAIABBGGogAEEwaiABQRhrEBkaDwsgACAAQRhqIABBMGogAEHIAGogAUEYaxAaGgwBCyADQacBTARAIAAiAiAAQRhqIABBMGoiBBAYGiAAQcgAaiIAIAEiCUcEQANAIAQhAQJAAkAgACIEKAIAIgggASgCACIASARAIAErAwghECAEKwMIIREMAQsgACAISA0BIAQrAwgiESABKwMIIhBjDQAgECARYw0BIAQoAhAgASgCEE4NAQsgBCAQOQMIIAQgADYCACAEKAIQIQUgBCABKAIQNgIQAkAgASACIgBGDQADQAJAIAEiAEEYayIBKAIAIgYgCEoEQCAAQRBrKwMAIRAMAQsgBiAISA0CIBEgAEEQaysDACIQYw0AIBAgEWMNAiAFIABBCGsoAgBODQILIAAgEDkDCCAAIAY2AgAgACAAQQhrKAIANgIQIAEgAkcNAAsgAiEACyAAIAU2AhAgACAROQMIIAAgCDYCAAsgBEEYaiIAIAlHDQALCw8LAn8gA0GpuwFPBEAgACAAIANB4ABuQRhsIgVqIAAgA0EwbkEYbGoiByAFIAdqIAkQGgwBCyAAIAAgA0H//wNxQTBuQRhsaiIHIAkQGAshCgJ/AkACQCAAKAIAIgggBygCACIDSARAIAkhBAwBCwJAIAMgCEgNACAAKwMIIhAgBysDCCIRYwRAIAkhBAwCCyAQIBFkDQAgACgCECAHKAIQTg0AIAkhBAwBCyAJIQQgDyIFIABGDQEDQAJAIAQhBiADIAUiBCgCACIFSgRAIAZBEGsrAwAhEAwBCwJAIAMgBUgNACAGQRBrKwMAIhAgBysDCCIRYw0BIBAgEWQNACAGQQhrKAIAIAcoAhBIDQELIARBGGsiBSAARw0BDAMLCyAAIAU2AgAgBCAINgIAIAArAwghESAAIBA5AwggBkEQayAROQMAIAAoAhAhAyAAIAZBCGsiBSgCADYCECAFIAM2AgAgCkEBaiEKCwJAIABBGGoiAyAETw0AA0AgBygCACEFAkADQAJAAkAgAygCACIGIAVIDQACQCAFIAZIDQAgAysDCCIQIAcrAwgiEWMNASAQIBFkDQAgAygCECAHKAIQSA0BCyAEQRhrIggoAgAiDSAFSA0DA0AgBCEOIAghBAJAIAUgDUgNACAOQRBrKwMAIhAgBysDCCIRYw0DIBAgEWQNACAOQQhrKAIAIAcoAhBIDQMLIARBGGsiCCgCACINIAVODQALDAMLIANBGGohAwwBCwsgBCEIIA4hBAsgAyAISw0BIAMgDTYCACAIIAY2AgAgAysDCCEQIAMgBEEQayIFKwMAOQMIIAUgEDkDACADKAIQIQUgAyAEQQhrIgYoAgA2AhAgBiAFNgIAIAggByADIAdGGyEHIANBGGohAyAKQQFqIQogCCEEDAALAAsCQCADIAdGDQACQCAHKAIAIgUgAygCACIGSARAIAcrAwghECADKwMIIREMAQsgBSAGSg0BIAcrAwgiECADKwMIIhFjDQAgECARZA0BIAcoAhAgAygCEE4NAQsgAyAFNgIAIAcgBjYCACADIBA5AwggByAROQMIIAMoAhAhBSADIAcoAhA2AhAgByAFNgIQIApBAWohCgsgCkUEQCAAIAMQGyEGIANBGGoiBCABEBsEQCADIQEgBkUNBgwEC0ECIAYNAhoLIAMgAGtBGG0gASADa0EYbUgEQCAAIAMgAhAXIANBGGohAAwECyADQRhqIAEgAhAXIAMhAQwECyAAQRhqIQQCQCAIIAkoAgAiBUgNAAJAIAUgCEgNACAAKwMIIhAgDCsDACIRYw0BIBAgEWQNACAAKAIQIAsoAgBIDQELIAQgCUYNAgNAAkACQCAEKAIAIgMgCEoEQCAEKwMIIRAMAQsgAyAISA0BIAArAwgiESAEKwMIIhBjDQAgECARYw0BIAAoAhAgBCgCEE4NAQsgBCAFNgIAIAkgAzYCACAEIAwrAwA5AwggDCAQOQMAIAQoAhAhAyAEIAsoAgA2AhAgCyADNgIAIARBGGohBAwCCyAJIARBGGoiBEcNAAsMAgsgBCAJRg0BIAkhBQN/AkAgACgCACIDIAQoAgAiCEgNAANAIAQhBgJAIAMgCEoNACAAKwMIIhAgBisDCCIRY0UEQCAQIBFkDQEgACgCECAGKAIQTg0BCyAGIQQMAgsgBkEYaiEEIAMgBigCGCIITg0ACwsDQCADIAUiBkEYayIFKAIAIgdIDQACQCADIAdKDQAgACsDCCIQIAZBEGsrAwAiEWMNASAQIBFkDQAgACgCECAGQQhrKAIASA0BCwsgBCAFTwR/QQQFIAQgBzYCACAFIAg2AgAgBCsDCCEQIAQgBkEQayIDKwMAOQMIIAMgEDkDACAEKAIQIQMgBCAGQQhrIgYoAgA2AhAgBiADNgIAIARBGGohBAwBCwsLIQUgBCEAIAVBBEYNASAFQQJGDQELCwsLpQUCAnwEfwJAAn8CfwJAIAEoAgAiBSAAKAIAIgdIDQACQCAFIAdKDQAgASsDCCIEIAArAwgiA2MNASADIARjDQAgASgCECAAKAIQSA0BCwJAIAUgAigCACIGSgRAIAIrAwghBCABKwMIIQMMAQtBACEHIAUgBkgNBCACKwMIIgQgASsDCCIDYw0AIAMgBGMNBCACKAIQIAEoAhBODQQLIAEgBjYCACACIAU2AgAgASAEOQMIIAIgAzkDCCABKAIQIQUgASACKAIQNgIQIAIgBTYCECABQRBqIQICQCABKAIAIgUgACgCACIGSARAIAErAwghBCAAKwMIIQMMAQtBASEHIAUgBkoNBCABKwMIIgQgACsDCCIDYw0AIAMgBGMNBCACKAIAIAAoAhBODQQLIAAgBTYCACABIAY2AgAgACAEOQMIIAEgAzkDCCAAQRBqDAELAkACQCAFIAIoAgAiBkoEQCACKwMIIQQMAQsgBSAGSARAIAErAwghAwwCCyACKwMIIgQgASsDCCIDYw0AIAMgBGMNASACKAIQIAEoAhBODQELIAAgBjYCACACIAc2AgAgACsDCCEDIAAgBDkDCCACIAM5AwggAkEQaiECIABBEGohAEEBDAILIAAgBTYCACABIAc2AgAgACsDCCEEIAAgAzkDCCABIAQ5AwggACgCECEIIAAgASgCEDYCECABIAg2AhACQCACKAIAIgUgASgCACIGSARAIAIrAwghAwwBC0EBIQcgBSAGSg0DIAIrAwgiAyAEYw0AIAMgBGQNAyACKAIQIAhODQMLIAEgBTYCACACIAY2AgAgASADOQMIIAIgBDkDCCACQRBqIQIgAUEQagshAEECCyEHIAAoAgAhASAAIAIoAgA2AgAgAiABNgIACyAHC8QDAgJ8A38gACABIAIQGCEHAkAgAygCACIGIAIoAgAiCEgEQCADKwMIIQQgAisDCCEFDAELIAYgCEoEQCAHDwsgAysDCCIEIAIrAwgiBWMNACAEIAVkBEAgBw8LIAMoAhAgAigCEEgNACAHDwsgAiAGNgIAIAMgCDYCACACIAQ5AwggAyAFOQMIIAIoAhAhBiACIAMoAhA2AhAgAyAGNgIQAkACQCACKAIAIgYgASgCACIISARAIAIrAwghBCABKwMIIQUMAQsgB0EBaiEDIAYgCEoNASACKwMIIgQgASsDCCIFYw0AIAQgBWQNASACKAIQIAEoAhBODQELIAEgBjYCACACIAg2AgAgASAEOQMIIAIgBTkDCCABKAIQIQMgASACKAIQNgIQIAIgAzYCEAJAIAEoAgAiAiAAKAIAIgZIBEAgASsDCCEEIAArAwghBQwBCyAHQQJqIQMgAiAGSg0BIAErAwgiBCAAKwMIIgVjDQAgBCAFZA0BIAEoAhAgACgCEE4NAQsgACACNgIAIAEgBjYCACAAIAQ5AwggASAFOQMIIAAoAhAhAiAAIAEoAhA2AhAgASACNgIQIAdBA2ohAwsgAwvSBAICfAN/IAAgASACIAMQGSEIAkAgBCgCACIHIAMoAgAiCUgEQCAEKwMIIQUgAysDCCEGDAELIAcgCUoEQCAIDwsgBCsDCCIFIAMrAwgiBmMNACAFIAZkBEAgCA8LIAQoAhAgAygCEEgNACAIDwsgAyAHNgIAIAQgCTYCACADIAU5AwggBCAGOQMIIAMoAhAhByADIAQoAhA2AhAgBCAHNgIQAkACQCADKAIAIgcgAigCACIJSARAIAMrAwghBSACKwMIIQYMAQsgCEEBaiEEIAcgCUoNASADKwMIIgUgAisDCCIGYw0AIAUgBmQNASADKAIQIAIoAhBODQELIAIgBzYCACADIAk2AgAgAiAFOQMIIAMgBjkDCCACKAIQIQQgAiADKAIQNgIQIAMgBDYCEAJAIAIoAgAiAyABKAIAIgdIBEAgAisDCCEFIAErAwghBgwBCyAIQQJqIQQgAyAHSg0BIAIrAwgiBSABKwMIIgZjDQAgBSAGZA0BIAIoAhAgASgCEE4NAQsgASADNgIAIAIgBzYCACABIAU5AwggAiAGOQMIIAEoAhAhAyABIAIoAhA2AhAgAiADNgIQAkAgASgCACIDIAAoAgAiAkgEQCABKwMIIQUgACsDCCEGDAELIAhBA2ohBCACIANIDQEgASsDCCIFIAArAwgiBmMNACAFIAZkDQEgASgCECAAKAIQTg0BCyAAIAM2AgAgASACNgIAIAAgBTkDCCABIAY5AwggACgCECEDIAAgASgCEDYCECABIAM2AhAgCEEEaiEECyAEC+4EAgd/AnxBASEDAkACQAJAAkACQAJAIAEgAGtBGG0OBgUFAAECAwQLAkAgAUEYayIFKAIAIgIgACgCACIGSARAIAFBEGsrAwAhCSAAKwMIIQoMAQsgAiAGSg0FIAFBEGsrAwAiCSAAKwMIIgpjDQAgCSAKZA0FIAFBCGsoAgAgACgCEE4NBQsgACACNgIAIAUgBjYCACAAIAk5AwggAUEQayAKOQMAIAAoAhAhAiAAIAFBCGsiAygCADYCECADIAI2AgBBAQ8LIAAgAEEYaiABQRhrEBgaQQEPCyAAIABBGGogAEEwaiABQRhrEBkaQQEPCyAAIABBGGogAEEwaiAAQcgAaiABQRhrEBoaQQEPCyAAIABBGGogAEEwaiIEEBgaIABByABqIgIgAUYNAAJAA0AgBCEDAkACQCACIgQoAgAiBSADKAIAIgJIBEAgAysDCCEJIAQrAwghCgwBCyACIAVIDQEgBCsDCCIKIAMrAwgiCWMNACAJIApjDQEgBCgCECADKAIQTg0BCyAEIAk5AwggBCACNgIAIAQoAhAhByAEIAMoAhA2AhAgACECAkAgACADRg0AA0ACQCADIgJBGGsiAygCACIGIAVKBEAgAkEQaysDACEJDAELIAUgBkoNAiAKIAJBEGsrAwAiCWMNACAJIApjDQIgByACQQhrKAIATg0CCyACIAk5AwggAiAGNgIAIAIgAkEIaygCADYCECAAIANHDQALIAAhAgsgAiAHNgIQIAIgCjkDCCACIAU2AgAgCEEBaiIIQQhGDQILIARBGGoiAiABRw0AC0EBDwsgBEEYaiABRiEDCyADC7kYAxR/BHwBfiMAQTBrIgckAAJAAkACQCAAvSIaQiCIpyIDQf////8HcSIFQfrUvYAETQRAIANB//8/cUH7wyRGDQEgBUH8souABE0EQCAaQgBZBEAgASAARAAAQFT7Ifm/oCIARDFjYhphtNC9oCIWOQMAIAEgACAWoUQxY2IaYbTQvaA5AwhBASEDDAULIAEgAEQAAEBU+yH5P6AiAEQxY2IaYbTQPaAiFjkDACABIAAgFqFEMWNiGmG00D2gOQMIQX8hAwwECyAaQgBZBEAgASAARAAAQFT7IQnAoCIARDFjYhphtOC9oCIWOQMAIAEgACAWoUQxY2IaYbTgvaA5AwhBAiEDDAQLIAEgAEQAAEBU+yEJQKAiAEQxY2IaYbTgPaAiFjkDACABIAAgFqFEMWNiGmG04D2gOQMIQX4hAwwDCyAFQbuM8YAETQRAIAVBvPvXgARNBEAgBUH8ssuABEYNAiAaQgBZBEAgASAARAAAMH982RLAoCIARMqUk6eRDum9oCIWOQMAIAEgACAWoUTKlJOnkQ7pvaA5AwhBAyEDDAULIAEgAEQAADB/fNkSQKAiAETKlJOnkQ7pPaAiFjkDACABIAAgFqFEypSTp5EO6T2gOQMIQX0hAwwECyAFQfvD5IAERg0BIBpCAFkEQCABIABEAABAVPshGcCgIgBEMWNiGmG08L2gIhY5AwAgASAAIBahRDFjYhphtPC9oDkDCEEEIQMMBAsgASAARAAAQFT7IRlAoCIARDFjYhphtPA9oCIWOQMAIAEgACAWoUQxY2IaYbTwPaA5AwhBfCEDDAMLIAVB+sPkiQRLDQELIAAgAESDyMltMF/kP6JEAAAAAAAAOEOgRAAAAAAAADjDoCIWRAAAQFT7Ifm/oqAiFyAWRDFjYhphtNA9oiIYoSIZRBgtRFT7Iem/YyECAn8gFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLIQMCQCACBEAgA0EBayEDIBZEAAAAAAAA8L+gIhZEMWNiGmG00D2iIRggACAWRAAAQFT7Ifm/oqAhFwwBCyAZRBgtRFT7Iek/ZEUNACADQQFqIQMgFkQAAAAAAADwP6AiFkQxY2IaYbTQPaIhGCAAIBZEAABAVPsh+b+ioCEXCyABIBcgGKEiADkDAAJAIAVBFHYiAiAAvUI0iKdB/w9xa0ERSA0AIAEgFyAWRAAAYBphtNA9oiIAoSIZIBZEc3ADLooZozuiIBcgGaEgAKGhIhihIgA5AwAgAiAAvUI0iKdB/w9xa0EySARAIBkhFwwBCyABIBkgFkQAAAAuihmjO6IiAKEiFyAWRMFJICWag3s5oiAZIBehIAChoSIYoSIAOQMACyABIBcgAKEgGKE5AwgMAQsgBUGAgMD/B08EQCABIAAgAKEiADkDACABIAA5AwhBACEDDAELIBpC/////////weDQoCAgICAgICwwQCEvyEAQQAhA0EBIQIDQCAHQRBqIANBA3RqAn8gAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLtyIWOQMAIAAgFqFEAAAAAAAAcEGiIQBBASEDIAJBAXEhBEEAIQIgBA0ACyAHIAA5AyACQCAARAAAAAAAAAAAYgRAQQIhAwwBC0EBIQIDQCACIgNBAWshAiAHQRBqIANBA3RqKwMARAAAAAAAAAAAYQ0ACwsgB0EQaiEPIwBBsARrIgYkACAFQRR2QZYIayICIAJBA2tBGG0iBEEAIARBAEobIhFBaGxqIQhBxAwoAgAiCSADQQFqIgVBAWsiC2pBAE4EQCAFIAlqIQMgESALayECQQAhBANAIAZBwAJqIARBA3RqIAJBAEgEfEQAAAAAAAAAAAUgAkECdEHQDGooAgC3CzkDACACQQFqIQIgBEEBaiIEIANHDQALCyAIQRhrIQwgCUEAIAlBAEobIQpBACEDA0BEAAAAAAAAAAAhACAFQQBKBEAgAyALaiEEQQAhAgNAIA8gAkEDdGorAwAgBkHAAmogBCACa0EDdGorAwCiIACgIQAgAkEBaiICIAVHDQALCyAGIANBA3RqIAA5AwAgAyAKRiECIANBAWohAyACRQ0AC0EvIAhrIRNBMCAIayESIAhBGWshFCAJIQMCQANAIAYgA0EDdGorAwAhAEEAIQIgAyEEIANBAEwiEEUEQANAIAZB4ANqIAJBAnRqAn8CfyAARAAAAAAAAHA+oiIXmUQAAAAAAADgQWMEQCAXqgwBC0GAgICAeAu3IhdEAAAAAAAAcMGiIACgIgCZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4CzYCACAGIARBAWsiBEEDdGorAwAgF6AhACACQQFqIgIgA0cNAAsLAn8gACAMEEIiACAARAAAAAAAAMA/opxEAAAAAAAAIMCioCIAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAshDSAAIA23oSEAAkACQAJAAn8gDEEATCIVRQRAIANBAnQgBmpB3ANqIgIgAigCACICIAIgEnUiAiASdGsiBDYCACACIA1qIQ0gBCATdQwBCyAMDQEgA0ECdCAGaigC3ANBF3ULIg5BAEwNAgwBC0ECIQ4gAEQAAAAAAADgP2YNAEEAIQ4MAQtBACECQQAhCyAQRQRAA0AgBkHgA2ogAkECdGoiECgCACEEQf///wchCgJ/AkAgCw0AQYCAgAghCiAEDQBBAAwBCyAQIAogBGs2AgBBAQshCyACQQFqIgIgA0cNAAsLAkAgFQ0AQf///wMhAgJAAkAgFA4CAQACC0H///8BIQILIANBAnQgBmpB3ANqIgQgBCgCACACcTYCAAsgDUEBaiENIA5BAkcNAEQAAAAAAADwPyAAoSEAQQIhDiALRQ0AIABEAAAAAAAA8D8gDBBCoSEACyAARAAAAAAAAAAAYQRAQQAhBAJAIAMiAiAJTA0AA0AgBkHgA2ogAkEBayICQQJ0aigCACAEciEEIAIgCUoNAAsgBEUNACAMIQgDQCAIQRhrIQggBkHgA2ogA0EBayIDQQJ0aigCAEUNAAsMAwtBASECA0AgAiIEQQFqIQIgBkHgA2ogCSAEa0ECdGooAgBFDQALIAMgBGohCgNAIAZBwAJqIAMgBWoiBEEDdGogA0EBaiIDIBFqQQJ0QdAMaigCALc5AwBBACECRAAAAAAAAAAAIQAgBUEASgRAA0AgDyACQQN0aisDACAGQcACaiAEIAJrQQN0aisDAKIgAKAhACACQQFqIgIgBUcNAAsLIAYgA0EDdGogADkDACADIApIDQALIAohAwwBCwsCQCAAQRggCGsQQiIARAAAAAAAAHBBZgRAIAZB4ANqIANBAnRqAn8CfyAARAAAAAAAAHA+oiIXmUQAAAAAAADgQWMEQCAXqgwBC0GAgICAeAsiArdEAAAAAAAAcMGiIACgIgCZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4CzYCACADQQFqIQMMAQsCfyAAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAshAiAMIQgLIAZB4ANqIANBAnRqIAI2AgALRAAAAAAAAPA/IAgQQiEAAkAgA0EASA0AIAMhBQNAIAYgBSICQQN0aiAAIAZB4ANqIAJBAnRqKAIAt6I5AwAgAkEBayEFIABEAAAAAAAAcD6iIQAgAg0ACyADQQBIDQAgAyECA0AgAyACIgRrIQ9EAAAAAAAAAAAhAEEAIQIDQAJAIAJBA3RBoCJqKwMAIAYgAiAEakEDdGorAwCiIACgIQAgAiAJTg0AIAIgD0khBSACQQFqIQIgBQ0BCwsgBkGgAWogD0EDdGogADkDACAEQQFrIQIgBEEASg0ACwtEAAAAAAAAAAAhACADQQBOBEAgAyEFA0AgBSICQQFrIQUgACAGQaABaiACQQN0aisDAKAhACACDQALCyAHIACaIAAgDhs5AwAgBisDoAEgAKEhAEEBIQIgA0EASgRAA0AgACAGQaABaiACQQN0aisDAKAhACACIANHIQUgAkEBaiECIAUNAAsLIAcgAJogACAOGzkDCCAGQbAEaiQAIA1BB3EhAyAHKwMAIQAgGkIAUwRAIAEgAJo5AwAgASAHKwMImjkDCEEAIANrIQMMAQsgASAAOQMAIAEgBysDCDkDCAsgB0EwaiQAIAMLwQEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABAeDAELIAAgAKEgAkGAgMD/B08NABoCQAJAAkACQCAAIAEQHEEDcQ4DAAECAwsgASsDACABKwMIEB4MAwsgASsDACABKwMIQQEQIJoMAgsgASsDACABKwMIEB6aDAELIAErAwAgASsDCEEBECALIQAgAUEQaiQAIAALkgEBA3xEAAAAAAAA8D8gACAAoiICRAAAAAAAAOA/oiIDoSIERAAAAAAAAPA/IAShIAOhIAIgAiACIAJEkBXLGaAB+j6iRHdRwRZswVa/oKJETFVVVVVVpT+goiACIAKiIgMgA6IgAiACRNQ4iL7p+qi9okTEsbS9nu4hPqCiRK1SnIBPfpK+oKKgoiAAIAGioaCgC8UBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAECAhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCwJAAkACQAJAIAAgARAcQQNxDgMAAQIDCyABKwMAIAErAwhBARAgIQAMAwsgASsDACABKwMIEB4hAAwCCyABKwMAIAErAwhBARAgmiEADAELIAErAwAgASsDCBAemiEACyABQRBqJAAgAAuZAQEDfCAAIACiIgMgAyADoqIgA0R81c9aOtnlPaJE65wriublWr6goiADIANEff6xV+Mdxz6iRNVhwRmgASq/oKJEpvgQERERgT+goCEFIAMgAKIhBCACRQRAIAQgAyAFokRJVVVVVVXFv6CiIACgDwsgACADIAFEAAAAAAAA4D+iIAUgBKKhoiABoSAERElVVVVVVcU/oqChC40BACAAIAAgACAAIABECff9DeE9Aj+iRIiyAXXg70k/oKJEO49otSiCpL+gokRVRIgOVcHJP6CiRH1v6wMS1tS/oKJEVVVVVVVVxT+gIACiIAAgACAAIABEgpIuscW4sz+iRFkBjRtsBua/oKJEyIpZnOUqAECgokRLLYocJzoDwKCiRAAAAAAAAPA/oKMLpAYBBn8DQCABQQhrIQgDQCAAIQMDQAJAAn8CQAJAAkACQAJAAkACQCABIANrIgBBA3UiBA4GCAgABAECAwsgAUEIayIAIAMQI0UNByADIAAQJA8LIAMgA0EIaiADQRBqIAFBCGsQJRoPCyADIANBCGogA0EQaiADQRhqIAFBCGsQJhoPCyAAQfcBTARAIAEhBiMAQRBrIgQkACADIANBCGogA0EQaiICECcaIANBGGohAQNAIAEgBkcEQCABIAIQIwRAIAQgASsDADkDCCABIQADQAJAIAAgAiIAKwMAOQMAIAAgA0YEQCADIQAMAQsgBEEIaiAAQQhrIgIQIw0BCwsgACAEQQhqKwMAOQMACyABIQIgAUEIaiEBDAELCyAEQRBqJAAPCyADIARBAm1BA3RqIQUCfyAAQbk+TwRAIAMgAyAEQQRtQQN0IgBqIAUgACAFaiAIECYMAQsgAyAFIAgQJwshByAIIQAgAyAFECNFBEADQCAAQQhrIgAgA0YEQCADQQhqIQQgAyAIECMNBQNAIAQgCEYNCCADIAQQIwRAIAQgCBAkIARBCGohBAwHBSAEQQhqIQQMAQsACwALIAAgBRAjRQ0ACyADIAAQJCAHQQFqIQcLIANBCGoiBiAATw0BA0AgBiIEQQhqIQYgBCAFECMNAANAIABBCGsiACAFECNFDQALIAAgBEkEQCAEIQYMAwUgBCAAECQgACAFIAQgBUYbIQUgB0EBaiEHDAELAAsACyADIANBCGogAUEIaxAnGgwDCwJAIAUgBkYNACAFIAYQI0UNACAGIAUQJCAHQQFqIQcLIAdFBEAgAyAGECghBCAGQQhqIgAgARAoBEAgBiEBIAMhACAERQ0HDAQLQQIgBA0CGgsgBiADayABIAZrSARAIAMgBiACECIgBkEIaiEADAULIAZBCGogASACECIgBiEBIAMhAAwFCyAEIAgiBUYNAQN/IAQiAEEIaiEEIAMgABAjRQ0AA0AgAyAFQQhrIgUQIw0ACyAAIAVPBH9BBAUgACAFECQMAQsLCyEFIAAhAyAFQQJrDgMCAAEACwsLCwsNACAAKwMAIAErAwBjCzUBAX8jAEEQayICJAAgAiAAKwMAOQMIIAAgASsDADkDACABIAJBCGorAwA5AwAgAkEQaiQAC1EBAX8gACABIAIQJyEEIAMgAhAjBH8gAiADECQgAiABECNFBEAgBEEBag8LIAEgAhAkIAEgABAjRQRAIARBAmoPCyAAIAEQJCAEQQNqBSAECwtpAQF/IAAgASACIAMQJSEFIAQgAxAjBH8gAyAEECQgAyACECNFBEAgBUEBag8LIAIgAxAkIAIgARAjRQRAIAVBAmoPCyABIAIQJCABIAAQI0UEQCAFQQNqDwsgACABECQgBUEEagUgBQsLagECfyABIAAQIyEEIAIgARAjIQMCfwJAIARFBEBBACADRQ0CGiABIAIQJEEBIAEgABAjRQ0CGiAAIAEQJAwBCyADBEAgACACECRBAQ8LIAAgARAkQQEgAiABECNFDQEaIAEgAhAkC0ECCwuxAgEGfyMAQRBrIgQkAEEBIQYCQAJAAkACQAJAAkAgASAAa0EDdQ4GBQUAAQIDBAsgAUEIayICIAAQI0UNBCAAIAIQJAwECyAAIABBCGogAUEIaxAnGgwDCyAAIABBCGogAEEQaiABQQhrECUaDAILIAAgAEEIaiAAQRBqIABBGGogAUEIaxAmGgwBCyAAIABBCGogAEEQaiIFECcaIABBGGohAwNAIAEgA0YNAQJAIAMgBRAjBEAgBCADKwMAOQMIIAMhAgNAAkAgAiAFIgIrAwA5AwAgACACRgRAIAAhAgwBCyAEQQhqIAJBCGsiBRAjDQELCyACIARBCGorAwA5AwAgB0EBaiIHQQhGDQELIAMhBSADQQhqIQMMAQsLIANBCGogAUYhBgsgBEEQaiQAIAYLBAAgAAsIAEGYCBANAAszAQF/IABBASAAGyEBAkADQCABED8iAA0BQcjtACgCACIABEAgABEIAAwBCwsQAwALIAALBgAgABBACwUAQeEICzkBAn8gAEGUIzYCACAAQQRqKAIAQQxrIgJBCGoiASABKAIAQQFrIgE2AgAgAUEASARAIAIQQAsgAAsIACAAEC4QQAsKACAAQQRqKAIACwsAIAAQLhogABBACwMAAQt0AQF/IAJFBEAgACgCBCABKAIERg8LIAAgAUYEQEEBDwsgASgCBCICLQAAIQECQCAAKAIEIgMtAAAiAEUNACAAIAFHDQADQCACLQABIQEgAy0AASIARQ0BIAJBAWohAiADQQFqIQMgACABRg0ACwsgACABRguwAwEFfyMAQUBqIgQkAAJ/QQEgACABQQAQMw0AGkEAIAFFDQAaIwBBQGoiAyQAIAEoAgAiB0EEaygCACEFIAdBCGsoAgAhByADQQA2AhQgA0GsJDYCECADIAE2AgwgA0HcJDYCCCADQRhqQScQSRogASAHaiEBAkAgBUHcJEEAEDMEQCADQQE2AjggBSADQQhqIAEgAUEBQQAgBSgCACgCFBEHACABQQAgAygCIEEBRhshBgwBCyAFIANBCGogAUEBQQAgBSgCACgCGBEGAAJAAkAgAygCLA4CAAECCyADKAIcQQAgAygCKEEBRhtBACADKAIkQQFGG0EAIAMoAjBBAUYbIQYMAQsgAygCIEEBRwRAIAMoAjANASADKAIkQQFHDQEgAygCKEEBRw0BCyADKAIYIQYLIANBQGskAEEAIAYiAUUNABogBEEIakEEckE0EEkaIARBATYCOCAEQX82AhQgBCAANgIQIAQgATYCCCABIARBCGogAigCAEEBIAEoAgAoAhwRAwAgBCgCICIAQQFGBEAgAiAEKAIYNgIACyAAQQFGCyEAIARBQGskACAAC10BAX8gACgCECIDRQRAIABBATYCJCAAIAI2AhggACABNgIQDwsCQCABIANGBEAgACgCGEECRw0BIAAgAjYCGA8LIABBAToANiAAQQI2AhggACAAKAIkQQFqNgIkCwsYACAAIAEoAghBABAzBEAgASACIAMQNQsLMQAgACABKAIIQQAQMwRAIAEgAiADEDUPCyAAKAIIIgAgASACIAMgACgCACgCHBEDAAuaAQAgAEEBOgA1AkAgACgCBCACRw0AIABBAToANAJAIAAoAhAiAkUEQCAAQQE2AiQgACADNgIYIAAgATYCECAAKAIwQQFHDQIgA0EBRg0BDAILIAEgAkYEQCAAKAIYIgJBAkYEQCAAIAM2AhggAyECCyAAKAIwQQFHDQIgAkEBRg0BDAILIAAgACgCJEEBajYCJAsgAEEBOgA2CwsgAAJAIAAoAgQgAUcNACAAKAIcQQFGDQAgACACNgIcCwvyAQAgACABKAIIIAQQMwRAIAEgAiADEDkPCwJAIAAgASgCACAEEDMEQAJAIAIgASgCEEcEQCABKAIUIAJHDQELIANBAUcNAiABQQE2AiAPCyABIAM2AiACQCABKAIsQQRGDQAgAUEAOwE0IAAoAggiACABIAIgAkEBIAQgACgCACgCFBEHACABLQA1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QfBoIAFB8GhLG0GSD2ohAQsgACABQf8Haq1CNIa/ogseAQF/IwBBEGsiAiABmiABIAAbOQMIIAIrAwggAaILDwAgAEQAAAAAAAAAcBBDCw8AIABEAAAAAAAAABAQQwvdCgMJfAN+Bn8jAEEQayIRJAACQAJAIAG9IgxCNIinIhJB/w9xIhNBvghrIg5B/35LIAC9IgtCNIinIg9B/w9rQYJwT3ENACAMQgGGIg1CAX1C/////////29aBEBEAAAAAAAA8D8hAiANUA0CIAtCgICAgICAgPg/UQ0CIA1CgYCAgICAgHBUIAtCAYYiC0KAgICAgICAcFhxRQRAIAAgAaAhAgwDCyALQoCAgICAgIDw/wBRDQJEAAAAAAAAAAAgASABoiAMQj+IUCALQoCAgICAgIDw/wBURhshAgwCCyALQgGGQgF9Qv////////9vWgRAIAAgAKIhAiALQgBTBEAgApogAiAMEEdBAUYbIQILIAxCAFkNAiARRAAAAAAAAPA/IAKjOQMIIBErAwghAgwCCyALQgBTBEAgDBBHIhBFBEAgACAAoSIAIACjIQIMAwsgD0H/D3EhDyAQQQFGQRJ0IRAgC0L///////////8AgyELCyAOQf9+TQRARAAAAAAAAPA/IQIgC0KAgICAgICA+D9RDQIgE0G9B00EQCABIAGaIAtCgICAgICAgPg/VhtEAAAAAAAA8D+gIQIMAwsgEkGAEEkgC0KBgICAgICA+D9URwRAQQAQRCECDAMLQQAQRSECDAILIA8NACAARAAAAAAAADBDor1C////////////AINCgICAgICAgKADfSELCwJAIAxCgICAQIO/IgYgCyALQoCAgIDQqqXzP30iDEKAgICAgICAeIN9IgtCgICAgAh8QoCAgIBwg78iAiAMQi2Ip0H/AHFBBXQiDkGoN2orAwAiBKJEAAAAAAAA8L+gIgAgAEHwNisDACIDoiIFoiIHIAxCNIentyIIQeA2KwMAoiAOQbg3aisDAKAiCSAAIAQgC78gAqGiIgqgIgCgIgKgIgQgByACIAShoCAKIAUgAyAAoiIDoKIgCEHoNisDAKIgDkHAN2orAwCgIAAgCSACoaCgoKAgACAAIAOiIgKiIAIgAiAAQaA3KwMAokGYNysDAKCiIABBkDcrAwCiQYg3KwMAoKCiIABBgDcrAwCiQfg2KwMAoKCioCIFoCICvUKAgIBAg78iA6IiAL0iC0I0iKdB/w9xIg5ByQdrQT9JDQAgDkHIB00EQCAARAAAAAAAAPA/oCIAmiAAIBAbIQIMAgsgDkGJCEkhD0EAIQ4gDw0AIAtCAFMEQCAQEEUhAgwCCyAQEEQhAgwBCyABIAahIAOiIAUgBCACoaAgAiADoaAgAaKgIABB8CUrAwCiQfglKwMAIgGgIgIgAaEiAUGIJisDAKIgAUGAJisDAKIgAKCgoCIAIACiIgEgAaIgAEGoJisDAKJBoCYrAwCgoiABIABBmCYrAwCiQZAmKwMAoKIgAr0iC6dBBHRB8A9xIg9B4CZqKwMAIACgoKAhACAPQegmaikDACALIBCtfEIthnwhDCAORQRAIwBBEGsiDiQAAnwgC6dBAE4EQCAMQoCAgICAgICIP32/IgEgAKIgAaBEAAAAAAAAAH+iDAELIAxCgICAgICAgPA/fCIMvyIBIACiIgMgAaAiAJlEAAAAAAAA8D9jBHwgDkKAgICAgICACDcDCCAOIA4rAwhEAAAAAAAAEACiOQMIIAxCgICAgICAgICAf4O/IABEAAAAAAAA8L9EAAAAAAAA8D8gAEQAAAAAAAAAAGMbIgKgIgQgAyABIAChoCAAIAIgBKGgoKAgAqEiACAARAAAAAAAAAAAYRsFIAALRAAAAAAAABAAogshACAOQRBqJAAgACECDAELIAy/IgEgAKIgAaAhAgsgEUEQaiQAIAILTgIBfwF+An9BACAAQjSIp0H/D3EiAUH/B0kNABpBAiABQbMISw0AGkEAQgFBswggAWuthiICQgF9IACDQgBSDQAaQQJBASAAIAKDUBsLC4EEAQN/IAJBgARPBEAgACABIAIQBRogAA8LIAAgAmohAwJAIAAgAXNBA3FFBEACQCAAQQNxRQRAIAAhAgwBCyACRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAkEDcUUNASACIANJDQALCwJAIANBfHEiBEHAAEkNACACIARBQGoiBUsNAANAIAIgASgCADYCACACIAEoAgQ2AgQgAiABKAIINgIIIAIgASgCDDYCDCACIAEoAhA2AhAgAiABKAIUNgIUIAIgASgCGDYCGCACIAEoAhw2AhwgAiABKAIgNgIgIAIgASgCJDYCJCACIAEoAig2AiggAiABKAIsNgIsIAIgASgCMDYCMCACIAEoAjQ2AjQgAiABKAI4NgI4IAIgASgCPDYCPCABQUBrIQEgAkFAayICIAVNDQALCyACIARPDQEDQCACIAEoAgA2AgAgAUEEaiEBIAJBBGoiAiAESQ0ACwwBCyADQQRJBEAgACECDAELIAAgA0EEayIESwRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAiABLQABOgABIAIgAS0AAjoAAiACIAEtAAM6AAMgAUEEaiEBIAJBBGoiAiAETQ0ACwsgAiADSQRAA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0cNAAsLIAAL2AIBAn8CQCABRQ0AIABBADoAACAAIAFqIgJBAWtBADoAACABQQNJDQAgAEEAOgACIABBADoAASACQQNrQQA6AAAgAkECa0EAOgAAIAFBB0kNACAAQQA6AAMgAkEEa0EAOgAAIAFBCUkNACAAQQAgAGtBA3EiA2oiAkEANgIAIAIgASADa0F8cSIDaiIBQQRrQQA2AgAgA0EJSQ0AIAJBADYCCCACQQA2AgQgAUEIa0EANgIAIAFBDGtBADYCACADQRlJDQAgAkEANgIYIAJBADYCFCACQQA2AhAgAkEANgIMIAFBEGtBADYCACABQRRrQQA2AgAgAUEYa0EANgIAIAFBHGtBADYCACADIAJBBHFBGHIiA2siAUEgSQ0AIAIgA2ohAgNAIAJCADcDGCACQgA3AxAgAkIANwMIIAJCADcDACACQSBqIQIgAUEgayIBQR9LDQALCyAAC+gCAQJ/AkAgACABRg0AIAEgACACaiIDa0EAIAJBAXRrTQRAIAAgASACEEgPCyAAIAFzQQNxIQQCQAJAIAAgAUkEQCAEBEAgACEDDAMLIABBA3FFBEAgACEDDAILIAAhAwNAIAJFDQQgAyABLQAAOgAAIAFBAWohASACQQFrIQIgA0EBaiIDQQNxDQALDAELAkAgBA0AIANBA3EEQANAIAJFDQUgACACQQFrIgJqIgMgASACai0AADoAACADQQNxDQALCyACQQNNDQADQCAAIAJBBGsiAmogASACaigCADYCACACQQNLDQALCyACRQ0CA0AgACACQQFrIgJqIAEgAmotAAA6AAAgAg0ACwwCCyACQQNNDQADQCADIAEoAgA2AgAg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";

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aHRyYWNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvcmVuZGVyZXIvUmVuZGVyZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IzLnRzIiwiLi4vLi4vc3JjL21hdGgvVmVjdG9yNC50cyIsIi4uLy4uL3NyYy9tYXRoL01hdHJpeDQudHMiLCIuLi8uLi9zcmMvbWF0aC9RdWF0ZXJuaW9uLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvVHJhbnNmb3JtLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTW9kZWwudHMiLCIuLi8uLi9zcmMvY29yZS9tb2RlbC9HTFRGTG9hZGVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvbWF0ZXJpYWwvTWF0ZXJpYWwudHMiLCIuLi8uLi9zcmMvY29yZS9tYXRlcmlhbC9HbGFzcy50cyIsIi4uLy4uL3NyYy9jb3JlL21hdGVyaWFsL0RpZmZ1c2UudHMiLCIuLi8uLi9zcmMvY29yZS9jYW1lcmEvQ2FtZXJhLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9UZXh0dXJlLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtQnVmZmVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTW9kdWxlLmpzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTWFuYWdlci50cyIsIi4uLy4uL3NyYy9tYXRoL1ZlY3RvcjIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsIi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1yZXN0LXBhcmFtcyAqL1xuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItc3ByZWFkICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1yZXR1cm4tYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBjb25zaXN0ZW50LXJldHVybiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tbXVsdGktYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb250aW51ZSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcGx1c3BsdXMgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLW5lc3RlZC10ZXJuYXJ5ICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItZGVzdHJ1Y3R1cmluZyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuLyogZXNsaW50LWRpc2FibGUgdmFycy1vbi10b3AgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1zaGFkb3cgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4vKiBlc2xpbnQtZGlzYWJsZSBnbG9iYWwtcmVxdWlyZSAqL1xuLyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5pbXBvcnQgbWFpbldhc20gZnJvbSAnLi4vLi4vLi4vYnVpbGQvd2FzbS9tYWluLndhc20nO1xuXG5leHBvcnQgLyoqXG4gKiBXYXNtIG1vZHVsZSBnZW5lcmF0b3IuIFRoaXMgY29kZSBpcyBiYXNlZCBvbiBFbXNjcmlwdGVuIGRlZmF1bHQganMgdGVtcGxhdGUuXG4gKlxuICogQHJldHVybiB7Kn0gXG4gKi9cbmNvbnN0IFdhc21Nb2R1bGVHZW5lcmF0b3IgPSAod29ya2VyR2xvYmFsU2NvcGUgPSBudWxsKSA9PiB7XG4gICAgY29uc3QgTW9kdWxlID0ge307XG4gICAgbGV0IGFyZ3VtZW50c18gPSBbXTtcbiAgICBsZXQgdGhpc1Byb2dyYW0gPSBcIi4vdGhpcy5wcm9ncmFtXCI7XG4gICAgbGV0IHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgIHRocm93IHRvVGhyb3dcbiAgICB9O1xuICAgIGNvbnN0IEVOVklST05NRU5UX0lTX1dFQiA9IHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCI7XG4gICAgY29uc3QgRU5WSVJPTk1FTlRfSVNfV09SS0VSID0gdHlwZW9mIGltcG9ydFNjcmlwdHMgPT09IFwiZnVuY3Rpb25cIjtcbiAgICBjb25zdCBFTlZJUk9OTUVOVF9JU19OT0RFID0gdHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMubm9kZSA9PT0gXCJzdHJpbmdcIjtcbiAgICBsZXQgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcblxuICAgIGZ1bmN0aW9uIGxvY2F0ZUZpbGUocGF0aCkge1xuICAgICAgICBpZiAoTW9kdWxlLmxvY2F0ZUZpbGUpIHtcbiAgICAgICAgICAgIHJldHVybiBNb2R1bGUubG9jYXRlRmlsZShwYXRoLCBzY3JpcHREaXJlY3RvcnkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNjcmlwdERpcmVjdG9yeSArIHBhdGhcbiAgICB9XG4gICAgbGV0IHJlYWRfOyBsZXQgcmVhZEFzeW5jOyBsZXQgcmVhZEJpbmFyeTtcblxuICAgIGZ1bmN0aW9uIGxvZ0V4Y2VwdGlvbk9uRXhpdChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXhpdFN0YXR1cykgcmV0dXJuO1xuICAgICAgICBjb25zdCB0b0xvZyA9IGU7XG4gICAgICAgIGVycihgZXhpdGluZyBkdWUgdG8gZXhjZXB0aW9uOiAkeyAgdG9Mb2d9YClcbiAgICB9XG4gICAgbGV0IG5vZGVGUztcbiAgICBsZXQgbm9kZVBhdGg7XG4gICAgaWYgKEVOVklST05NRU5UX0lTX05PREUpIHtcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gYCR7cmVxdWlyZShcInBhdGhcIikuZGlybmFtZShzY3JpcHREaXJlY3RvcnkpICB9L2BcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IGAke19fZGlybmFtZSAgfS9gXG4gICAgICAgIH1cbiAgICAgICAgcmVhZF8gPSBmdW5jdGlvbiBzaGVsbF9yZWFkKGZpbGVuYW1lLCBiaW5hcnkpIHtcbiAgICAgICAgICAgIGlmICghbm9kZUZTKSBub2RlRlMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICBpZiAoIW5vZGVQYXRoKSBub2RlUGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xuICAgICAgICAgICAgZmlsZW5hbWUgPSBub2RlUGF0aC5ub3JtYWxpemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIG5vZGVGUy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUsIGJpbmFyeSA/IG51bGwgOiBcInV0ZjhcIilcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZEJpbmFyeSA9IGZ1bmN0aW9uIHJlYWRCaW5hcnkoZmlsZW5hbWUpIHtcbiAgICAgICAgICAgIGxldCByZXQgPSByZWFkXyhmaWxlbmFtZSwgdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoIXJldC5idWZmZXIpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBuZXcgVWludDhBcnJheShyZXQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhc3NlcnQocmV0LmJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRBc3luYyA9IGZ1bmN0aW9uIHJlYWRBc3luYyhmaWxlbmFtZSwgb25sb2FkLCBvbmVycm9yKSB7XG4gICAgICAgICAgICBpZiAoIW5vZGVGUykgbm9kZUZTID0gcmVxdWlyZShcImZzXCIpO1xuICAgICAgICAgICAgaWYgKCFub2RlUGF0aCkgbm9kZVBhdGggPSByZXF1aXJlKFwicGF0aFwiKTtcbiAgICAgICAgICAgIGZpbGVuYW1lID0gbm9kZVBhdGgubm9ybWFsaXplKGZpbGVuYW1lKTtcbiAgICAgICAgICAgIG5vZGVGUy5yZWFkRmlsZShmaWxlbmFtZSwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIG9uZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIG9ubG9hZChkYXRhLmJ1ZmZlcilcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH07XG4gICAgICAgIGlmIChwcm9jZXNzLmFyZ3YubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhpc1Byb2dyYW0gPSBwcm9jZXNzLmFyZ3ZbMV0ucmVwbGFjZSgvXFxcXC9nLCBcIi9cIilcbiAgICAgICAgfVxuICAgICAgICBhcmd1bWVudHNfID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBNb2R1bGVcbiAgICAgICAgfVxuICAgICAgICBwcm9jZXNzLm9uKFwidW5jYXVnaHRFeGNlcHRpb25cIiwgKGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoIShleCBpbnN0YW5jZW9mIEV4aXRTdGF0dXMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHByb2Nlc3Mub24oXCJ1bmhhbmRsZWRSZWplY3Rpb25cIiwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhyb3cgcmVhc29uXG4gICAgICAgIH0pO1xuICAgICAgICBxdWl0XyA9IGZ1bmN0aW9uKHN0YXR1cywgdG9UaHJvdykge1xuICAgICAgICAgICAgaWYgKGtlZXBSdW50aW1lQWxpdmUoKSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3MuZXhpdENvZGUgPSBzdGF0dXM7XG4gICAgICAgICAgICAgICAgdGhyb3cgdG9UaHJvd1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nRXhjZXB0aW9uT25FeGl0KHRvVGhyb3cpO1xuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KHN0YXR1cylcbiAgICAgICAgfTtcbiAgICAgICAgTW9kdWxlLmluc3BlY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBcIltFbXNjcmlwdGVuIE1vZHVsZSBvYmplY3RdXCJcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoRU5WSVJPTk1FTlRfSVNfV0VCIHx8IEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1nbG9iYWxzXG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBzZWxmLmxvY2F0aW9uLmhyZWZcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIgJiYgZG9jdW1lbnQuY3VycmVudFNjcmlwdCkge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdC5zcmNcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0RGlyZWN0b3J5LmluZGV4T2YoXCJibG9iOlwiKSAhPT0gMCkge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gc2NyaXB0RGlyZWN0b3J5LnN1YnN0cigwLCBzY3JpcHREaXJlY3RvcnkucmVwbGFjZSgvWz8jXS4qLywgXCJcIikubGFzdEluZGV4T2YoXCIvXCIpICsgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IFwiXCJcbiAgICAgICAgfVxuICAgICAgICByZWFkXyA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0O1xuICAgICAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG4gICAgICAgICAgICB4aHIuc2VuZChudWxsKTtcbiAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgIH07XG4gICAgICAgIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgIHJlYWRCaW5hcnkgPSBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICAgICAgICAgICAgICB4aHIuc2VuZChudWxsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoeGhyLnJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlYWRBc3luYyA9IGZ1bmN0aW9uKHVybCwgb25sb2FkLCBvbmVycm9yKSB7XG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICAgICAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwIHx8IHhoci5zdGF0dXMgPT09IDAgJiYgeGhyLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ubG9hZCh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb25lcnJvcigpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgeGhyLm9uZXJyb3IgPSBvbmVycm9yO1xuICAgICAgICAgICAgeGhyLnNlbmQobnVsbClcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBvdXQgPSBNb2R1bGUucHJpbnQgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBjb25zdCBlcnIgPSBNb2R1bGUucHJpbnRFcnIgfHwgY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5cbiAgICBpZiAoTW9kdWxlLmFyZ3VtZW50cykgYXJndW1lbnRzXyA9IE1vZHVsZS5hcmd1bWVudHM7XG4gICAgaWYgKE1vZHVsZS50aGlzUHJvZ3JhbSkgdGhpc1Byb2dyYW0gPSBNb2R1bGUudGhpc1Byb2dyYW07XG4gICAgaWYgKE1vZHVsZS5xdWl0KSBxdWl0XyA9IE1vZHVsZS5xdWl0O1xuXG4gICAgZnVuY3Rpb24gYmFzZTY0VG9BcnJheUJ1ZmZlcihiYXNlNjQpIHtcbiAgICAgICAgbGV0IGJpbmFyeV9zdHJpbmcgPSAnJztcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX05PREUpIHtcbiAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSBCdWZmZXIuZnJvbShiYXNlNjQsICdiYXNlNjQnKS50b1N0cmluZygnYXNjaWknKTtcbiAgICAgICAgfSBlbHNlIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgICAgICBiaW5hcnlfc3RyaW5nID0gd29ya2VyR2xvYmFsU2NvcGUuYXRvYihiYXNlNjQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBiaW5hcnlfc3RyaW5nID0gd2luZG93LmF0b2IoYmFzZTY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgY29uc3QgbGVuID0gYmluYXJ5X3N0cmluZy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBieXRlc1tpXSA9IGJpbmFyeV9zdHJpbmcuY2hhckNvZGVBdChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXMuYnVmZmVyO1xuICAgIH1cblxuICAgIGNvbnN0IHdhc21CaW5hcnkgPSBiYXNlNjRUb0FycmF5QnVmZmVyKG1haW5XYXNtKTtcbiAgICBjb25zdCBub0V4aXRSdW50aW1lID0gTW9kdWxlLm5vRXhpdFJ1bnRpbWUgfHwgdHJ1ZTtcbiAgICBpZiAodHlwZW9mIFdlYkFzc2VtYmx5ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIGFib3J0KFwibm8gbmF0aXZlIHdhc20gc3VwcG9ydCBkZXRlY3RlZFwiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldFZhbHVlKHB0ciwgdmFsdWUsIHR5cGUpIHtcbiAgICAgICAgdHlwZSA9IHR5cGUgfHwgXCJpOFwiO1xuICAgICAgICBpZiAodHlwZS5jaGFyQXQodHlwZS5sZW5ndGggLSAxKSA9PT0gXCIqXCIpIHR5cGUgPSBcImkzMlwiO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpMVwiOlxuICAgICAgICAgICAgICAgIEhFQVA4W3B0ciA+PiAwXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImk4XCI6XG4gICAgICAgICAgICAgICAgSEVBUDhbcHRyID4+IDBdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaTE2XCI6XG4gICAgICAgICAgICAgICAgSEVBUDE2W3B0ciA+PiAxXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImkzMlwiOlxuICAgICAgICAgICAgICAgIEhFQVAzMltwdHIgPj4gMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJpNjRcIjpcbiAgICAgICAgICAgICAgICB0ZW1wSTY0ID0gW1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA+Pj4gMCxcbiAgICAgICAgICAgICAgICAgICAgKHRlbXBEb3VibGUgPSB2YWx1ZSwgK01hdGguYWJzKHRlbXBEb3VibGUpID49IDEgPyB0ZW1wRG91YmxlID4gMCA/IChNYXRoLm1pbigrTWF0aC5mbG9vcih0ZW1wRG91YmxlIC8gNDI5NDk2NzI5NiksIDQyOTQ5NjcyOTUpIHwgMCkgPj4+IDAgOiB+fitNYXRoLmNlaWwoKHRlbXBEb3VibGUgLSArKH5+dGVtcERvdWJsZSA+Pj4gMCkpIC8gNDI5NDk2NzI5NikgPj4+IDAgOiAwKV07XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciA+PiAyXSA9IHRlbXBJNjRbMF07XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciArIDQgPj4gMl0gPSB0ZW1wSTY0WzFdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICAgICAgICAgICAgSEVBUEYzMltwdHIgPj4gMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgICAgICAgICAgICBIRUFQRjY0W3B0ciA+PiAzXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBhYm9ydChgaW52YWxpZCB0eXBlIGZvciBzZXRWYWx1ZTogJHsgIHR5cGV9YClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFZhbHVlKHB0ciwgdHlwZSkge1xuICAgICAgICB0eXBlID0gdHlwZSB8fCBcImk4XCI7XG4gICAgICAgIGlmICh0eXBlLmNoYXJBdCh0eXBlLmxlbmd0aCAtIDEpID09PSBcIipcIikgdHlwZSA9IFwiaTMyXCI7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImkxXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3B0ciA+PiAwXTtcbiAgICAgICAgICAgIGNhc2UgXCJpOFwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBIRUFQOFtwdHIgPj4gMF07XG4gICAgICAgICAgICBjYXNlIFwiaTE2XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAxNltwdHIgPj4gMV07XG4gICAgICAgICAgICBjYXNlIFwiaTMyXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiaTY0XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUEYzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiZG91YmxlXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcihIRUFQRjY0W3B0ciA+PiAzXSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFib3J0KGBpbnZhbGlkIHR5cGUgZm9yIGdldFZhbHVlOiAkeyAgdHlwZX1gKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIGxldCB3YXNtTWVtb3J5O1xuICAgIGxldCBBQk9SVCA9IGZhbHNlO1xuICAgIGxldCBFWElUU1RBVFVTO1xuXG4gICAgZnVuY3Rpb24gYXNzZXJ0KGNvbmRpdGlvbiwgdGV4dCkge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgICAgYWJvcnQoYEFzc2VydGlvbiBmYWlsZWQ6ICR7ICB0ZXh0fWApXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRDRnVuYyhpZGVudCkge1xuICAgICAgICBjb25zdCBmdW5jID0gTW9kdWxlW2BfJHsgIGlkZW50fWBdO1xuICAgICAgICBhc3NlcnQoZnVuYywgYENhbm5vdCBjYWxsIHVua25vd24gZnVuY3Rpb24gJHsgIGlkZW50ICB9LCBtYWtlIHN1cmUgaXQgaXMgZXhwb3J0ZWRgKTtcbiAgICAgICAgcmV0dXJuIGZ1bmNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjY2FsbChpZGVudCwgcmV0dXJuVHlwZSwgYXJnVHlwZXMsIGFyZ3MpIHtcbiAgICAgICAgY29uc3QgdG9DID0ge1xuICAgICAgICAgICAgXCJzdHJpbmdcIjogZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldCA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciAhPT0gbnVsbCAmJiBzdHIgIT09IHVuZGVmaW5lZCAmJiBzdHIgIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuID0gKHN0ci5sZW5ndGggPDwgMikgKyAxO1xuICAgICAgICAgICAgICAgICAgICByZXQgPSBzdGFja0FsbG9jKGxlbik7XG4gICAgICAgICAgICAgICAgICAgIHN0cmluZ1RvVVRGOChzdHIsIHJldCwgbGVuKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCJhcnJheVwiOiBmdW5jdGlvbihhcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXQgPSBzdGFja0FsbG9jKGFyci5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIHdyaXRlQXJyYXlUb01lbW9yeShhcnIsIHJldCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNvbnZlcnRSZXR1cm5WYWx1ZShyZXQpIHtcbiAgICAgICAgICAgIGlmIChyZXR1cm5UeXBlID09PSBcInN0cmluZ1wiKSByZXR1cm4gVVRGOFRvU3RyaW5nKHJldCk7XG4gICAgICAgICAgICBpZiAocmV0dXJuVHlwZSA9PT0gXCJib29sZWFuXCIpIHJldHVybiBCb29sZWFuKHJldCk7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVuYyA9IGdldENGdW5jKGlkZW50KTtcbiAgICAgICAgY29uc3QgY0FyZ3MgPSBbXTtcbiAgICAgICAgbGV0IHN0YWNrID0gMDtcbiAgICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlciA9IHRvQ1thcmdUeXBlc1tpXV07XG4gICAgICAgICAgICAgICAgaWYgKGNvbnZlcnRlcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhY2sgPT09IDApIHN0YWNrID0gc3RhY2tTYXZlKCk7XG4gICAgICAgICAgICAgICAgICAgIGNBcmdzW2ldID0gY29udmVydGVyKGFyZ3NbaV0pXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY0FyZ3NbaV0gPSBhcmdzW2ldXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCByZXQgPSBmdW5jKC4uLmNBcmdzKTtcblxuICAgICAgICBmdW5jdGlvbiBvbkRvbmUocmV0KSB7XG4gICAgICAgICAgICBpZiAoc3RhY2sgIT09IDApIHN0YWNrUmVzdG9yZShzdGFjayk7XG4gICAgICAgICAgICByZXR1cm4gY29udmVydFJldHVyblZhbHVlKHJldClcbiAgICAgICAgfVxuICAgICAgICByZXQgPSBvbkRvbmUocmV0KTtcbiAgICAgICAgcmV0dXJuIHJldFxuICAgIH1cbiAgICBjb25zdCBVVEY4RGVjb2RlciA9IHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gXCJ1bmRlZmluZWRcIiA/IG5ldyBUZXh0RGVjb2RlcihcInV0ZjhcIikgOiB1bmRlZmluZWQ7XG5cbiAgICBmdW5jdGlvbiBVVEY4QXJyYXlUb1N0cmluZyhoZWFwLCBpZHgsIG1heEJ5dGVzVG9SZWFkKSB7XG4gICAgICAgIGNvbnN0IGVuZElkeCA9IGlkeCArIG1heEJ5dGVzVG9SZWFkO1xuICAgICAgICBsZXQgZW5kUHRyID0gaWR4O1xuICAgICAgICB3aGlsZSAoaGVhcFtlbmRQdHJdICYmICEoZW5kUHRyID49IGVuZElkeCkpICsrZW5kUHRyO1xuICAgICAgICBpZiAoZW5kUHRyIC0gaWR4ID4gMTYgJiYgaGVhcC5zdWJhcnJheSAmJiBVVEY4RGVjb2Rlcikge1xuICAgICAgICAgICAgcmV0dXJuIFVURjhEZWNvZGVyLmRlY29kZShoZWFwLnN1YmFycmF5KGlkeCwgZW5kUHRyKSlcbiAgICAgICAgfSBcbiAgICAgICAgICAgIGxldCBzdHIgPSBcIlwiO1xuICAgICAgICAgICAgd2hpbGUgKGlkeCA8IGVuZFB0cikge1xuICAgICAgICAgICAgICAgIGxldCB1MCA9IGhlYXBbaWR4KytdO1xuICAgICAgICAgICAgICAgIGlmICghKHUwICYgMTI4KSkge1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1MCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHUxID0gaGVhcFtpZHgrK10gJiA2MztcbiAgICAgICAgICAgICAgICBpZiAoKHUwICYgMjI0KSA9PT0gMTkyKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCh1MCAmIDMxKSA8PCA2IHwgdTEpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCB1MiA9IGhlYXBbaWR4KytdICYgNjM7XG4gICAgICAgICAgICAgICAgaWYgKCh1MCAmIDI0MCkgPT09IDIyNCkge1xuICAgICAgICAgICAgICAgICAgICB1MCA9ICh1MCAmIDE1KSA8PCAxMiB8IHUxIDw8IDYgfCB1MlxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHUwID0gKHUwICYgNykgPDwgMTggfCB1MSA8PCAxMiB8IHUyIDw8IDYgfCBoZWFwW2lkeCsrXSAmIDYzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh1MCA8IDY1NTM2KSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHUwKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoID0gdTAgLSA2NTUzNjtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoNTUyOTYgfCBjaCA+PiAxMCwgNTYzMjAgfCBjaCAmIDEwMjMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHN0clxuICAgIH1cblxuICAgIGZ1bmN0aW9uIFVURjhUb1N0cmluZyhwdHIsIG1heEJ5dGVzVG9SZWFkKSB7XG4gICAgICAgIHJldHVybiBwdHIgPyBVVEY4QXJyYXlUb1N0cmluZyhIRUFQVTgsIHB0ciwgbWF4Qnl0ZXNUb1JlYWQpIDogXCJcIlxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmluZ1RvVVRGOEFycmF5KHN0ciwgaGVhcCwgb3V0SWR4LCBtYXhCeXRlc1RvV3JpdGUpIHtcbiAgICAgICAgaWYgKCEobWF4Qnl0ZXNUb1dyaXRlID4gMCkpIHJldHVybiAwO1xuICAgICAgICBjb25zdCBzdGFydElkeCA9IG91dElkeDtcbiAgICAgICAgY29uc3QgZW5kSWR4ID0gb3V0SWR4ICsgbWF4Qnl0ZXNUb1dyaXRlIC0gMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCB1ID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAodSA+PSA1NTI5NiAmJiB1IDw9IDU3MzQzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdTEgPSBzdHIuY2hhckNvZGVBdCgrK2kpO1xuICAgICAgICAgICAgICAgIHUgPSA2NTUzNiArICgodSAmIDEwMjMpIDw8IDEwKSB8IHUxICYgMTAyM1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHUgPD0gMTI3KSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dElkeCA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gdVxuICAgICAgICAgICAgfSBlbHNlIGlmICh1IDw9IDIwNDcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ICsgMSA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTkyIHwgdSA+PiA2O1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSAmIDYzXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHUgPD0gNjU1MzUpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ICsgMiA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMjI0IHwgdSA+PiAxMjtcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDEyOCB8IHUgPj4gNiAmIDYzO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSAmIDYzXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAzID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAyNDAgfCB1ID4+IDE4O1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiAxMiAmIDYzO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiA2ICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBoZWFwW291dElkeF0gPSAwO1xuICAgICAgICByZXR1cm4gb3V0SWR4IC0gc3RhcnRJZHhcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJpbmdUb1VURjgoc3RyLCBvdXRQdHIsIG1heEJ5dGVzVG9Xcml0ZSkge1xuICAgICAgICByZXR1cm4gc3RyaW5nVG9VVEY4QXJyYXkoc3RyLCBIRUFQVTgsIG91dFB0ciwgbWF4Qnl0ZXNUb1dyaXRlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxlbmd0aEJ5dGVzVVRGOChzdHIpIHtcbiAgICAgICAgbGV0IGxlbiA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBsZXQgdSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgaWYgKHUgPj0gNTUyOTYgJiYgdSA8PSA1NzM0MykgdSA9IDY1NTM2ICsgKCh1ICYgMTAyMykgPDwgMTApIHwgc3RyLmNoYXJDb2RlQXQoKytpKSAmIDEwMjM7XG4gICAgICAgICAgICBpZiAodSA8PSAxMjcpICsrbGVuO1xuICAgICAgICAgICAgZWxzZSBpZiAodSA8PSAyMDQ3KSBsZW4gKz0gMjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHUgPD0gNjU1MzUpIGxlbiArPSAzO1xuICAgICAgICAgICAgZWxzZSBsZW4gKz0gNFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsZW5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxvY2F0ZVVURjhPblN0YWNrKHN0cikge1xuICAgICAgICBjb25zdCBzaXplID0gbGVuZ3RoQnl0ZXNVVEY4KHN0cikgKyAxO1xuICAgICAgICBjb25zdCByZXQgPSBzdGFja0FsbG9jKHNpemUpO1xuICAgICAgICBzdHJpbmdUb1VURjhBcnJheShzdHIsIEhFQVA4LCByZXQsIHNpemUpO1xuICAgICAgICByZXR1cm4gcmV0XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd3JpdGVBcnJheVRvTWVtb3J5KGFycmF5LCBidWZmZXIpIHtcbiAgICAgICAgSEVBUDguc2V0KGFycmF5LCBidWZmZXIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxpZ25VcCh4LCBtdWx0aXBsZSkge1xuICAgICAgICBpZiAoeCAlIG11bHRpcGxlID4gMCkge1xuICAgICAgICAgICAgeCArPSBtdWx0aXBsZSAtIHggJSBtdWx0aXBsZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4XG4gICAgfVxuICAgIGxldCBidWZmZXI7IGxldCBIRUFQODsgbGV0IEhFQVBVODsgbGV0IEhFQVAxNjsgbGV0IEhFQVBVMTY7IGxldCBIRUFQMzI7IGxldCBIRUFQVTMyOyBsZXQgSEVBUEYzMjsgbGV0IEhFQVBGNjQ7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyhidWYpIHtcbiAgICAgICAgYnVmZmVyID0gYnVmO1xuICAgICAgICBNb2R1bGUuSEVBUDggPSBIRUFQOCA9IG5ldyBJbnQ4QXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVAxNiA9IEhFQVAxNiA9IG5ldyBJbnQxNkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQMzIgPSBIRUFQMzIgPSBuZXcgSW50MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUFU4ID0gSEVBUFU4ID0gbmV3IFVpbnQ4QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICBNb2R1bGUuSEVBUFUxNiA9IEhFQVBVMTYgPSBuZXcgVWludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICBNb2R1bGUuSEVBUFUzMiA9IEhFQVBVMzIgPSBuZXcgVWludDMyQXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVBGMzIgPSBIRUFQRjMyID0gbmV3IEZsb2F0MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUEY2NCA9IEhFQVBGNjQgPSBuZXcgRmxvYXQ2NEFycmF5KGJ1ZilcbiAgICB9XG4gICAgbGV0IHdhc21UYWJsZTtcbiAgICBjb25zdCBfX0FUUFJFUlVOX18gPSBbXTtcbiAgICBjb25zdCBfX0FUSU5JVF9fID0gW107XG4gICAgY29uc3QgX19BVE1BSU5fXyA9IFtdO1xuICAgIGNvbnN0IF9fQVRQT1NUUlVOX18gPSBbXTtcbiAgICBjb25zdCBydW50aW1lS2VlcGFsaXZlQ291bnRlciA9IDA7XG5cbiAgICBmdW5jdGlvbiBrZWVwUnVudGltZUFsaXZlKCkge1xuICAgICAgICByZXR1cm4gbm9FeGl0UnVudGltZSB8fCBydW50aW1lS2VlcGFsaXZlQ291bnRlciA+IDBcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVSdW4oKSB7XG4gICAgICAgIGlmIChNb2R1bGUucHJlUnVuKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIE1vZHVsZS5wcmVSdW4gPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnByZVJ1biA9IFtNb2R1bGUucHJlUnVuXTtcbiAgICAgICAgICAgIHdoaWxlIChNb2R1bGUucHJlUnVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFkZE9uUHJlUnVuKE1vZHVsZS5wcmVSdW4uc2hpZnQoKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYWxsUnVudGltZUNhbGxiYWNrcyhfX0FUUFJFUlVOX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdFJ1bnRpbWUoKSB7XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRJTklUX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJlTWFpbigpIHtcbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVE1BSU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGl0UnVudGltZSgpIHtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwb3N0UnVuKCkge1xuICAgICAgICBpZiAoTW9kdWxlLnBvc3RSdW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnBvc3RSdW4gPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnBvc3RSdW4gPSBbTW9kdWxlLnBvc3RSdW5dO1xuICAgICAgICAgICAgd2hpbGUgKE1vZHVsZS5wb3N0UnVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFkZE9uUG9zdFJ1bihNb2R1bGUucG9zdFJ1bi5zaGlmdCgpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRQT1NUUlVOX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25QcmVSdW4oY2IpIHtcbiAgICAgICAgX19BVFBSRVJVTl9fLnVuc2hpZnQoY2IpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25Jbml0KGNiKSB7XG4gICAgICAgIF9fQVRJTklUX18udW5zaGlmdChjYilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPblBvc3RSdW4oY2IpIHtcbiAgICAgICAgX19BVFBPU1RSVU5fXy51bnNoaWZ0KGNiKVxuICAgIH1cbiAgICBsZXQgcnVuRGVwZW5kZW5jaWVzID0gMDtcbiAgICBsZXQgcnVuRGVwZW5kZW5jeVdhdGNoZXIgPSBudWxsO1xuICAgIGxldCBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBudWxsO1xuXG4gICAgZnVuY3Rpb24gYWRkUnVuRGVwZW5kZW5jeSgpIHtcbiAgICAgICAgcnVuRGVwZW5kZW5jaWVzKys7XG4gICAgICAgIGlmIChNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgTW9kdWxlLm1vbml0b3JSdW5EZXBlbmRlbmNpZXMocnVuRGVwZW5kZW5jaWVzKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlUnVuRGVwZW5kZW5jeSgpIHtcbiAgICAgICAgcnVuRGVwZW5kZW5jaWVzLS07XG4gICAgICAgIGlmIChNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgTW9kdWxlLm1vbml0b3JSdW5EZXBlbmRlbmNpZXMocnVuRGVwZW5kZW5jaWVzKVxuICAgICAgICB9XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPT09IDApIHtcbiAgICAgICAgICAgIGlmIChydW5EZXBlbmRlbmN5V2F0Y2hlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwocnVuRGVwZW5kZW5jeVdhdGNoZXIpO1xuICAgICAgICAgICAgICAgIHJ1bkRlcGVuZGVuY3lXYXRjaGVyID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRlcGVuZGVuY2llc0Z1bGZpbGxlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gZGVwZW5kZW5jaWVzRnVsZmlsbGVkO1xuICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIE1vZHVsZS5wcmVsb2FkZWRJbWFnZXMgPSB7fTtcbiAgICBNb2R1bGUucHJlbG9hZGVkQXVkaW9zID0ge307XG5cbiAgICBmdW5jdGlvbiBhYm9ydCh3aGF0KSB7XG4gICAgICAgIGlmIChNb2R1bGUub25BYm9ydCkge1xuICAgICAgICAgICAgTW9kdWxlLm9uQWJvcnQod2hhdClcbiAgICAgICAgfVxuICAgICAgICB3aGF0ID0gYEFib3J0ZWQoJHsgIHdoYXQgIH0pYDtcbiAgICAgICAgZXJyKHdoYXQpO1xuICAgICAgICBBQk9SVCA9IHRydWU7XG4gICAgICAgIEVYSVRTVEFUVVMgPSAxO1xuICAgICAgICB3aGF0ICs9IFwiLiBCdWlsZCB3aXRoIC1zIEFTU0VSVElPTlM9MSBmb3IgbW9yZSBpbmZvLlwiO1xuICAgICAgICBjb25zdCBlID0gbmV3IFdlYkFzc2VtYmx5LlJ1bnRpbWVFcnJvcih3aGF0KTtcbiAgICAgICAgdGhyb3cgZVxuICAgIH1cbiAgICBjb25zdCBkYXRhVVJJUHJlZml4ID0gXCJkYXRhOmFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbTtiYXNlNjQsXCI7XG5cbiAgICBmdW5jdGlvbiBpc0RhdGFVUkkoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lLnN0YXJ0c1dpdGgoZGF0YVVSSVByZWZpeClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0ZpbGVVUkkoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lLnN0YXJ0c1dpdGgoXCJmaWxlOi8vXCIpXG4gICAgfVxuICAgIGxldCB3YXNtQmluYXJ5RmlsZTtcbiAgICB3YXNtQmluYXJ5RmlsZSA9IG1haW5XYXNtO1xuICAgIGlmICghaXNEYXRhVVJJKHdhc21CaW5hcnlGaWxlKSkge1xuICAgICAgICB3YXNtQmluYXJ5RmlsZSA9IGxvY2F0ZUZpbGUod2FzbUJpbmFyeUZpbGUpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QmluYXJ5KGZpbGUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChmaWxlID09PSB3YXNtQmluYXJ5RmlsZSAmJiB3YXNtQmluYXJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHdhc21CaW5hcnkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVhZEJpbmFyeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWFkQmluYXJ5KGZpbGUpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImJvdGggYXN5bmMgYW5kIHN5bmMgZmV0Y2hpbmcgb2YgdGhlIHdhc20gZmFpbGVkXCIpO1xuICAgICAgICAgICAgXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgYWJvcnQoZXJyKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCaW5hcnlQcm9taXNlKCkge1xuICAgICAgICBpZiAoIXdhc21CaW5hcnkgJiYgKEVOVklST05NRU5UX0lTX1dFQiB8fCBFTlZJUk9OTUVOVF9JU19XT1JLRVIpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZldGNoID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzRmlsZVVSSSh3YXNtQmluYXJ5RmlsZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2god2FzbUJpbmFyeUZpbGUsIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIlxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGxvYWQgd2FzbSBiaW5hcnkgZmlsZSBhdCAnJHsgIHdhc21CaW5hcnlGaWxlICB9J2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5hcnJheUJ1ZmZlcigpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gZ2V0QmluYXJ5KHdhc21CaW5hcnlGaWxlKSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgaWYgKHJlYWRBc3luYykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZEFzeW5jKHdhc21CaW5hcnlGaWxlLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIHJlamVjdClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiBnZXRCaW5hcnkod2FzbUJpbmFyeUZpbGUpKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVdhc20oKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICBcImVudlwiOiBhc21MaWJyYXJ5QXJnLFxuICAgICAgICAgICAgXCJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxXCI6IGFzbUxpYnJhcnlBcmdcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiByZWNlaXZlSW5zdGFuY2UoaW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHtleHBvcnRzfSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgTW9kdWxlLmFzbSA9IGV4cG9ydHM7XG4gICAgICAgICAgICB3YXNtTWVtb3J5ID0gTW9kdWxlLmFzbS5tZW1vcnk7XG4gICAgICAgICAgICB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyh3YXNtTWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgICAgICB3YXNtVGFibGUgPSBNb2R1bGUuYXNtLl9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGU7XG4gICAgICAgICAgICBhZGRPbkluaXQoTW9kdWxlLmFzbS5fX3dhc21fY2FsbF9jdG9ycyk7XG4gICAgICAgICAgICByZW1vdmVSdW5EZXBlbmRlbmN5KFwid2FzbS1pbnN0YW50aWF0ZVwiKVxuICAgICAgICB9XG4gICAgICAgIGFkZFJ1bkRlcGVuZGVuY3koXCJ3YXNtLWluc3RhbnRpYXRlXCIpO1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KHJlc3VsdCkge1xuICAgICAgICAgICAgcmVjZWl2ZUluc3RhbmNlKHJlc3VsdC5pbnN0YW5jZSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluc3RhbnRpYXRlQXJyYXlCdWZmZXIocmVjZWl2ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRCaW5hcnlQcm9taXNlKCkudGhlbigoYmluYXJ5KSA9PiBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShiaW5hcnksIGluZm8pKS50aGVuKChpbnN0YW5jZSkgPT4gaW5zdGFuY2UpLnRoZW4ocmVjZWl2ZXIsIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICBlcnIoYGZhaWxlZCB0byBhc3luY2hyb25vdXNseSBwcmVwYXJlIHdhc206ICR7ICByZWFzb259YCk7XG4gICAgICAgICAgICAgICAgYWJvcnQocmVhc29uKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluc3RhbnRpYXRlQXN5bmMoKSB7XG4gICAgICAgICAgICBpZiAoIXdhc21CaW5hcnkgJiYgdHlwZW9mIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzRGF0YVVSSSh3YXNtQmluYXJ5RmlsZSkgJiYgIWlzRmlsZVVSSSh3YXNtQmluYXJ5RmlsZSkgJiYgdHlwZW9mIGZldGNoID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2god2FzbUJpbmFyeUZpbGUsIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIlxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKHJlc3BvbnNlLCBpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC50aGVuKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0LCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoYHdhc20gc3RyZWFtaW5nIGNvbXBpbGUgZmFpbGVkOiAkeyAgcmVhc29ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyKFwiZmFsbGluZyBiYWNrIHRvIEFycmF5QnVmZmVyIGluc3RhbnRpYXRpb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdClcbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIGlmIChNb2R1bGUuaW5zdGFudGlhdGVXYXNtKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cG9ydHMgPSBNb2R1bGUuaW5zdGFudGlhdGVXYXNtKGluZm8sIHJlY2VpdmVJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cG9ydHNcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBlcnIoYE1vZHVsZS5pbnN0YW50aWF0ZVdhc20gY2FsbGJhY2sgZmFpbGVkIHdpdGggZXJyb3I6ICR7ICBlfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGluc3RhbnRpYXRlQXN5bmMoKTtcbiAgICAgICAgcmV0dXJuIHt9XG4gICAgfVxuICAgIGxldCB0ZW1wRG91YmxlO1xuICAgIGxldCB0ZW1wSTY0O1xuXG4gICAgZnVuY3Rpb24gY2FsbFJ1bnRpbWVDYWxsYmFja3MoY2FsbGJhY2tzKSB7XG4gICAgICAgIHdoaWxlIChjYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBjYWxsYmFja3Muc2hpZnQoKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKE1vZHVsZSk7XG4gICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHtmdW5jfSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmFyZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFdhc21UYWJsZUVudHJ5KGZ1bmMpKClcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBnZXRXYXNtVGFibGVFbnRyeShmdW5jKShjYWxsYmFjay5hcmcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmdW5jKGNhbGxiYWNrLmFyZyA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGNhbGxiYWNrLmFyZylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHdhc21UYWJsZU1pcnJvciA9IFtdO1xuXG4gICAgZnVuY3Rpb24gZ2V0V2FzbVRhYmxlRW50cnkoZnVuY1B0cikge1xuICAgICAgICBsZXQgZnVuYyA9IHdhc21UYWJsZU1pcnJvcltmdW5jUHRyXTtcbiAgICAgICAgaWYgKCFmdW5jKSB7XG4gICAgICAgICAgICBpZiAoZnVuY1B0ciA+PSB3YXNtVGFibGVNaXJyb3IubGVuZ3RoKSB3YXNtVGFibGVNaXJyb3IubGVuZ3RoID0gZnVuY1B0ciArIDE7XG4gICAgICAgICAgICB3YXNtVGFibGVNaXJyb3JbZnVuY1B0cl0gPSBmdW5jID0gd2FzbVRhYmxlLmdldChmdW5jUHRyKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlRXhjZXB0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFeGl0U3RhdHVzIHx8IGUgPT09IFwidW53aW5kXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBFWElUU1RBVFVTXG4gICAgICAgIH1cbiAgICAgICAgcXVpdF8oMSwgZSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19hc3NlcnRfZmFpbChjb25kaXRpb24sIGZpbGVuYW1lLCBsaW5lLCBmdW5jKSB7XG4gICAgICAgIGFib3J0KGBBc3NlcnRpb24gZmFpbGVkOiAkeyAgVVRGOFRvU3RyaW5nKGNvbmRpdGlvbikgIH0sIGF0OiAkeyAgW2ZpbGVuYW1lID8gVVRGOFRvU3RyaW5nKGZpbGVuYW1lKSA6IFwidW5rbm93biBmaWxlbmFtZVwiLCBsaW5lLCBmdW5jID8gVVRGOFRvU3RyaW5nKGZ1bmMpIDogXCJ1bmtub3duIGZ1bmN0aW9uXCJdfWApXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbihzaXplKSB7XG4gICAgICAgIHJldHVybiBfbWFsbG9jKHNpemUgKyAxNikgKyAxNlxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hdGV4aXQoKSB7fVxuXG4gICAgZnVuY3Rpb24gX19fY3hhX2F0ZXhpdChhMCwgYTEpIHtcbiAgICAgICAgcmV0dXJuIF9hdGV4aXQoYTAsIGExKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIEV4Y2VwdGlvbkluZm8oZXhjUHRyKSB7XG4gICAgICAgIHRoaXMuZXhjUHRyID0gZXhjUHRyO1xuICAgICAgICB0aGlzLnB0ciA9IGV4Y1B0ciAtIDE2O1xuICAgICAgICB0aGlzLnNldF90eXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyICsgNCA+PiAyXSA9IHR5cGVcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfdHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVAzMlt0aGlzLnB0ciArIDQgPj4gMl1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uKGRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciArIDggPj4gMl0gPSBkZXN0cnVjdG9yXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X2Rlc3RydWN0b3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBIRUFQMzJbdGhpcy5wdHIgKyA4ID4+IDJdXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0X3JlZmNvdW50ID0gZnVuY3Rpb24ocmVmY291bnQpIHtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciA+PiAyXSA9IHJlZmNvdW50XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0X2NhdWdodCA9IGZ1bmN0aW9uKGNhdWdodCkge1xuICAgICAgICAgICAgY2F1Z2h0ID0gY2F1Z2h0ID8gMSA6IDA7XG4gICAgICAgICAgICBIRUFQOFt0aGlzLnB0ciArIDEyID4+IDBdID0gY2F1Z2h0XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X2NhdWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3RoaXMucHRyICsgMTIgPj4gMF0gIT09IDBcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfcmV0aHJvd24gPSBmdW5jdGlvbihyZXRocm93bikge1xuICAgICAgICAgICAgcmV0aHJvd24gPSByZXRocm93biA/IDEgOiAwO1xuICAgICAgICAgICAgSEVBUDhbdGhpcy5wdHIgKyAxMyA+PiAwXSA9IHJldGhyb3duXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X3JldGhyb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDhbdGhpcy5wdHIgKyAxMyA+PiAwXSAhPT0gMFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmluaXQgPSBmdW5jdGlvbih0eXBlLCBkZXN0cnVjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLnNldF90eXBlKHR5cGUpO1xuICAgICAgICAgICAgdGhpcy5zZXRfZGVzdHJ1Y3RvcihkZXN0cnVjdG9yKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X3JlZmNvdW50KDApO1xuICAgICAgICAgICAgdGhpcy5zZXRfY2F1Z2h0KGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X3JldGhyb3duKGZhbHNlKVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZF9yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gSEVBUDMyW3RoaXMucHRyID4+IDJdO1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyID4+IDJdID0gdmFsdWUgKyAxXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMucmVsZWFzZV9yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXYgPSBIRUFQMzJbdGhpcy5wdHIgPj4gMl07XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgPj4gMl0gPSBwcmV2IC0gMTtcbiAgICAgICAgICAgIHJldHVybiBwcmV2ID09PSAxXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfdGhyb3cocHRyLCB0eXBlLCBkZXN0cnVjdG9yKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSBuZXcgRXhjZXB0aW9uSW5mbyhwdHIpO1xuICAgICAgICBpbmZvLmluaXQodHlwZSwgZGVzdHJ1Y3Rvcik7XG4gICAgICAgIHRocm93IHB0clxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hYm9ydCgpIHtcbiAgICAgICAgYWJvcnQoXCJcIilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZW1zY3JpcHRlbl9tZW1jcHlfYmlnKGRlc3QsIHNyYywgbnVtKSB7XG4gICAgICAgIEhFQVBVOC5jb3B5V2l0aGluKGRlc3QsIHNyYywgc3JjICsgbnVtKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIoc2l6ZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2FzbU1lbW9yeS5ncm93KHNpemUgLSBidWZmZXIuYnl0ZUxlbmd0aCArIDY1NTM1ID4+PiAxNik7XG4gICAgICAgICAgICB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyh3YXNtTWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gMVxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHlcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZW1zY3JpcHRlbl9yZXNpemVfaGVhcChyZXF1ZXN0ZWRTaXplKSB7XG4gICAgICAgIGNvbnN0IG9sZFNpemUgPSBIRUFQVTgubGVuZ3RoO1xuICAgICAgICByZXF1ZXN0ZWRTaXplID4+Pj0gMDtcbiAgICAgICAgY29uc3QgbWF4SGVhcFNpemUgPSAyMTQ3NDgzNjQ4O1xuICAgICAgICBpZiAocmVxdWVzdGVkU2l6ZSA+IG1heEhlYXBTaXplKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjdXREb3duID0gMTsgY3V0RG93biA8PSA0OyBjdXREb3duICo9IDIpIHtcbiAgICAgICAgICAgIGxldCBvdmVyR3Jvd25IZWFwU2l6ZSA9IG9sZFNpemUgKiAoMSArIC4yIC8gY3V0RG93bik7XG4gICAgICAgICAgICBvdmVyR3Jvd25IZWFwU2l6ZSA9IE1hdGgubWluKG92ZXJHcm93bkhlYXBTaXplLCByZXF1ZXN0ZWRTaXplICsgMTAwNjYzMjk2KTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NpemUgPSBNYXRoLm1pbihtYXhIZWFwU2l6ZSwgYWxpZ25VcChNYXRoLm1heChyZXF1ZXN0ZWRTaXplLCBvdmVyR3Jvd25IZWFwU2l6ZSksIDY1NTM2KSk7XG4gICAgICAgICAgICBjb25zdCByZXBsYWNlbWVudCA9IGVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIobmV3U2l6ZSk7XG4gICAgICAgICAgICBpZiAocmVwbGFjZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCBTWVNDQUxMUyA9IHtcbiAgICAgICAgbWFwcGluZ3M6IHt9LFxuICAgICAgICBidWZmZXJzOiBbbnVsbCwgW10sXG4gICAgICAgICAgICBbXVxuICAgICAgICBdLFxuICAgICAgICBwcmludENoYXIoc3RyZWFtLCBjdXJyKSB7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBTWVNDQUxMUy5idWZmZXJzW3N0cmVhbV07XG4gICAgICAgICAgICBpZiAoY3VyciA9PT0gMCB8fCBjdXJyID09PSAxMCkge1xuICAgICAgICAgICAgICAgIChzdHJlYW0gPT09IDEgPyBvdXQgOiBlcnIpKFVURjhBcnJheVRvU3RyaW5nKGJ1ZmZlciwgMCkpO1xuICAgICAgICAgICAgICAgIGJ1ZmZlci5sZW5ndGggPSAwXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKGN1cnIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHZhcmFyZ3M6IHVuZGVmaW5lZCxcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgICAgU1lTQ0FMTFMudmFyYXJncyArPSA0O1xuICAgICAgICAgICAgY29uc3QgcmV0ID0gSEVBUDMyW1NZU0NBTExTLnZhcmFyZ3MgLSA0ID4+IDJdO1xuICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICB9LFxuICAgICAgICBnZXRTdHIocHRyKSB7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBVVEY4VG9TdHJpbmcocHRyKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0NjQobG93KSB7XG4gICAgICAgICAgICByZXR1cm4gbG93XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gX2ZkX3dyaXRlKGZkLCBpb3YsIGlvdmNudCwgcG51bSkge1xuICAgICAgICBsZXQgbnVtID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpb3ZjbnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcHRyID0gSEVBUDMyW2lvdiA+PiAyXTtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IEhFQVAzMltpb3YgKyA0ID4+IDJdO1xuICAgICAgICAgICAgaW92ICs9IDg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgU1lTQ0FMTFMucHJpbnRDaGFyKGZkLCBIRUFQVThbcHRyICsgal0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBudW0gKz0gbGVuXG4gICAgICAgIH1cbiAgICAgICAgSEVBUDMyW3BudW0gPj4gMl0gPSBudW07XG4gICAgICAgIHJldHVybiAwXG4gICAgfVxuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgIGZ1bmN0aW9uIF9zZXRUZW1wUmV0MCh2YWwpIHtcbiAgICAgICAgLy8gc2V0VGVtcFJldDAodmFsKVxuICAgIH1cbiAgICBjb25zdCBhc21MaWJyYXJ5QXJnID0ge1xuICAgICAgICBcIl9fYXNzZXJ0X2ZhaWxcIjogX19fYXNzZXJ0X2ZhaWwsXG4gICAgICAgIFwiX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uXCI6IF9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24sXG4gICAgICAgIFwiX19jeGFfYXRleGl0XCI6IF9fX2N4YV9hdGV4aXQsXG4gICAgICAgIFwiX19jeGFfdGhyb3dcIjogX19fY3hhX3Rocm93LFxuICAgICAgICBcImFib3J0XCI6IF9hYm9ydCxcbiAgICAgICAgXCJlbXNjcmlwdGVuX21lbWNweV9iaWdcIjogX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZyxcbiAgICAgICAgXCJlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwXCI6IF9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwLFxuICAgICAgICBcImZkX3dyaXRlXCI6IF9mZF93cml0ZSxcbiAgICAgICAgXCJzZXRUZW1wUmV0MFwiOiBfc2V0VGVtcFJldDBcbiAgICB9O1xuICAgIGNyZWF0ZVdhc20oKTtcbiAgICBsZXQgX19fd2FzbV9jYWxsX2N0b3JzID0gTW9kdWxlLl9fX3dhc21fY2FsbF9jdG9ycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9fX3dhc21fY2FsbF9jdG9ycyA9IE1vZHVsZS5fX193YXNtX2NhbGxfY3RvcnMgPSBNb2R1bGUuYXNtLl9fd2FzbV9jYWxsX2N0b3JzKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX21haW4gPSBNb2R1bGUuX21haW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfbWFpbiA9IE1vZHVsZS5fbWFpbiA9IE1vZHVsZS5hc20ubWFpbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9jcmVhdGVUZXh0dXJlID0gTW9kdWxlLl9jcmVhdGVUZXh0dXJlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuYXNtLmNyZWF0ZVRleHR1cmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfY3JlYXRlQm91bmRpbmcgPSBNb2R1bGUuX2NyZWF0ZUJvdW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2NyZWF0ZUJvdW5kaW5nID0gTW9kdWxlLl9jcmVhdGVCb3VuZGluZyA9IE1vZHVsZS5hc20uY3JlYXRlQm91bmRpbmcpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfc2V0Q2FtZXJhID0gTW9kdWxlLl9zZXRDYW1lcmEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfc2V0Q2FtZXJhID0gTW9kdWxlLl9zZXRDYW1lcmEgPSBNb2R1bGUuYXNtLnNldENhbWVyYSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9yZWFkU3RyZWFtID0gTW9kdWxlLl9yZWFkU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX3JlYWRTdHJlYW0gPSBNb2R1bGUuX3JlYWRTdHJlYW0gPSBNb2R1bGUuYXNtLnJlYWRTdHJlYW0pLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfcGF0aFRyYWNlciA9IE1vZHVsZS5fcGF0aFRyYWNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9wYXRoVHJhY2VyID0gTW9kdWxlLl9wYXRoVHJhY2VyID0gTW9kdWxlLmFzbS5wYXRoVHJhY2VyKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX19fZXJybm9fbG9jYXRpb24gPSBNb2R1bGUuX19fZXJybm9fbG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5fX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5hc20uX19lcnJub19sb2NhdGlvbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IHN0YWNrU2F2ZSA9IE1vZHVsZS5zdGFja1NhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja1NhdmUgPSBNb2R1bGUuc3RhY2tTYXZlID0gTW9kdWxlLmFzbS5zdGFja1NhdmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBzdGFja1Jlc3RvcmUgPSBNb2R1bGUuc3RhY2tSZXN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoc3RhY2tSZXN0b3JlID0gTW9kdWxlLnN0YWNrUmVzdG9yZSA9IE1vZHVsZS5hc20uc3RhY2tSZXN0b3JlKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgc3RhY2tBbGxvYyA9IE1vZHVsZS5zdGFja0FsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoc3RhY2tBbGxvYyA9IE1vZHVsZS5zdGFja0FsbG9jID0gTW9kdWxlLmFzbS5zdGFja0FsbG9jKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX21hbGxvYyA9IE1vZHVsZS5fbWFsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX21hbGxvYyA9IE1vZHVsZS5fbWFsbG9jID0gTW9kdWxlLmFzbS5tYWxsb2MpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfZnJlZSA9IE1vZHVsZS5fZnJlZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9mcmVlID0gTW9kdWxlLl9mcmVlID0gTW9kdWxlLmFzbS5mcmVlKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgZHluQ2FsbF9qaWppID0gTW9kdWxlLmR5bkNhbGxfamlqaSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKGR5bkNhbGxfamlqaSA9IE1vZHVsZS5keW5DYWxsX2ppamkgPSBNb2R1bGUuYXNtLmR5bkNhbGxfamlqaSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgTW9kdWxlLmNjYWxsID0gY2NhbGw7XG4gICAgTW9kdWxlLnNldFZhbHVlID0gc2V0VmFsdWU7XG4gICAgTW9kdWxlLmdldFZhbHVlID0gZ2V0VmFsdWU7XG4gICAgbGV0IGNhbGxlZFJ1bjtcblxuICAgIGZ1bmN0aW9uIEV4aXRTdGF0dXMoc3RhdHVzKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IFwiRXhpdFN0YXR1c1wiO1xuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBgUHJvZ3JhbSB0ZXJtaW5hdGVkIHdpdGggZXhpdCgkeyAgc3RhdHVzICB9KWA7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzXG4gICAgfVxuICAgIGxldCBjYWxsZWRNYWluID0gZmFsc2U7XG4gICAgZGVwZW5kZW5jaWVzRnVsZmlsbGVkID0gZnVuY3Rpb24gcnVuQ2FsbGVyKCkge1xuICAgICAgICBpZiAoIWNhbGxlZFJ1bikgcnVuKCk7XG4gICAgICAgIGlmICghY2FsbGVkUnVuKSBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBydW5DYWxsZXJcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY2FsbE1haW4oYXJncykge1xuICAgICAgICBjb25zdCBlbnRyeUZ1bmN0aW9uID0gTW9kdWxlLl9tYWluO1xuICAgICAgICBhcmdzID0gYXJncyB8fCBbXTtcbiAgICAgICAgY29uc3QgYXJnYyA9IGFyZ3MubGVuZ3RoICsgMTtcbiAgICAgICAgY29uc3QgYXJndiA9IHN0YWNrQWxsb2MoKGFyZ2MgKyAxKSAqIDQpO1xuICAgICAgICBIRUFQMzJbYXJndiA+PiAyXSA9IGFsbG9jYXRlVVRGOE9uU3RhY2sodGhpc1Byb2dyYW0pO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IGFyZ2M7IGkrKykge1xuICAgICAgICAgICAgSEVBUDMyWyhhcmd2ID4+IDIpICsgaV0gPSBhbGxvY2F0ZVVURjhPblN0YWNrKGFyZ3NbaSAtIDFdKVxuICAgICAgICB9XG4gICAgICAgIEhFQVAzMlsoYXJndiA+PiAyKSArIGFyZ2NdID0gMDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IGVudHJ5RnVuY3Rpb24oYXJnYywgYXJndik7XG4gICAgICAgICAgICBleGl0KHJldCwgdHJ1ZSk7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVFeGNlcHRpb24oZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICAgICAgICAgIGNhbGxlZE1haW4gPSB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBydW4oYXJncykge1xuICAgICAgICBhcmdzID0gYXJncyB8fCBhcmd1bWVudHNfO1xuICAgICAgICBpZiAocnVuRGVwZW5kZW5jaWVzID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgcHJlUnVuKCk7XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRvUnVuKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZFJ1bikgcmV0dXJuO1xuICAgICAgICAgICAgY2FsbGVkUnVuID0gdHJ1ZTtcbiAgICAgICAgICAgIE1vZHVsZS5jYWxsZWRSdW4gPSB0cnVlO1xuICAgICAgICAgICAgaWYgKEFCT1JUKSByZXR1cm47XG4gICAgICAgICAgICBpbml0UnVudGltZSgpO1xuICAgICAgICAgICAgcHJlTWFpbigpO1xuICAgICAgICAgICAgaWYgKE1vZHVsZS5vblJ1bnRpbWVJbml0aWFsaXplZCkgTW9kdWxlLm9uUnVudGltZUluaXRpYWxpemVkKCk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkUnVuTm93KSBjYWxsTWFpbihhcmdzKTtcbiAgICAgICAgICAgIHBvc3RSdW4oKVxuICAgICAgICB9XG4gICAgICAgIGlmIChNb2R1bGUuc2V0U3RhdHVzKSB7XG4gICAgICAgICAgICBNb2R1bGUuc2V0U3RhdHVzKFwiUnVubmluZy4uLlwiKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBNb2R1bGUuc2V0U3RhdHVzKFwiXCIpXG4gICAgICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgICAgICAgICAgZG9SdW4oKVxuICAgICAgICAgICAgfSwgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvUnVuKClcbiAgICAgICAgfVxuICAgIH1cbiAgICBNb2R1bGUucnVuID0gcnVuO1xuXG4gICAgZnVuY3Rpb24gZXhpdChzdGF0dXMpIHtcbiAgICAgICAgRVhJVFNUQVRVUyA9IHN0YXR1cztcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWVtcHR5XG4gICAgICAgIGlmIChrZWVwUnVudGltZUFsaXZlKCkpIHt9IGVsc2Uge1xuICAgICAgICAgICAgZXhpdFJ1bnRpbWUoKVxuICAgICAgICB9XG4gICAgICAgIHByb2NFeGl0KHN0YXR1cylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jRXhpdChjb2RlKSB7XG4gICAgICAgIEVYSVRTVEFUVVMgPSBjb2RlO1xuICAgICAgICBpZiAoIWtlZXBSdW50aW1lQWxpdmUoKSkge1xuICAgICAgICAgICAgaWYgKE1vZHVsZS5vbkV4aXQpIE1vZHVsZS5vbkV4aXQoY29kZSk7XG4gICAgICAgICAgICBBQk9SVCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICBxdWl0Xyhjb2RlLCBuZXcgRXhpdFN0YXR1cyhjb2RlKSlcbiAgICB9XG4gICAgaWYgKE1vZHVsZS5wcmVJbml0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnByZUluaXQgPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnByZUluaXQgPSBbTW9kdWxlLnByZUluaXRdO1xuICAgICAgICB3aGlsZSAoTW9kdWxlLnByZUluaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgTW9kdWxlLnByZUluaXQucG9wKCkoKVxuICAgICAgICB9XG4gICAgfVxuICAgIGxldCBzaG91bGRSdW5Ob3cgPSB0cnVlO1xuICAgIGlmIChNb2R1bGUubm9Jbml0aWFsUnVuKSBzaG91bGRSdW5Ob3cgPSBmYWxzZTtcbiAgICBydW4oKTtcblxuICAgIHJldHVybiBNb2R1bGU7XG59XG4iLG51bGwsbnVsbF0sIm5hbWVzIjpbIlJlbmRlcmVyIiwid2FzbU1hbmFnZXIiLCJwaXhlbERhdGEiLCJjYW1lcmFCdWYiLCJyZW5kZXJDdHgiLCJjb25zdHJ1Y3RvciIsImNyZWF0ZUJvdW5kIiwibW9kZWwiLCJjcmVhdGVCdWZmZXJzIiwidGV4dHVyZSIsIm1hdGVyaWFsIiwiaXNWYWxpZCIsImlkIiwiYnVmZmVyIiwiY2FsbEZ1bmN0aW9uIiwiY2FsbENyZWF0ZUJvdW5kaW5nIiwicG9zaXRpb25CdWZmZXIiLCJsZW5ndGgiLCJpbmRpY2llc0J1ZmZlciIsIm5vcm1hbEJ1ZmZlciIsInRleGNvb3JkQnVmZmVyIiwibWF0cml4QnVmZmVyIiwicmVuZGVyIiwiY2FudmFzIiwiY2FtZXJhIiwid2lkdGgiLCJoZWlnaHQiLCJjdHgiLCJnZXRDb250ZXh0IiwiY29uc29sZSIsImVycm9yIiwiaW1hZ2VkYXRhIiwiY3JlYXRlSW1hZ2VEYXRhIiwicGl4ZWxzIiwiZGF0YSIsInJlbGVhc2UiLCJjcmVhdGVCdWZmZXIiLCJzZXRBcnJheSIsImR1bXBBc0FycmF5IiwiY2FsbFNldENhbWVyYSIsInJlc3VsdCIsImNhbGxQYXRoVHJhY2VyIiwibG9nIiwicmVzdWx0MiIsImNhbGxSZWFkU3RyZWFtIiwicmVuZGVyZnVuYyIsInRpbWVyIiwic2V0SW50ZXJ2YWwiLCJpIiwiZ2V0IiwicHV0SW1hZ2VEYXRhIiwiY2xlYXJJbnRlcnZhbCIsInByZXBhcmVQYXJ0aWFsUmVuZGVyaW5nIiwiaW1hZ2VEYXRhIiwicGFydGlhbFJlbmRlcmluZyIsInVwZGF0ZSIsIlZlY3RvcjMiLCJ4IiwieSIsInoiLCJfeCIsIl95IiwiX3oiLCJzZXQiLCJsZW5ndGgyIiwiTWF0aCIsInNxcnQiLCJkaXN0YW5jZSIsImEiLCJhZGQiLCJzdWJ0cmFjdCIsIm11bHRpcGx5IiwiZGl2aWRlIiwiYXNzZXJ0Iiwibm9ybWFsaXplIiwiZG90IiwiY3Jvc3MiLCJlcXVhbCIsImNvcHkiLCJnZXRBcnJheSIsIkZsb2F0MzJBcnJheSIsIlZlY3RvcjQiLCJ3IiwiX3ciLCJNYXRyaXg0IiwibWF0cml4IiwibnVtQXJyYXkiLCJleWUiLCJlbXB0eSIsImZpbGwiLCJzY2FsZU1hdHJpeCIsInNjYWxlIiwidHJhbnNsYXRlTWF0cml4IiwibW92ZSIsIm0iLCJuIiwic3ViIiwibXVsIiwidHJhbnNwb3NlIiwiaW52ZXJzZSIsIm1hdCIsImIiLCJjIiwiZCIsImUiLCJmIiwiZyIsImgiLCJqIiwiayIsImwiLCJvIiwicCIsInEiLCJyIiwicyIsInQiLCJ1IiwidiIsIkEiLCJCIiwiaXZkIiwiRXJyb3IiLCJkZXN0IiwiZ2V0U2NhbGVSb3RhdGlvbk1hdHJpeCIsImdldFRyYW5zbGF0ZVZlY3RvciIsIlF1YXRlcm5pb24iLCJhbmdsZUF4aXMiLCJhbmdsZSIsIl9heGlzIiwiYXhpcyIsInNpbiIsImNvcyIsImV1bGFyQW5nbGUiLCJyb3QiLCJ4YyIsInhzIiwieWMiLCJ5cyIsInpjIiwienMiLCJmcm9tTWF0cml4IiwibTAwIiwibTEwIiwibTIwIiwibTAxIiwibTExIiwibTIxIiwibTAyIiwibTEyIiwibTIyIiwiZWxlbWVudCIsIm1heEluZGV4IiwibGVuIiwiVHJhbnNmb3JtIiwicm90YXRpb24iLCJwb3NpdGlvbiIsInRyYW5zbGF0ZSIsIk1vZGVsIiwiX3Bvc2l0aW9uIiwiX3Bvc2l0aW9uQnVmZmVyIiwiX25vcm1hbCIsIl9ub3JtYWxCdWZmZXIiLCJfdGV4Y29vcmQiLCJfdGV4Y29vcmRCdWZmZXIiLCJfaW5kaWNpZXMiLCJJbnQzMkFycmF5IiwiX2luZGljaWVzQnVmZmVyIiwiX2JvdW5kaW5nQm94IiwibWluIiwibWF4IiwiX21hdHJpeCIsIl9tYXRyaXhCdWZmZXIiLCJfdHJhbnNmb3JtIiwiX21hdGVyaWFsIiwiY3JlYXRlQm91bmRpbmdCb3giLCJwb3MiLCJ0cmFuc2Zvcm0iLCJub3JtYWwiLCJ0ZXhjb29yZCIsImluZGljaWVzIiwibWFuYWdlciIsImNvbmNhdCIsImJvdW5kaW5nQm94IiwiR0xURkxvYWRlciIsInJhd0pzb24iLCJsb2FkIiwidXJsIiwicmVzcG9uc2UiLCJmZXRjaCIsImhlYWRlcnMiLCJqc29uIiwiYW5hbGl6ZSIsIm5vZGVzIiwibWVzaGVzIiwiYWNjZXNzb3JzIiwiYnVmZmVyVmlld3MiLCJidWZmZXJzIiwiQXJyYXkiLCJpc0FycmF5Iiwibm9kZSIsInByaW1pdGl2ZXMiLCJwcmltaXRpdmUiLCJidWZQb3MiLCJhdHRyaWJ1dGVzIiwiUE9TSVRJT04iLCJidWZOb3JtIiwiTk9STUFMIiwiYnVmVGV4IiwiVEVYQ09PUkRfMCIsImJ1ZkluZCIsImluZGljZXMiLCJ1cmkiLCJ0cmFuc2xhdGlvbiIsImJsb2IiLCJhcnJheUJ1ZmZlciIsImJ5dGVPZmZzZXQiLCJieXRlTGVuZ3RoIiwiZnJvbSIsIkludDE2QXJyYXkiLCJNQVRFUklBTF9VTklGT1JNX0xFTkdUSCIsIk1hdGVyaWFsIiwiX21hdGVyaWFsQnVmZmVyIiwiY3JlYXRlT3B0aW9uQXJyYXkiLCJHbGFzcyIsIl9yaG8iLCJyaG8iLCJEaWZmdXNlIiwiY29sb3IiLCJDYW1lcmEiLCJfcG9zIiwiX2ZvcndhcmQiLCJfdG9wIiwiX3JpZ2h0IiwiX2Rpc3QiLCJ2aWV3QW5nbGUiLCJ0YW4iLCJmb3J3YXJkIiwicmlnaHQiLCJ0b3AiLCJkaXN0IiwiYXRhbiIsImxvb2tBdCIsInRvIiwiSU1BR0VfU0laRSIsIlRleHR1cmUiLCJpbWFnZSIsImltYWdlQXJyYXkiLCJ2YWxpZCIsIl9idWZmZXIiLCJzZXRUZXh0dXJlIiwiY252IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiZHJhd0ltYWdlIiwiZ2V0SW1hZ2VEYXRhIiwid2FzbSIsIldhc21CdWZmZXIiLCJfbW9kdWxlIiwiX2Jhc2UiLCJfdHlwZSIsIl9zdHJpZGUiLCJfbGVuZ3RoIiwidHlwZSIsIm1vZHVsZSIsInNpemUiLCJfbWFsbG9jIiwiaW5kZXgiLCJnZXRWYWx1ZSIsInZhbHVlIiwic2V0VmFsdWUiLCJhcnJheSIsImZvckVhY2giLCJnZXRQb2ludGVyIiwiX2ZyZWUiLCJXYXNtTW9kdWxlR2VuZXJhdG9yIiwid29ya2VyR2xvYmFsU2NvcGUiLCJNb2R1bGUiLCJhcmd1bWVudHNfIiwidGhpc1Byb2dyYW0iLCJxdWl0XyIsInN0YXR1cyIsInRvVGhyb3ciLCJFTlZJUk9OTUVOVF9JU19XRUIiLCJ3aW5kb3ciLCJFTlZJUk9OTUVOVF9JU19XT1JLRVIiLCJpbXBvcnRTY3JpcHRzIiwiRU5WSVJPTk1FTlRfSVNfTk9ERSIsInByb2Nlc3MiLCJ2ZXJzaW9ucyIsInNjcmlwdERpcmVjdG9yeSIsImxvY2F0ZUZpbGUiLCJwYXRoIiwicmVhZF8iLCJyZWFkQXN5bmMiLCJyZWFkQmluYXJ5IiwibG9nRXhjZXB0aW9uT25FeGl0IiwiRXhpdFN0YXR1cyIsInRvTG9nIiwiZXJyIiwibm9kZUZTIiwibm9kZVBhdGgiLCJyZXF1aXJlIiwiZGlybmFtZSIsIl9fZGlybmFtZSIsInNoZWxsX3JlYWQiLCJmaWxlbmFtZSIsImJpbmFyeSIsInJlYWRGaWxlU3luYyIsInJldCIsIlVpbnQ4QXJyYXkiLCJvbmxvYWQiLCJvbmVycm9yIiwicmVhZEZpbGUiLCJhcmd2IiwicmVwbGFjZSIsInNsaWNlIiwiZXhwb3J0cyIsIm9uIiwiZXgiLCJyZWFzb24iLCJrZWVwUnVudGltZUFsaXZlIiwiZXhpdENvZGUiLCJleGl0IiwiaW5zcGVjdCIsInNlbGYiLCJsb2NhdGlvbiIsImhyZWYiLCJjdXJyZW50U2NyaXB0Iiwic3JjIiwiaW5kZXhPZiIsInN1YnN0ciIsImxhc3RJbmRleE9mIiwieGhyIiwiWE1MSHR0cFJlcXVlc3QiLCJvcGVuIiwic2VuZCIsInJlc3BvbnNlVGV4dCIsInJlc3BvbnNlVHlwZSIsIm91dCIsInByaW50IiwiYmluZCIsInByaW50RXJyIiwid2FybiIsImFyZ3VtZW50cyIsInF1aXQiLCJiYXNlNjRUb0FycmF5QnVmZmVyIiwiYmFzZTY0IiwiYmluYXJ5X3N0cmluZyIsIkJ1ZmZlciIsInRvU3RyaW5nIiwiYXRvYiIsImJ5dGVzIiwiY2hhckNvZGVBdCIsIndhc21CaW5hcnkiLCJtYWluV2FzbSIsIm5vRXhpdFJ1bnRpbWUiLCJXZWJBc3NlbWJseSIsImFib3J0IiwicHRyIiwiY2hhckF0IiwiSEVBUDgiLCJIRUFQMTYiLCJIRUFQMzIiLCJ0ZW1wSTY0IiwidGVtcERvdWJsZSIsImFicyIsImZsb29yIiwiY2VpbCIsIkhFQVBGMzIiLCJIRUFQRjY0IiwiTnVtYmVyIiwid2FzbU1lbW9yeSIsIkFCT1JUIiwiRVhJVFNUQVRVUyIsImNvbmRpdGlvbiIsInRleHQiLCJnZXRDRnVuYyIsImlkZW50IiwiZnVuYyIsImNjYWxsIiwicmV0dXJuVHlwZSIsImFyZ1R5cGVzIiwiYXJncyIsInRvQyIsInN0ciIsInVuZGVmaW5lZCIsInN0YWNrQWxsb2MiLCJzdHJpbmdUb1VURjgiLCJhcnIiLCJ3cml0ZUFycmF5VG9NZW1vcnkiLCJjb252ZXJ0UmV0dXJuVmFsdWUiLCJVVEY4VG9TdHJpbmciLCJCb29sZWFuIiwiY0FyZ3MiLCJzdGFjayIsImNvbnZlcnRlciIsInN0YWNrU2F2ZSIsIm9uRG9uZSIsInN0YWNrUmVzdG9yZSIsIlVURjhEZWNvZGVyIiwiVGV4dERlY29kZXIiLCJVVEY4QXJyYXlUb1N0cmluZyIsImhlYXAiLCJpZHgiLCJtYXhCeXRlc1RvUmVhZCIsImVuZElkeCIsImVuZFB0ciIsInN1YmFycmF5IiwiZGVjb2RlIiwidTAiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJ1MSIsInUyIiwiY2giLCJIRUFQVTgiLCJzdHJpbmdUb1VURjhBcnJheSIsIm91dElkeCIsIm1heEJ5dGVzVG9Xcml0ZSIsInN0YXJ0SWR4Iiwib3V0UHRyIiwibGVuZ3RoQnl0ZXNVVEY4IiwiYWxsb2NhdGVVVEY4T25TdGFjayIsImFsaWduVXAiLCJtdWx0aXBsZSIsInVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzIiwiYnVmIiwiSW50OEFycmF5IiwiSEVBUFUxNiIsIlVpbnQxNkFycmF5IiwiSEVBUFUzMiIsIlVpbnQzMkFycmF5IiwiRmxvYXQ2NEFycmF5Iiwid2FzbVRhYmxlIiwiX19BVFBSRVJVTl9fIiwiX19BVElOSVRfXyIsIl9fQVRNQUlOX18iLCJfX0FUUE9TVFJVTl9fIiwicnVudGltZUtlZXBhbGl2ZUNvdW50ZXIiLCJwcmVSdW4iLCJhZGRPblByZVJ1biIsInNoaWZ0IiwiY2FsbFJ1bnRpbWVDYWxsYmFja3MiLCJpbml0UnVudGltZSIsInByZU1haW4iLCJwb3N0UnVuIiwiYWRkT25Qb3N0UnVuIiwiY2IiLCJ1bnNoaWZ0IiwiYWRkT25Jbml0IiwicnVuRGVwZW5kZW5jaWVzIiwiZGVwZW5kZW5jaWVzRnVsZmlsbGVkIiwiYWRkUnVuRGVwZW5kZW5jeSIsIm1vbml0b3JSdW5EZXBlbmRlbmNpZXMiLCJyZW1vdmVSdW5EZXBlbmRlbmN5IiwiY2FsbGJhY2siLCJwcmVsb2FkZWRJbWFnZXMiLCJwcmVsb2FkZWRBdWRpb3MiLCJ3aGF0Iiwib25BYm9ydCIsIlJ1bnRpbWVFcnJvciIsImRhdGFVUklQcmVmaXgiLCJpc0RhdGFVUkkiLCJzdGFydHNXaXRoIiwiaXNGaWxlVVJJIiwid2FzbUJpbmFyeUZpbGUiLCJnZXRCaW5hcnkiLCJmaWxlIiwiZ2V0QmluYXJ5UHJvbWlzZSIsImNyZWRlbnRpYWxzIiwidGhlbiIsIm9rIiwiY2F0Y2giLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNyZWF0ZVdhc20iLCJpbmZvIiwiYXNtTGlicmFyeUFyZyIsInJlY2VpdmVJbnN0YW5jZSIsImluc3RhbmNlIiwiYXNtIiwibWVtb3J5IiwiX19pbmRpcmVjdF9mdW5jdGlvbl90YWJsZSIsIl9fd2FzbV9jYWxsX2N0b3JzIiwicmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQiLCJpbnN0YW50aWF0ZUFycmF5QnVmZmVyIiwicmVjZWl2ZXIiLCJpbnN0YW50aWF0ZSIsImluc3RhbnRpYXRlQXN5bmMiLCJpbnN0YW50aWF0ZVN0cmVhbWluZyIsImluc3RhbnRpYXRlV2FzbSIsImNhbGxiYWNrcyIsImFyZyIsImdldFdhc21UYWJsZUVudHJ5Iiwid2FzbVRhYmxlTWlycm9yIiwiZnVuY1B0ciIsImhhbmRsZUV4Y2VwdGlvbiIsIl9fX2Fzc2VydF9mYWlsIiwibGluZSIsIl9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24iLCJfYXRleGl0IiwiX19fY3hhX2F0ZXhpdCIsImEwIiwiYTEiLCJFeGNlcHRpb25JbmZvIiwiZXhjUHRyIiwic2V0X3R5cGUiLCJnZXRfdHlwZSIsInNldF9kZXN0cnVjdG9yIiwiZGVzdHJ1Y3RvciIsImdldF9kZXN0cnVjdG9yIiwic2V0X3JlZmNvdW50IiwicmVmY291bnQiLCJzZXRfY2F1Z2h0IiwiY2F1Z2h0IiwiZ2V0X2NhdWdodCIsInNldF9yZXRocm93biIsInJldGhyb3duIiwiZ2V0X3JldGhyb3duIiwiaW5pdCIsImFkZF9yZWYiLCJyZWxlYXNlX3JlZiIsInByZXYiLCJfX19jeGFfdGhyb3ciLCJfYWJvcnQiLCJfZW1zY3JpcHRlbl9tZW1jcHlfYmlnIiwibnVtIiwiY29weVdpdGhpbiIsImVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIiLCJncm93IiwiX2Vtc2NyaXB0ZW5fcmVzaXplX2hlYXAiLCJyZXF1ZXN0ZWRTaXplIiwib2xkU2l6ZSIsIm1heEhlYXBTaXplIiwiY3V0RG93biIsIm92ZXJHcm93bkhlYXBTaXplIiwibmV3U2l6ZSIsInJlcGxhY2VtZW50IiwiU1lTQ0FMTFMiLCJtYXBwaW5ncyIsInByaW50Q2hhciIsInN0cmVhbSIsImN1cnIiLCJwdXNoIiwidmFyYXJncyIsImdldFN0ciIsImdldDY0IiwibG93IiwiX2ZkX3dyaXRlIiwiZmQiLCJpb3YiLCJpb3ZjbnQiLCJwbnVtIiwiX3NldFRlbXBSZXQwIiwidmFsIiwiX19fd2FzbV9jYWxsX2N0b3JzIiwiYXBwbHkiLCJfbWFpbiIsIm1haW4iLCJfY3JlYXRlVGV4dHVyZSIsImNyZWF0ZVRleHR1cmUiLCJfY3JlYXRlQm91bmRpbmciLCJjcmVhdGVCb3VuZGluZyIsIl9zZXRDYW1lcmEiLCJzZXRDYW1lcmEiLCJfcmVhZFN0cmVhbSIsInJlYWRTdHJlYW0iLCJfcGF0aFRyYWNlciIsInBhdGhUcmFjZXIiLCJfX19lcnJub19sb2NhdGlvbiIsIl9fZXJybm9fbG9jYXRpb24iLCJtYWxsb2MiLCJmcmVlIiwiZHluQ2FsbF9qaWppIiwiY2FsbGVkUnVuIiwibmFtZSIsIm1lc3NhZ2UiLCJydW5DYWxsZXIiLCJydW4iLCJjYWxsTWFpbiIsImVudHJ5RnVuY3Rpb24iLCJhcmdjIiwiZG9SdW4iLCJvblJ1bnRpbWVJbml0aWFsaXplZCIsInNob3VsZFJ1bk5vdyIsInNldFN0YXR1cyIsInNldFRpbWVvdXQiLCJwcm9jRXhpdCIsImNvZGUiLCJvbkV4aXQiLCJwcmVJbml0IiwicG9wIiwibm9Jbml0aWFsUnVuIiwiV2FzbU1hbmFnZXIiLCJFdmVudFRhcmdldCIsImRpc3BhdGNoRXZlbnQiLCJFdmVudCIsImZ1bmNuYW1lIiwicmF3QXJncyIsIm1hcCIsIlZlY3RvcjIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7SUFLQTs7Ozs7O1VBTWFBO0lBQ0hDLEVBQUFBLFdBQVc7SUFFWEMsRUFBQUEsU0FBUyxHQUFzQixJQUF0QjtJQUVUQyxFQUFBQSxTQUFTLEdBQXNCLElBQXRCOztJQUdUQyxFQUFBQSxTQUFTLEdBTU4sSUFOTTtJQVFqQjs7Ozs7OztJQU1BQyxFQUFBQSxZQUFZSjtJQUNWLFNBQUtBLFdBQUwsR0FBbUJBLFdBQW5CO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNT0ssRUFBQUEsV0FBVyxDQUFDQyxLQUFEO0lBQ2hCQSxJQUFBQSxLQUFLLENBQUNDLGFBQU4sQ0FBb0IsS0FBS1AsV0FBekI7SUFFQSxVQUFNO0lBQUNRLE1BQUFBO0lBQUQsUUFBWUYsS0FBSyxDQUFDRyxRQUF4Qjs7SUFFQSxRQUFHRCxPQUFPLElBQUlBLE9BQU8sQ0FBQ0UsT0FBUixFQUFYLElBQWdDRixPQUFPLENBQUNHLEVBQVIsR0FBYSxDQUE3QyxJQUFrREgsT0FBTyxDQUFDSSxNQUE3RCxFQUFzRTtJQUNwRSxZQUFNRCxFQUFFLEdBQUcsS0FBS1gsV0FBTCxDQUFpQmEs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QUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBcEMsR0FBMENELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FObEMsRUFPakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxDQUFELENBQXJDLEdBQTJDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxDQUFELENBUG5DLEVBUWpCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQUFyQyxHQUEyQ0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQVJuQyxFQVNqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLEVBQUQsQ0FBcEMsR0FBMkNELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FUbkMsRUFVakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENB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
