
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aHRyYWNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvcmVuZGVyZXIvUmVuZGVyZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IzLnRzIiwiLi4vLi4vc3JjL21hdGgvVmVjdG9yNC50cyIsIi4uLy4uL3NyYy9tYXRoL01hdHJpeDQudHMiLCIuLi8uLi9zcmMvbWF0aC9RdWF0ZXJuaW9uLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvVHJhbnNmb3JtLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTW9kZWwudHMiLCIuLi8uLi9zcmMvY29yZS9tb2RlbC9HTFRGTG9hZGVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvbWF0ZXJpYWwvTWF0ZXJpYWwudHMiLCIuLi8uLi9zcmMvY29yZS9tYXRlcmlhbC9HbGFzcy50cyIsIi4uLy4uL3NyYy9jb3JlL21hdGVyaWFsL0RpZmZ1c2UudHMiLCIuLi8uLi9zcmMvY29yZS9jYW1lcmEvQ2FtZXJhLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9UZXh0dXJlLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtQnVmZmVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTW9kdWxlLmpzIiwiLi4vLi4vc3JjL2NvcmUvd2FzbS9XYXNtTWFuYWdlci50cyIsIi4uLy4uL3NyYy9tYXRoL1ZlY3RvcjIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsIi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1yZXN0LXBhcmFtcyAqL1xuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItc3ByZWFkICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1yZXR1cm4tYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBjb25zaXN0ZW50LXJldHVybiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tbXVsdGktYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb250aW51ZSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcGx1c3BsdXMgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLW5lc3RlZC10ZXJuYXJ5ICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItZGVzdHJ1Y3R1cmluZyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuLyogZXNsaW50LWRpc2FibGUgdmFycy1vbi10b3AgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1zaGFkb3cgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4vKiBlc2xpbnQtZGlzYWJsZSBnbG9iYWwtcmVxdWlyZSAqL1xuLyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5pbXBvcnQgbWFpbldhc20gZnJvbSAnLi4vLi4vLi4vYnVpbGQvd2FzbS9tYWluLndhc20nO1xuXG5leHBvcnQgLyoqXG4gKiBXYXNtIG1vZHVsZSBnZW5lcmF0b3IuIFRoaXMgY29kZSBpcyBiYXNlZCBvbiBFbXNjcmlwdGVuIGRlZmF1bHQganMgdGVtcGxhdGUuXG4gKlxuICogQHJldHVybiB7Kn0gXG4gKi9cbmNvbnN0IFdhc21Nb2R1bGVHZW5lcmF0b3IgPSAod29ya2VyR2xvYmFsU2NvcGUgPSBudWxsKSA9PiB7XG4gICAgY29uc3QgTW9kdWxlID0ge307XG4gICAgbGV0IGFyZ3VtZW50c18gPSBbXTtcbiAgICBsZXQgdGhpc1Byb2dyYW0gPSBcIi4vdGhpcy5wcm9ncmFtXCI7XG4gICAgbGV0IHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgIHRocm93IHRvVGhyb3dcbiAgICB9O1xuICAgIGNvbnN0IEVOVklST05NRU5UX0lTX1dFQiA9IHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCI7XG4gICAgY29uc3QgRU5WSVJPTk1FTlRfSVNfV09SS0VSID0gdHlwZW9mIGltcG9ydFNjcmlwdHMgPT09IFwiZnVuY3Rpb25cIjtcbiAgICBjb25zdCBFTlZJUk9OTUVOVF9JU19OT0RFID0gdHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMubm9kZSA9PT0gXCJzdHJpbmdcIjtcbiAgICBsZXQgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcblxuICAgIGZ1bmN0aW9uIGxvY2F0ZUZpbGUocGF0aCkge1xuICAgICAgICBpZiAoTW9kdWxlLmxvY2F0ZUZpbGUpIHtcbiAgICAgICAgICAgIHJldHVybiBNb2R1bGUubG9jYXRlRmlsZShwYXRoLCBzY3JpcHREaXJlY3RvcnkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNjcmlwdERpcmVjdG9yeSArIHBhdGhcbiAgICB9XG4gICAgbGV0IHJlYWRfOyBsZXQgcmVhZEFzeW5jOyBsZXQgcmVhZEJpbmFyeTtcblxuICAgIGZ1bmN0aW9uIGxvZ0V4Y2VwdGlvbk9uRXhpdChlKSB7XG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXhpdFN0YXR1cykgcmV0dXJuO1xuICAgICAgICBjb25zdCB0b0xvZyA9IGU7XG4gICAgICAgIGVycihgZXhpdGluZyBkdWUgdG8gZXhjZXB0aW9uOiAkeyAgdG9Mb2d9YClcbiAgICB9XG4gICAgbGV0IG5vZGVGUztcbiAgICBsZXQgbm9kZVBhdGg7XG4gICAgaWYgKEVOVklST05NRU5UX0lTX05PREUpIHtcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gYCR7cmVxdWlyZShcInBhdGhcIikuZGlybmFtZShzY3JpcHREaXJlY3RvcnkpICB9L2BcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IGAke19fZGlybmFtZSAgfS9gXG4gICAgICAgIH1cbiAgICAgICAgcmVhZF8gPSBmdW5jdGlvbiBzaGVsbF9yZWFkKGZpbGVuYW1lLCBiaW5hcnkpIHtcbiAgICAgICAgICAgIGlmICghbm9kZUZTKSBub2RlRlMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICBpZiAoIW5vZGVQYXRoKSBub2RlUGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xuICAgICAgICAgICAgZmlsZW5hbWUgPSBub2RlUGF0aC5ub3JtYWxpemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIG5vZGVGUy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUsIGJpbmFyeSA/IG51bGwgOiBcInV0ZjhcIilcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZEJpbmFyeSA9IGZ1bmN0aW9uIHJlYWRCaW5hcnkoZmlsZW5hbWUpIHtcbiAgICAgICAgICAgIGxldCByZXQgPSByZWFkXyhmaWxlbmFtZSwgdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoIXJldC5idWZmZXIpIHtcbiAgICAgICAgICAgICAgICByZXQgPSBuZXcgVWludDhBcnJheShyZXQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhc3NlcnQocmV0LmJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRBc3luYyA9IGZ1bmN0aW9uIHJlYWRBc3luYyhmaWxlbmFtZSwgb25sb2FkLCBvbmVycm9yKSB7XG4gICAgICAgICAgICBpZiAoIW5vZGVGUykgbm9kZUZTID0gcmVxdWlyZShcImZzXCIpO1xuICAgICAgICAgICAgaWYgKCFub2RlUGF0aCkgbm9kZVBhdGggPSByZXF1aXJlKFwicGF0aFwiKTtcbiAgICAgICAgICAgIGZpbGVuYW1lID0gbm9kZVBhdGgubm9ybWFsaXplKGZpbGVuYW1lKTtcbiAgICAgICAgICAgIG5vZGVGUy5yZWFkRmlsZShmaWxlbmFtZSwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIG9uZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICBlbHNlIG9ubG9hZChkYXRhLmJ1ZmZlcilcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH07XG4gICAgICAgIGlmIChwcm9jZXNzLmFyZ3YubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhpc1Byb2dyYW0gPSBwcm9jZXNzLmFyZ3ZbMV0ucmVwbGFjZSgvXFxcXC9nLCBcIi9cIilcbiAgICAgICAgfVxuICAgICAgICBhcmd1bWVudHNfID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBNb2R1bGVcbiAgICAgICAgfVxuICAgICAgICBwcm9jZXNzLm9uKFwidW5jYXVnaHRFeGNlcHRpb25cIiwgKGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoIShleCBpbnN0YW5jZW9mIEV4aXRTdGF0dXMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHByb2Nlc3Mub24oXCJ1bmhhbmRsZWRSZWplY3Rpb25cIiwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhyb3cgcmVhc29uXG4gICAgICAgIH0pO1xuICAgICAgICBxdWl0XyA9IGZ1bmN0aW9uKHN0YXR1cywgdG9UaHJvdykge1xuICAgICAgICAgICAgaWYgKGtlZXBSdW50aW1lQWxpdmUoKSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3MuZXhpdENvZGUgPSBzdGF0dXM7XG4gICAgICAgICAgICAgICAgdGhyb3cgdG9UaHJvd1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nRXhjZXB0aW9uT25FeGl0KHRvVGhyb3cpO1xuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KHN0YXR1cylcbiAgICAgICAgfTtcbiAgICAgICAgTW9kdWxlLmluc3BlY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBcIltFbXNjcmlwdGVuIE1vZHVsZSBvYmplY3RdXCJcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoRU5WSVJPTk1FTlRfSVNfV0VCIHx8IEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1nbG9iYWxzXG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBzZWxmLmxvY2F0aW9uLmhyZWZcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIgJiYgZG9jdW1lbnQuY3VycmVudFNjcmlwdCkge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdC5zcmNcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NyaXB0RGlyZWN0b3J5LmluZGV4T2YoXCJibG9iOlwiKSAhPT0gMCkge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gc2NyaXB0RGlyZWN0b3J5LnN1YnN0cigwLCBzY3JpcHREaXJlY3RvcnkucmVwbGFjZSgvWz8jXS4qLywgXCJcIikubGFzdEluZGV4T2YoXCIvXCIpICsgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IFwiXCJcbiAgICAgICAgfVxuICAgICAgICByZWFkXyA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICAgICAgY29uc3QgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0O1xuICAgICAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG4gICAgICAgICAgICB4aHIuc2VuZChudWxsKTtcbiAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgIH07XG4gICAgICAgIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgIHJlYWRCaW5hcnkgPSBmdW5jdGlvbih1cmwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgeGhyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICAgICAgICAgICAgICB4aHIuc2VuZChudWxsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoeGhyLnJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlYWRBc3luYyA9IGZ1bmN0aW9uKHVybCwgb25sb2FkLCBvbmVycm9yKSB7XG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIHRydWUpO1xuICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICAgICAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwIHx8IHhoci5zdGF0dXMgPT09IDAgJiYgeGhyLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIG9ubG9hZCh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb25lcnJvcigpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgeGhyLm9uZXJyb3IgPSBvbmVycm9yO1xuICAgICAgICAgICAgeGhyLnNlbmQobnVsbClcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBvdXQgPSBNb2R1bGUucHJpbnQgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBjb25zdCBlcnIgPSBNb2R1bGUucHJpbnRFcnIgfHwgY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5cbiAgICBpZiAoTW9kdWxlLmFyZ3VtZW50cykgYXJndW1lbnRzXyA9IE1vZHVsZS5hcmd1bWVudHM7XG4gICAgaWYgKE1vZHVsZS50aGlzUHJvZ3JhbSkgdGhpc1Byb2dyYW0gPSBNb2R1bGUudGhpc1Byb2dyYW07XG4gICAgaWYgKE1vZHVsZS5xdWl0KSBxdWl0XyA9IE1vZHVsZS5xdWl0O1xuXG4gICAgZnVuY3Rpb24gYmFzZTY0VG9BcnJheUJ1ZmZlcihiYXNlNjQpIHtcbiAgICAgICAgbGV0IGJpbmFyeV9zdHJpbmcgPSAnJztcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX05PREUpIHtcbiAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSBCdWZmZXIuZnJvbShiYXNlNjQsICdiYXNlNjQnKS50b1N0cmluZygnYXNjaWknKTtcbiAgICAgICAgfSBlbHNlIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgICAgICBiaW5hcnlfc3RyaW5nID0gd29ya2VyR2xvYmFsU2NvcGUuYXRvYihiYXNlNjQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBiaW5hcnlfc3RyaW5nID0gd2luZG93LmF0b2IoYmFzZTY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgY29uc3QgbGVuID0gYmluYXJ5X3N0cmluZy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBieXRlc1tpXSA9IGJpbmFyeV9zdHJpbmcuY2hhckNvZGVBdChpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXMuYnVmZmVyO1xuICAgIH1cblxuICAgIGNvbnN0IHdhc21CaW5hcnkgPSBiYXNlNjRUb0FycmF5QnVmZmVyKG1haW5XYXNtKTtcbiAgICBjb25zdCBub0V4aXRSdW50aW1lID0gTW9kdWxlLm5vRXhpdFJ1bnRpbWUgfHwgdHJ1ZTtcbiAgICBpZiAodHlwZW9mIFdlYkFzc2VtYmx5ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIGFib3J0KFwibm8gbmF0aXZlIHdhc20gc3VwcG9ydCBkZXRlY3RlZFwiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldFZhbHVlKHB0ciwgdmFsdWUsIHR5cGUpIHtcbiAgICAgICAgdHlwZSA9IHR5cGUgfHwgXCJpOFwiO1xuICAgICAgICBpZiAodHlwZS5jaGFyQXQodHlwZS5sZW5ndGggLSAxKSA9PT0gXCIqXCIpIHR5cGUgPSBcImkzMlwiO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpMVwiOlxuICAgICAgICAgICAgICAgIEhFQVA4W3B0ciA+PiAwXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImk4XCI6XG4gICAgICAgICAgICAgICAgSEVBUDhbcHRyID4+IDBdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaTE2XCI6XG4gICAgICAgICAgICAgICAgSEVBUDE2W3B0ciA+PiAxXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImkzMlwiOlxuICAgICAgICAgICAgICAgIEhFQVAzMltwdHIgPj4gMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJpNjRcIjpcbiAgICAgICAgICAgICAgICB0ZW1wSTY0ID0gW1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA+Pj4gMCxcbiAgICAgICAgICAgICAgICAgICAgKHRlbXBEb3VibGUgPSB2YWx1ZSwgK01hdGguYWJzKHRlbXBEb3VibGUpID49IDEgPyB0ZW1wRG91YmxlID4gMCA/IChNYXRoLm1pbigrTWF0aC5mbG9vcih0ZW1wRG91YmxlIC8gNDI5NDk2NzI5NiksIDQyOTQ5NjcyOTUpIHwgMCkgPj4+IDAgOiB+fitNYXRoLmNlaWwoKHRlbXBEb3VibGUgLSArKH5+dGVtcERvdWJsZSA+Pj4gMCkpIC8gNDI5NDk2NzI5NikgPj4+IDAgOiAwKV07XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciA+PiAyXSA9IHRlbXBJNjRbMF07XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciArIDQgPj4gMl0gPSB0ZW1wSTY0WzFdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICAgICAgICAgICAgSEVBUEYzMltwdHIgPj4gMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgICAgICAgICAgICBIRUFQRjY0W3B0ciA+PiAzXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBhYm9ydChgaW52YWxpZCB0eXBlIGZvciBzZXRWYWx1ZTogJHsgIHR5cGV9YClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFZhbHVlKHB0ciwgdHlwZSkge1xuICAgICAgICB0eXBlID0gdHlwZSB8fCBcImk4XCI7XG4gICAgICAgIGlmICh0eXBlLmNoYXJBdCh0eXBlLmxlbmd0aCAtIDEpID09PSBcIipcIikgdHlwZSA9IFwiaTMyXCI7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImkxXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3B0ciA+PiAwXTtcbiAgICAgICAgICAgIGNhc2UgXCJpOFwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBIRUFQOFtwdHIgPj4gMF07XG4gICAgICAgICAgICBjYXNlIFwiaTE2XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAxNltwdHIgPj4gMV07XG4gICAgICAgICAgICBjYXNlIFwiaTMyXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiaTY0XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVAzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUEYzMltwdHIgPj4gMl07XG4gICAgICAgICAgICBjYXNlIFwiZG91YmxlXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcihIRUFQRjY0W3B0ciA+PiAzXSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFib3J0KGBpbnZhbGlkIHR5cGUgZm9yIGdldFZhbHVlOiAkeyAgdHlwZX1gKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIGxldCB3YXNtTWVtb3J5O1xuICAgIGxldCBBQk9SVCA9IGZhbHNlO1xuICAgIGxldCBFWElUU1RBVFVTO1xuXG4gICAgZnVuY3Rpb24gYXNzZXJ0KGNvbmRpdGlvbiwgdGV4dCkge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgICAgICAgYWJvcnQoYEFzc2VydGlvbiBmYWlsZWQ6ICR7ICB0ZXh0fWApXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRDRnVuYyhpZGVudCkge1xuICAgICAgICBjb25zdCBmdW5jID0gTW9kdWxlW2BfJHsgIGlkZW50fWBdO1xuICAgICAgICBhc3NlcnQoZnVuYywgYENhbm5vdCBjYWxsIHVua25vd24gZnVuY3Rpb24gJHsgIGlkZW50ICB9LCBtYWtlIHN1cmUgaXQgaXMgZXhwb3J0ZWRgKTtcbiAgICAgICAgcmV0dXJuIGZ1bmNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjY2FsbChpZGVudCwgcmV0dXJuVHlwZSwgYXJnVHlwZXMsIGFyZ3MpIHtcbiAgICAgICAgY29uc3QgdG9DID0ge1xuICAgICAgICAgICAgXCJzdHJpbmdcIjogZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJldCA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKHN0ciAhPT0gbnVsbCAmJiBzdHIgIT09IHVuZGVmaW5lZCAmJiBzdHIgIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGVuID0gKHN0ci5sZW5ndGggPDwgMikgKyAxO1xuICAgICAgICAgICAgICAgICAgICByZXQgPSBzdGFja0FsbG9jKGxlbik7XG4gICAgICAgICAgICAgICAgICAgIHN0cmluZ1RvVVRGOChzdHIsIHJldCwgbGVuKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCJhcnJheVwiOiBmdW5jdGlvbihhcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXQgPSBzdGFja0FsbG9jKGFyci5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIHdyaXRlQXJyYXlUb01lbW9yeShhcnIsIHJldCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNvbnZlcnRSZXR1cm5WYWx1ZShyZXQpIHtcbiAgICAgICAgICAgIGlmIChyZXR1cm5UeXBlID09PSBcInN0cmluZ1wiKSByZXR1cm4gVVRGOFRvU3RyaW5nKHJldCk7XG4gICAgICAgICAgICBpZiAocmV0dXJuVHlwZSA9PT0gXCJib29sZWFuXCIpIHJldHVybiBCb29sZWFuKHJldCk7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZnVuYyA9IGdldENGdW5jKGlkZW50KTtcbiAgICAgICAgY29uc3QgY0FyZ3MgPSBbXTtcbiAgICAgICAgbGV0IHN0YWNrID0gMDtcbiAgICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlciA9IHRvQ1thcmdUeXBlc1tpXV07XG4gICAgICAgICAgICAgICAgaWYgKGNvbnZlcnRlcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhY2sgPT09IDApIHN0YWNrID0gc3RhY2tTYXZlKCk7XG4gICAgICAgICAgICAgICAgICAgIGNBcmdzW2ldID0gY29udmVydGVyKGFyZ3NbaV0pXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY0FyZ3NbaV0gPSBhcmdzW2ldXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCByZXQgPSBmdW5jKC4uLmNBcmdzKTtcblxuICAgICAgICBmdW5jdGlvbiBvbkRvbmUocmV0KSB7XG4gICAgICAgICAgICBpZiAoc3RhY2sgIT09IDApIHN0YWNrUmVzdG9yZShzdGFjayk7XG4gICAgICAgICAgICByZXR1cm4gY29udmVydFJldHVyblZhbHVlKHJldClcbiAgICAgICAgfVxuICAgICAgICByZXQgPSBvbkRvbmUocmV0KTtcbiAgICAgICAgcmV0dXJuIHJldFxuICAgIH1cbiAgICBjb25zdCBVVEY4RGVjb2RlciA9IHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gXCJ1bmRlZmluZWRcIiA/IG5ldyBUZXh0RGVjb2RlcihcInV0ZjhcIikgOiB1bmRlZmluZWQ7XG5cbiAgICBmdW5jdGlvbiBVVEY4QXJyYXlUb1N0cmluZyhoZWFwLCBpZHgsIG1heEJ5dGVzVG9SZWFkKSB7XG4gICAgICAgIGNvbnN0IGVuZElkeCA9IGlkeCArIG1heEJ5dGVzVG9SZWFkO1xuICAgICAgICBsZXQgZW5kUHRyID0gaWR4O1xuICAgICAgICB3aGlsZSAoaGVhcFtlbmRQdHJdICYmICEoZW5kUHRyID49IGVuZElkeCkpICsrZW5kUHRyO1xuICAgICAgICBpZiAoZW5kUHRyIC0gaWR4ID4gMTYgJiYgaGVhcC5zdWJhcnJheSAmJiBVVEY4RGVjb2Rlcikge1xuICAgICAgICAgICAgcmV0dXJuIFVURjhEZWNvZGVyLmRlY29kZShoZWFwLnN1YmFycmF5KGlkeCwgZW5kUHRyKSlcbiAgICAgICAgfSBcbiAgICAgICAgICAgIGxldCBzdHIgPSBcIlwiO1xuICAgICAgICAgICAgd2hpbGUgKGlkeCA8IGVuZFB0cikge1xuICAgICAgICAgICAgICAgIGxldCB1MCA9IGhlYXBbaWR4KytdO1xuICAgICAgICAgICAgICAgIGlmICghKHUwICYgMTI4KSkge1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1MCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHUxID0gaGVhcFtpZHgrK10gJiA2MztcbiAgICAgICAgICAgICAgICBpZiAoKHUwICYgMjI0KSA9PT0gMTkyKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCh1MCAmIDMxKSA8PCA2IHwgdTEpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCB1MiA9IGhlYXBbaWR4KytdICYgNjM7XG4gICAgICAgICAgICAgICAgaWYgKCh1MCAmIDI0MCkgPT09IDIyNCkge1xuICAgICAgICAgICAgICAgICAgICB1MCA9ICh1MCAmIDE1KSA8PCAxMiB8IHUxIDw8IDYgfCB1MlxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHUwID0gKHUwICYgNykgPDwgMTggfCB1MSA8PCAxMiB8IHUyIDw8IDYgfCBoZWFwW2lkeCsrXSAmIDYzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh1MCA8IDY1NTM2KSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHUwKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoID0gdTAgLSA2NTUzNjtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoNTUyOTYgfCBjaCA+PiAxMCwgNTYzMjAgfCBjaCAmIDEwMjMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHN0clxuICAgIH1cblxuICAgIGZ1bmN0aW9uIFVURjhUb1N0cmluZyhwdHIsIG1heEJ5dGVzVG9SZWFkKSB7XG4gICAgICAgIHJldHVybiBwdHIgPyBVVEY4QXJyYXlUb1N0cmluZyhIRUFQVTgsIHB0ciwgbWF4Qnl0ZXNUb1JlYWQpIDogXCJcIlxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmluZ1RvVVRGOEFycmF5KHN0ciwgaGVhcCwgb3V0SWR4LCBtYXhCeXRlc1RvV3JpdGUpIHtcbiAgICAgICAgaWYgKCEobWF4Qnl0ZXNUb1dyaXRlID4gMCkpIHJldHVybiAwO1xuICAgICAgICBjb25zdCBzdGFydElkeCA9IG91dElkeDtcbiAgICAgICAgY29uc3QgZW5kSWR4ID0gb3V0SWR4ICsgbWF4Qnl0ZXNUb1dyaXRlIC0gMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCB1ID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAodSA+PSA1NTI5NiAmJiB1IDw9IDU3MzQzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdTEgPSBzdHIuY2hhckNvZGVBdCgrK2kpO1xuICAgICAgICAgICAgICAgIHUgPSA2NTUzNiArICgodSAmIDEwMjMpIDw8IDEwKSB8IHUxICYgMTAyM1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHUgPD0gMTI3KSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dElkeCA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gdVxuICAgICAgICAgICAgfSBlbHNlIGlmICh1IDw9IDIwNDcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ICsgMSA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTkyIHwgdSA+PiA2O1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSAmIDYzXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHUgPD0gNjU1MzUpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ICsgMiA+PSBlbmRJZHgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMjI0IHwgdSA+PiAxMjtcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDEyOCB8IHUgPj4gNiAmIDYzO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSAmIDYzXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAzID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAyNDAgfCB1ID4+IDE4O1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiAxMiAmIDYzO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiA2ICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBoZWFwW291dElkeF0gPSAwO1xuICAgICAgICByZXR1cm4gb3V0SWR4IC0gc3RhcnRJZHhcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJpbmdUb1VURjgoc3RyLCBvdXRQdHIsIG1heEJ5dGVzVG9Xcml0ZSkge1xuICAgICAgICByZXR1cm4gc3RyaW5nVG9VVEY4QXJyYXkoc3RyLCBIRUFQVTgsIG91dFB0ciwgbWF4Qnl0ZXNUb1dyaXRlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxlbmd0aEJ5dGVzVVRGOChzdHIpIHtcbiAgICAgICAgbGV0IGxlbiA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBsZXQgdSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgaWYgKHUgPj0gNTUyOTYgJiYgdSA8PSA1NzM0MykgdSA9IDY1NTM2ICsgKCh1ICYgMTAyMykgPDwgMTApIHwgc3RyLmNoYXJDb2RlQXQoKytpKSAmIDEwMjM7XG4gICAgICAgICAgICBpZiAodSA8PSAxMjcpICsrbGVuO1xuICAgICAgICAgICAgZWxzZSBpZiAodSA8PSAyMDQ3KSBsZW4gKz0gMjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHUgPD0gNjU1MzUpIGxlbiArPSAzO1xuICAgICAgICAgICAgZWxzZSBsZW4gKz0gNFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsZW5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGxvY2F0ZVVURjhPblN0YWNrKHN0cikge1xuICAgICAgICBjb25zdCBzaXplID0gbGVuZ3RoQnl0ZXNVVEY4KHN0cikgKyAxO1xuICAgICAgICBjb25zdCByZXQgPSBzdGFja0FsbG9jKHNpemUpO1xuICAgICAgICBzdHJpbmdUb1VURjhBcnJheShzdHIsIEhFQVA4LCByZXQsIHNpemUpO1xuICAgICAgICByZXR1cm4gcmV0XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd3JpdGVBcnJheVRvTWVtb3J5KGFycmF5LCBidWZmZXIpIHtcbiAgICAgICAgSEVBUDguc2V0KGFycmF5LCBidWZmZXIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWxpZ25VcCh4LCBtdWx0aXBsZSkge1xuICAgICAgICBpZiAoeCAlIG11bHRpcGxlID4gMCkge1xuICAgICAgICAgICAgeCArPSBtdWx0aXBsZSAtIHggJSBtdWx0aXBsZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4XG4gICAgfVxuICAgIGxldCBidWZmZXI7IGxldCBIRUFQODsgbGV0IEhFQVBVODsgbGV0IEhFQVAxNjsgbGV0IEhFQVBVMTY7IGxldCBIRUFQMzI7IGxldCBIRUFQVTMyOyBsZXQgSEVBUEYzMjsgbGV0IEhFQVBGNjQ7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyhidWYpIHtcbiAgICAgICAgYnVmZmVyID0gYnVmO1xuICAgICAgICBNb2R1bGUuSEVBUDggPSBIRUFQOCA9IG5ldyBJbnQ4QXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVAxNiA9IEhFQVAxNiA9IG5ldyBJbnQxNkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQMzIgPSBIRUFQMzIgPSBuZXcgSW50MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUFU4ID0gSEVBUFU4ID0gbmV3IFVpbnQ4QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICBNb2R1bGUuSEVBUFUxNiA9IEhFQVBVMTYgPSBuZXcgVWludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICBNb2R1bGUuSEVBUFUzMiA9IEhFQVBVMzIgPSBuZXcgVWludDMyQXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVBGMzIgPSBIRUFQRjMyID0gbmV3IEZsb2F0MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUEY2NCA9IEhFQVBGNjQgPSBuZXcgRmxvYXQ2NEFycmF5KGJ1ZilcbiAgICB9XG4gICAgbGV0IHdhc21UYWJsZTtcbiAgICBjb25zdCBfX0FUUFJFUlVOX18gPSBbXTtcbiAgICBjb25zdCBfX0FUSU5JVF9fID0gW107XG4gICAgY29uc3QgX19BVE1BSU5fXyA9IFtdO1xuICAgIGNvbnN0IF9fQVRQT1NUUlVOX18gPSBbXTtcbiAgICBjb25zdCBydW50aW1lS2VlcGFsaXZlQ291bnRlciA9IDA7XG5cbiAgICBmdW5jdGlvbiBrZWVwUnVudGltZUFsaXZlKCkge1xuICAgICAgICByZXR1cm4gbm9FeGl0UnVudGltZSB8fCBydW50aW1lS2VlcGFsaXZlQ291bnRlciA+IDBcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVSdW4oKSB7XG4gICAgICAgIGlmIChNb2R1bGUucHJlUnVuKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIE1vZHVsZS5wcmVSdW4gPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnByZVJ1biA9IFtNb2R1bGUucHJlUnVuXTtcbiAgICAgICAgICAgIHdoaWxlIChNb2R1bGUucHJlUnVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFkZE9uUHJlUnVuKE1vZHVsZS5wcmVSdW4uc2hpZnQoKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYWxsUnVudGltZUNhbGxiYWNrcyhfX0FUUFJFUlVOX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdFJ1bnRpbWUoKSB7XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRJTklUX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJlTWFpbigpIHtcbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVE1BSU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGl0UnVudGltZSgpIHtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwb3N0UnVuKCkge1xuICAgICAgICBpZiAoTW9kdWxlLnBvc3RSdW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnBvc3RSdW4gPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnBvc3RSdW4gPSBbTW9kdWxlLnBvc3RSdW5dO1xuICAgICAgICAgICAgd2hpbGUgKE1vZHVsZS5wb3N0UnVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFkZE9uUG9zdFJ1bihNb2R1bGUucG9zdFJ1bi5zaGlmdCgpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRQT1NUUlVOX18pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25QcmVSdW4oY2IpIHtcbiAgICAgICAgX19BVFBSRVJVTl9fLnVuc2hpZnQoY2IpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkT25Jbml0KGNiKSB7XG4gICAgICAgIF9fQVRJTklUX18udW5zaGlmdChjYilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPblBvc3RSdW4oY2IpIHtcbiAgICAgICAgX19BVFBPU1RSVU5fXy51bnNoaWZ0KGNiKVxuICAgIH1cbiAgICBsZXQgcnVuRGVwZW5kZW5jaWVzID0gMDtcbiAgICBsZXQgcnVuRGVwZW5kZW5jeVdhdGNoZXIgPSBudWxsO1xuICAgIGxldCBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBudWxsO1xuXG4gICAgZnVuY3Rpb24gYWRkUnVuRGVwZW5kZW5jeSgpIHtcbiAgICAgICAgcnVuRGVwZW5kZW5jaWVzKys7XG4gICAgICAgIGlmIChNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgTW9kdWxlLm1vbml0b3JSdW5EZXBlbmRlbmNpZXMocnVuRGVwZW5kZW5jaWVzKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlUnVuRGVwZW5kZW5jeSgpIHtcbiAgICAgICAgcnVuRGVwZW5kZW5jaWVzLS07XG4gICAgICAgIGlmIChNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgTW9kdWxlLm1vbml0b3JSdW5EZXBlbmRlbmNpZXMocnVuRGVwZW5kZW5jaWVzKVxuICAgICAgICB9XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPT09IDApIHtcbiAgICAgICAgICAgIGlmIChydW5EZXBlbmRlbmN5V2F0Y2hlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwocnVuRGVwZW5kZW5jeVdhdGNoZXIpO1xuICAgICAgICAgICAgICAgIHJ1bkRlcGVuZGVuY3lXYXRjaGVyID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRlcGVuZGVuY2llc0Z1bGZpbGxlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gZGVwZW5kZW5jaWVzRnVsZmlsbGVkO1xuICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIE1vZHVsZS5wcmVsb2FkZWRJbWFnZXMgPSB7fTtcbiAgICBNb2R1bGUucHJlbG9hZGVkQXVkaW9zID0ge307XG5cbiAgICBmdW5jdGlvbiBhYm9ydCh3aGF0KSB7XG4gICAgICAgIGlmIChNb2R1bGUub25BYm9ydCkge1xuICAgICAgICAgICAgTW9kdWxlLm9uQWJvcnQod2hhdClcbiAgICAgICAgfVxuICAgICAgICB3aGF0ID0gYEFib3J0ZWQoJHsgIHdoYXQgIH0pYDtcbiAgICAgICAgZXJyKHdoYXQpO1xuICAgICAgICBBQk9SVCA9IHRydWU7XG4gICAgICAgIEVYSVRTVEFUVVMgPSAxO1xuICAgICAgICB3aGF0ICs9IFwiLiBCdWlsZCB3aXRoIC1zIEFTU0VSVElPTlM9MSBmb3IgbW9yZSBpbmZvLlwiO1xuICAgICAgICBjb25zdCBlID0gbmV3IFdlYkFzc2VtYmx5LlJ1bnRpbWVFcnJvcih3aGF0KTtcbiAgICAgICAgdGhyb3cgZVxuICAgIH1cbiAgICBjb25zdCBkYXRhVVJJUHJlZml4ID0gXCJkYXRhOmFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbTtiYXNlNjQsXCI7XG5cbiAgICBmdW5jdGlvbiBpc0RhdGFVUkkoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lLnN0YXJ0c1dpdGgoZGF0YVVSSVByZWZpeClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0ZpbGVVUkkoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lLnN0YXJ0c1dpdGgoXCJmaWxlOi8vXCIpXG4gICAgfVxuICAgIGxldCB3YXNtQmluYXJ5RmlsZTtcbiAgICB3YXNtQmluYXJ5RmlsZSA9IG1haW5XYXNtO1xuICAgIGlmICghaXNEYXRhVVJJKHdhc21CaW5hcnlGaWxlKSkge1xuICAgICAgICB3YXNtQmluYXJ5RmlsZSA9IGxvY2F0ZUZpbGUod2FzbUJpbmFyeUZpbGUpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0QmluYXJ5KGZpbGUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChmaWxlID09PSB3YXNtQmluYXJ5RmlsZSAmJiB3YXNtQmluYXJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHdhc21CaW5hcnkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVhZEJpbmFyeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWFkQmluYXJ5KGZpbGUpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImJvdGggYXN5bmMgYW5kIHN5bmMgZmV0Y2hpbmcgb2YgdGhlIHdhc20gZmFpbGVkXCIpO1xuICAgICAgICAgICAgXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgYWJvcnQoZXJyKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCaW5hcnlQcm9taXNlKCkge1xuICAgICAgICBpZiAoIXdhc21CaW5hcnkgJiYgKEVOVklST05NRU5UX0lTX1dFQiB8fCBFTlZJUk9OTUVOVF9JU19XT1JLRVIpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZldGNoID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzRmlsZVVSSSh3YXNtQmluYXJ5RmlsZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2god2FzbUJpbmFyeUZpbGUsIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIlxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGxvYWQgd2FzbSBiaW5hcnkgZmlsZSBhdCAnJHsgIHdhc21CaW5hcnlGaWxlICB9J2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5hcnJheUJ1ZmZlcigpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gZ2V0QmluYXJ5KHdhc21CaW5hcnlGaWxlKSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgaWYgKHJlYWRBc3luYykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZEFzeW5jKHdhc21CaW5hcnlGaWxlLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG5ldyBVaW50OEFycmF5KHJlc3BvbnNlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIHJlamVjdClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiBnZXRCaW5hcnkod2FzbUJpbmFyeUZpbGUpKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVdhc20oKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICBcImVudlwiOiBhc21MaWJyYXJ5QXJnLFxuICAgICAgICAgICAgXCJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxXCI6IGFzbUxpYnJhcnlBcmdcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiByZWNlaXZlSW5zdGFuY2UoaW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHtleHBvcnRzfSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgTW9kdWxlLmFzbSA9IGV4cG9ydHM7XG4gICAgICAgICAgICB3YXNtTWVtb3J5ID0gTW9kdWxlLmFzbS5tZW1vcnk7XG4gICAgICAgICAgICB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyh3YXNtTWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgICAgICB3YXNtVGFibGUgPSBNb2R1bGUuYXNtLl9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGU7XG4gICAgICAgICAgICBhZGRPbkluaXQoTW9kdWxlLmFzbS5fX3dhc21fY2FsbF9jdG9ycyk7XG4gICAgICAgICAgICByZW1vdmVSdW5EZXBlbmRlbmN5KFwid2FzbS1pbnN0YW50aWF0ZVwiKVxuICAgICAgICB9XG4gICAgICAgIGFkZFJ1bkRlcGVuZGVuY3koXCJ3YXNtLWluc3RhbnRpYXRlXCIpO1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KHJlc3VsdCkge1xuICAgICAgICAgICAgcmVjZWl2ZUluc3RhbmNlKHJlc3VsdC5pbnN0YW5jZSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluc3RhbnRpYXRlQXJyYXlCdWZmZXIocmVjZWl2ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRCaW5hcnlQcm9taXNlKCkudGhlbigoYmluYXJ5KSA9PiBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShiaW5hcnksIGluZm8pKS50aGVuKChpbnN0YW5jZSkgPT4gaW5zdGFuY2UpLnRoZW4ocmVjZWl2ZXIsIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICBlcnIoYGZhaWxlZCB0byBhc3luY2hyb25vdXNseSBwcmVwYXJlIHdhc206ICR7ICByZWFzb259YCk7XG4gICAgICAgICAgICAgICAgYWJvcnQocmVhc29uKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluc3RhbnRpYXRlQXN5bmMoKSB7XG4gICAgICAgICAgICBpZiAoIXdhc21CaW5hcnkgJiYgdHlwZW9mIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzRGF0YVVSSSh3YXNtQmluYXJ5RmlsZSkgJiYgIWlzRmlsZVVSSSh3YXNtQmluYXJ5RmlsZSkgJiYgdHlwZW9mIGZldGNoID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2god2FzbUJpbmFyeUZpbGUsIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlZGVudGlhbHM6IFwic2FtZS1vcmlnaW5cIlxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nKHJlc3BvbnNlLCBpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC50aGVuKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0LCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoYHdhc20gc3RyZWFtaW5nIGNvbXBpbGUgZmFpbGVkOiAkeyAgcmVhc29ufWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyKFwiZmFsbGluZyBiYWNrIHRvIEFycmF5QnVmZmVyIGluc3RhbnRpYXRpb25cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlSW5zdGFudGlhdGlvblJlc3VsdClcbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIGlmIChNb2R1bGUuaW5zdGFudGlhdGVXYXNtKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cG9ydHMgPSBNb2R1bGUuaW5zdGFudGlhdGVXYXNtKGluZm8sIHJlY2VpdmVJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cG9ydHNcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBlcnIoYE1vZHVsZS5pbnN0YW50aWF0ZVdhc20gY2FsbGJhY2sgZmFpbGVkIHdpdGggZXJyb3I6ICR7ICBlfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGluc3RhbnRpYXRlQXN5bmMoKTtcbiAgICAgICAgcmV0dXJuIHt9XG4gICAgfVxuICAgIGxldCB0ZW1wRG91YmxlO1xuICAgIGxldCB0ZW1wSTY0O1xuXG4gICAgZnVuY3Rpb24gY2FsbFJ1bnRpbWVDYWxsYmFja3MoY2FsbGJhY2tzKSB7XG4gICAgICAgIHdoaWxlIChjYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBjYWxsYmFja3Muc2hpZnQoKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKE1vZHVsZSk7XG4gICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHtmdW5jfSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmFyZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFdhc21UYWJsZUVudHJ5KGZ1bmMpKClcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBnZXRXYXNtVGFibGVFbnRyeShmdW5jKShjYWxsYmFjay5hcmcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmdW5jKGNhbGxiYWNrLmFyZyA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGNhbGxiYWNrLmFyZylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHdhc21UYWJsZU1pcnJvciA9IFtdO1xuXG4gICAgZnVuY3Rpb24gZ2V0V2FzbVRhYmxlRW50cnkoZnVuY1B0cikge1xuICAgICAgICBsZXQgZnVuYyA9IHdhc21UYWJsZU1pcnJvcltmdW5jUHRyXTtcbiAgICAgICAgaWYgKCFmdW5jKSB7XG4gICAgICAgICAgICBpZiAoZnVuY1B0ciA+PSB3YXNtVGFibGVNaXJyb3IubGVuZ3RoKSB3YXNtVGFibGVNaXJyb3IubGVuZ3RoID0gZnVuY1B0ciArIDE7XG4gICAgICAgICAgICB3YXNtVGFibGVNaXJyb3JbZnVuY1B0cl0gPSBmdW5jID0gd2FzbVRhYmxlLmdldChmdW5jUHRyKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlRXhjZXB0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFeGl0U3RhdHVzIHx8IGUgPT09IFwidW53aW5kXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBFWElUU1RBVFVTXG4gICAgICAgIH1cbiAgICAgICAgcXVpdF8oMSwgZSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19hc3NlcnRfZmFpbChjb25kaXRpb24sIGZpbGVuYW1lLCBsaW5lLCBmdW5jKSB7XG4gICAgICAgIGFib3J0KGBBc3NlcnRpb24gZmFpbGVkOiAkeyAgVVRGOFRvU3RyaW5nKGNvbmRpdGlvbikgIH0sIGF0OiAkeyAgW2ZpbGVuYW1lID8gVVRGOFRvU3RyaW5nKGZpbGVuYW1lKSA6IFwidW5rbm93biBmaWxlbmFtZVwiLCBsaW5lLCBmdW5jID8gVVRGOFRvU3RyaW5nKGZ1bmMpIDogXCJ1bmtub3duIGZ1bmN0aW9uXCJdfWApXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbihzaXplKSB7XG4gICAgICAgIHJldHVybiBfbWFsbG9jKHNpemUgKyAxNikgKyAxNlxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hdGV4aXQoKSB7fVxuXG4gICAgZnVuY3Rpb24gX19fY3hhX2F0ZXhpdChhMCwgYTEpIHtcbiAgICAgICAgcmV0dXJuIF9hdGV4aXQoYTAsIGExKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIEV4Y2VwdGlvbkluZm8oZXhjUHRyKSB7XG4gICAgICAgIHRoaXMuZXhjUHRyID0gZXhjUHRyO1xuICAgICAgICB0aGlzLnB0ciA9IGV4Y1B0ciAtIDE2O1xuICAgICAgICB0aGlzLnNldF90eXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyICsgNCA+PiAyXSA9IHR5cGVcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfdHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVAzMlt0aGlzLnB0ciArIDQgPj4gMl1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uKGRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciArIDggPj4gMl0gPSBkZXN0cnVjdG9yXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X2Rlc3RydWN0b3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBIRUFQMzJbdGhpcy5wdHIgKyA4ID4+IDJdXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0X3JlZmNvdW50ID0gZnVuY3Rpb24ocmVmY291bnQpIHtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciA+PiAyXSA9IHJlZmNvdW50XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2V0X2NhdWdodCA9IGZ1bmN0aW9uKGNhdWdodCkge1xuICAgICAgICAgICAgY2F1Z2h0ID0gY2F1Z2h0ID8gMSA6IDA7XG4gICAgICAgICAgICBIRUFQOFt0aGlzLnB0ciArIDEyID4+IDBdID0gY2F1Z2h0XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X2NhdWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3RoaXMucHRyICsgMTIgPj4gMF0gIT09IDBcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfcmV0aHJvd24gPSBmdW5jdGlvbihyZXRocm93bikge1xuICAgICAgICAgICAgcmV0aHJvd24gPSByZXRocm93biA/IDEgOiAwO1xuICAgICAgICAgICAgSEVBUDhbdGhpcy5wdHIgKyAxMyA+PiAwXSA9IHJldGhyb3duXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ2V0X3JldGhyb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDhbdGhpcy5wdHIgKyAxMyA+PiAwXSAhPT0gMFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmluaXQgPSBmdW5jdGlvbih0eXBlLCBkZXN0cnVjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLnNldF90eXBlKHR5cGUpO1xuICAgICAgICAgICAgdGhpcy5zZXRfZGVzdHJ1Y3RvcihkZXN0cnVjdG9yKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X3JlZmNvdW50KDApO1xuICAgICAgICAgICAgdGhpcy5zZXRfY2F1Z2h0KGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0X3JldGhyb3duKGZhbHNlKVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZF9yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gSEVBUDMyW3RoaXMucHRyID4+IDJdO1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyID4+IDJdID0gdmFsdWUgKyAxXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMucmVsZWFzZV9yZWYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXYgPSBIRUFQMzJbdGhpcy5wdHIgPj4gMl07XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgPj4gMl0gPSBwcmV2IC0gMTtcbiAgICAgICAgICAgIHJldHVybiBwcmV2ID09PSAxXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfdGhyb3cocHRyLCB0eXBlLCBkZXN0cnVjdG9yKSB7XG4gICAgICAgIGNvbnN0IGluZm8gPSBuZXcgRXhjZXB0aW9uSW5mbyhwdHIpO1xuICAgICAgICBpbmZvLmluaXQodHlwZSwgZGVzdHJ1Y3Rvcik7XG4gICAgICAgIHRocm93IHB0clxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9hYm9ydCgpIHtcbiAgICAgICAgYWJvcnQoXCJcIilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZW1zY3JpcHRlbl9tZW1jcHlfYmlnKGRlc3QsIHNyYywgbnVtKSB7XG4gICAgICAgIEhFQVBVOC5jb3B5V2l0aGluKGRlc3QsIHNyYywgc3JjICsgbnVtKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIoc2l6ZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2FzbU1lbW9yeS5ncm93KHNpemUgLSBidWZmZXIuYnl0ZUxlbmd0aCArIDY1NTM1ID4+PiAxNik7XG4gICAgICAgICAgICB1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyh3YXNtTWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gMVxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHlcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZW1zY3JpcHRlbl9yZXNpemVfaGVhcChyZXF1ZXN0ZWRTaXplKSB7XG4gICAgICAgIGNvbnN0IG9sZFNpemUgPSBIRUFQVTgubGVuZ3RoO1xuICAgICAgICByZXF1ZXN0ZWRTaXplID4+Pj0gMDtcbiAgICAgICAgY29uc3QgbWF4SGVhcFNpemUgPSAyMTQ3NDgzNjQ4O1xuICAgICAgICBpZiAocmVxdWVzdGVkU2l6ZSA+IG1heEhlYXBTaXplKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjdXREb3duID0gMTsgY3V0RG93biA8PSA0OyBjdXREb3duICo9IDIpIHtcbiAgICAgICAgICAgIGxldCBvdmVyR3Jvd25IZWFwU2l6ZSA9IG9sZFNpemUgKiAoMSArIC4yIC8gY3V0RG93bik7XG4gICAgICAgICAgICBvdmVyR3Jvd25IZWFwU2l6ZSA9IE1hdGgubWluKG92ZXJHcm93bkhlYXBTaXplLCByZXF1ZXN0ZWRTaXplICsgMTAwNjYzMjk2KTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NpemUgPSBNYXRoLm1pbihtYXhIZWFwU2l6ZSwgYWxpZ25VcChNYXRoLm1heChyZXF1ZXN0ZWRTaXplLCBvdmVyR3Jvd25IZWFwU2l6ZSksIDY1NTM2KSk7XG4gICAgICAgICAgICBjb25zdCByZXBsYWNlbWVudCA9IGVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIobmV3U2l6ZSk7XG4gICAgICAgICAgICBpZiAocmVwbGFjZW1lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCBTWVNDQUxMUyA9IHtcbiAgICAgICAgbWFwcGluZ3M6IHt9LFxuICAgICAgICBidWZmZXJzOiBbbnVsbCwgW10sXG4gICAgICAgICAgICBbXVxuICAgICAgICBdLFxuICAgICAgICBwcmludENoYXIoc3RyZWFtLCBjdXJyKSB7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBTWVNDQUxMUy5idWZmZXJzW3N0cmVhbV07XG4gICAgICAgICAgICBpZiAoY3VyciA9PT0gMCB8fCBjdXJyID09PSAxMCkge1xuICAgICAgICAgICAgICAgIChzdHJlYW0gPT09IDEgPyBvdXQgOiBlcnIpKFVURjhBcnJheVRvU3RyaW5nKGJ1ZmZlciwgMCkpO1xuICAgICAgICAgICAgICAgIGJ1ZmZlci5sZW5ndGggPSAwXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ1ZmZlci5wdXNoKGN1cnIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHZhcmFyZ3M6IHVuZGVmaW5lZCxcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgICAgU1lTQ0FMTFMudmFyYXJncyArPSA0O1xuICAgICAgICAgICAgY29uc3QgcmV0ID0gSEVBUDMyW1NZU0NBTExTLnZhcmFyZ3MgLSA0ID4+IDJdO1xuICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICB9LFxuICAgICAgICBnZXRTdHIocHRyKSB7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBVVEY4VG9TdHJpbmcocHRyKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0NjQobG93KSB7XG4gICAgICAgICAgICByZXR1cm4gbG93XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gX2ZkX3dyaXRlKGZkLCBpb3YsIGlvdmNudCwgcG51bSkge1xuICAgICAgICBsZXQgbnVtID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpb3ZjbnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcHRyID0gSEVBUDMyW2lvdiA+PiAyXTtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IEhFQVAzMltpb3YgKyA0ID4+IDJdO1xuICAgICAgICAgICAgaW92ICs9IDg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgU1lTQ0FMTFMucHJpbnRDaGFyKGZkLCBIRUFQVThbcHRyICsgal0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBudW0gKz0gbGVuXG4gICAgICAgIH1cbiAgICAgICAgSEVBUDMyW3BudW0gPj4gMl0gPSBudW07XG4gICAgICAgIHJldHVybiAwXG4gICAgfVxuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgIGZ1bmN0aW9uIF9zZXRUZW1wUmV0MCh2YWwpIHtcbiAgICAgICAgLy8gc2V0VGVtcFJldDAodmFsKVxuICAgIH1cbiAgICBjb25zdCBhc21MaWJyYXJ5QXJnID0ge1xuICAgICAgICBcIl9fYXNzZXJ0X2ZhaWxcIjogX19fYXNzZXJ0X2ZhaWwsXG4gICAgICAgIFwiX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uXCI6IF9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24sXG4gICAgICAgIFwiX19jeGFfYXRleGl0XCI6IF9fX2N4YV9hdGV4aXQsXG4gICAgICAgIFwiX19jeGFfdGhyb3dcIjogX19fY3hhX3Rocm93LFxuICAgICAgICBcImFib3J0XCI6IF9hYm9ydCxcbiAgICAgICAgXCJlbXNjcmlwdGVuX21lbWNweV9iaWdcIjogX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZyxcbiAgICAgICAgXCJlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwXCI6IF9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwLFxuICAgICAgICBcImZkX3dyaXRlXCI6IF9mZF93cml0ZSxcbiAgICAgICAgXCJzZXRUZW1wUmV0MFwiOiBfc2V0VGVtcFJldDBcbiAgICB9O1xuICAgIGNyZWF0ZVdhc20oKTtcbiAgICBsZXQgX19fd2FzbV9jYWxsX2N0b3JzID0gTW9kdWxlLl9fX3dhc21fY2FsbF9jdG9ycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9fX3dhc21fY2FsbF9jdG9ycyA9IE1vZHVsZS5fX193YXNtX2NhbGxfY3RvcnMgPSBNb2R1bGUuYXNtLl9fd2FzbV9jYWxsX2N0b3JzKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX21haW4gPSBNb2R1bGUuX21haW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfbWFpbiA9IE1vZHVsZS5fbWFpbiA9IE1vZHVsZS5hc20ubWFpbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9jcmVhdGVUZXh0dXJlID0gTW9kdWxlLl9jcmVhdGVUZXh0dXJlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuYXNtLmNyZWF0ZVRleHR1cmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfY3JlYXRlQm91bmRpbmcgPSBNb2R1bGUuX2NyZWF0ZUJvdW5kaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2NyZWF0ZUJvdW5kaW5nID0gTW9kdWxlLl9jcmVhdGVCb3VuZGluZyA9IE1vZHVsZS5hc20uY3JlYXRlQm91bmRpbmcpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfc2V0Q2FtZXJhID0gTW9kdWxlLl9zZXRDYW1lcmEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfc2V0Q2FtZXJhID0gTW9kdWxlLl9zZXRDYW1lcmEgPSBNb2R1bGUuYXNtLnNldENhbWVyYSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9yZWFkU3RyZWFtID0gTW9kdWxlLl9yZWFkU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX3JlYWRTdHJlYW0gPSBNb2R1bGUuX3JlYWRTdHJlYW0gPSBNb2R1bGUuYXNtLnJlYWRTdHJlYW0pLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfcGF0aFRyYWNlciA9IE1vZHVsZS5fcGF0aFRyYWNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9wYXRoVHJhY2VyID0gTW9kdWxlLl9wYXRoVHJhY2VyID0gTW9kdWxlLmFzbS5wYXRoVHJhY2VyKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX19fZXJybm9fbG9jYXRpb24gPSBNb2R1bGUuX19fZXJybm9fbG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5fX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5hc20uX19lcnJub19sb2NhdGlvbikuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IHN0YWNrU2F2ZSA9IE1vZHVsZS5zdGFja1NhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja1NhdmUgPSBNb2R1bGUuc3RhY2tTYXZlID0gTW9kdWxlLmFzbS5zdGFja1NhdmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBzdGFja1Jlc3RvcmUgPSBNb2R1bGUuc3RhY2tSZXN0b3JlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoc3RhY2tSZXN0b3JlID0gTW9kdWxlLnN0YWNrUmVzdG9yZSA9IE1vZHVsZS5hc20uc3RhY2tSZXN0b3JlKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgc3RhY2tBbGxvYyA9IE1vZHVsZS5zdGFja0FsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoc3RhY2tBbGxvYyA9IE1vZHVsZS5zdGFja0FsbG9jID0gTW9kdWxlLmFzbS5zdGFja0FsbG9jKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX21hbGxvYyA9IE1vZHVsZS5fbWFsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX21hbGxvYyA9IE1vZHVsZS5fbWFsbG9jID0gTW9kdWxlLmFzbS5tYWxsb2MpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfZnJlZSA9IE1vZHVsZS5fZnJlZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9mcmVlID0gTW9kdWxlLl9mcmVlID0gTW9kdWxlLmFzbS5mcmVlKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgZHluQ2FsbF9qaWppID0gTW9kdWxlLmR5bkNhbGxfamlqaSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKGR5bkNhbGxfamlqaSA9IE1vZHVsZS5keW5DYWxsX2ppamkgPSBNb2R1bGUuYXNtLmR5bkNhbGxfamlqaSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgTW9kdWxlLmNjYWxsID0gY2NhbGw7XG4gICAgTW9kdWxlLnNldFZhbHVlID0gc2V0VmFsdWU7XG4gICAgTW9kdWxlLmdldFZhbHVlID0gZ2V0VmFsdWU7XG4gICAgbGV0IGNhbGxlZFJ1bjtcblxuICAgIGZ1bmN0aW9uIEV4aXRTdGF0dXMoc3RhdHVzKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IFwiRXhpdFN0YXR1c1wiO1xuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBgUHJvZ3JhbSB0ZXJtaW5hdGVkIHdpdGggZXhpdCgkeyAgc3RhdHVzICB9KWA7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzXG4gICAgfVxuICAgIGxldCBjYWxsZWRNYWluID0gZmFsc2U7XG4gICAgZGVwZW5kZW5jaWVzRnVsZmlsbGVkID0gZnVuY3Rpb24gcnVuQ2FsbGVyKCkge1xuICAgICAgICBpZiAoIWNhbGxlZFJ1bikgcnVuKCk7XG4gICAgICAgIGlmICghY2FsbGVkUnVuKSBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBydW5DYWxsZXJcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gY2FsbE1haW4oYXJncykge1xuICAgICAgICBjb25zdCBlbnRyeUZ1bmN0aW9uID0gTW9kdWxlLl9tYWluO1xuICAgICAgICBhcmdzID0gYXJncyB8fCBbXTtcbiAgICAgICAgY29uc3QgYXJnYyA9IGFyZ3MubGVuZ3RoICsgMTtcbiAgICAgICAgY29uc3QgYXJndiA9IHN0YWNrQWxsb2MoKGFyZ2MgKyAxKSAqIDQpO1xuICAgICAgICBIRUFQMzJbYXJndiA+PiAyXSA9IGFsbG9jYXRlVVRGOE9uU3RhY2sodGhpc1Byb2dyYW0pO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IGFyZ2M7IGkrKykge1xuICAgICAgICAgICAgSEVBUDMyWyhhcmd2ID4+IDIpICsgaV0gPSBhbGxvY2F0ZVVURjhPblN0YWNrKGFyZ3NbaSAtIDFdKVxuICAgICAgICB9XG4gICAgICAgIEhFQVAzMlsoYXJndiA+PiAyKSArIGFyZ2NdID0gMDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IGVudHJ5RnVuY3Rpb24oYXJnYywgYXJndik7XG4gICAgICAgICAgICBleGl0KHJldCwgdHJ1ZSk7XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVFeGNlcHRpb24oZSlcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICAgICAgICAgIGNhbGxlZE1haW4gPSB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBydW4oYXJncykge1xuICAgICAgICBhcmdzID0gYXJncyB8fCBhcmd1bWVudHNfO1xuICAgICAgICBpZiAocnVuRGVwZW5kZW5jaWVzID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgcHJlUnVuKCk7XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRvUnVuKCkge1xuICAgICAgICAgICAgaWYgKGNhbGxlZFJ1bikgcmV0dXJuO1xuICAgICAgICAgICAgY2FsbGVkUnVuID0gdHJ1ZTtcbiAgICAgICAgICAgIE1vZHVsZS5jYWxsZWRSdW4gPSB0cnVlO1xuICAgICAgICAgICAgaWYgKEFCT1JUKSByZXR1cm47XG4gICAgICAgICAgICBpbml0UnVudGltZSgpO1xuICAgICAgICAgICAgcHJlTWFpbigpO1xuICAgICAgICAgICAgaWYgKE1vZHVsZS5vblJ1bnRpbWVJbml0aWFsaXplZCkgTW9kdWxlLm9uUnVudGltZUluaXRpYWxpemVkKCk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkUnVuTm93KSBjYWxsTWFpbihhcmdzKTtcbiAgICAgICAgICAgIHBvc3RSdW4oKVxuICAgICAgICB9XG4gICAgICAgIGlmIChNb2R1bGUuc2V0U3RhdHVzKSB7XG4gICAgICAgICAgICBNb2R1bGUuc2V0U3RhdHVzKFwiUnVubmluZy4uLlwiKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBNb2R1bGUuc2V0U3RhdHVzKFwiXCIpXG4gICAgICAgICAgICAgICAgfSwgMSk7XG4gICAgICAgICAgICAgICAgZG9SdW4oKVxuICAgICAgICAgICAgfSwgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvUnVuKClcbiAgICAgICAgfVxuICAgIH1cbiAgICBNb2R1bGUucnVuID0gcnVuO1xuXG4gICAgZnVuY3Rpb24gZXhpdChzdGF0dXMpIHtcbiAgICAgICAgRVhJVFNUQVRVUyA9IHN0YXR1cztcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWVtcHR5XG4gICAgICAgIGlmIChrZWVwUnVudGltZUFsaXZlKCkpIHt9IGVsc2Uge1xuICAgICAgICAgICAgZXhpdFJ1bnRpbWUoKVxuICAgICAgICB9XG4gICAgICAgIHByb2NFeGl0KHN0YXR1cylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jRXhpdChjb2RlKSB7XG4gICAgICAgIEVYSVRTVEFUVVMgPSBjb2RlO1xuICAgICAgICBpZiAoIWtlZXBSdW50aW1lQWxpdmUoKSkge1xuICAgICAgICAgICAgaWYgKE1vZHVsZS5vbkV4aXQpIE1vZHVsZS5vbkV4aXQoY29kZSk7XG4gICAgICAgICAgICBBQk9SVCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICBxdWl0Xyhjb2RlLCBuZXcgRXhpdFN0YXR1cyhjb2RlKSlcbiAgICB9XG4gICAgaWYgKE1vZHVsZS5wcmVJbml0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnByZUluaXQgPT09IFwiZnVuY3Rpb25cIikgTW9kdWxlLnByZUluaXQgPSBbTW9kdWxlLnByZUluaXRdO1xuICAgICAgICB3aGlsZSAoTW9kdWxlLnByZUluaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgTW9kdWxlLnByZUluaXQucG9wKCkoKVxuICAgICAgICB9XG4gICAgfVxuICAgIGxldCBzaG91bGRSdW5Ob3cgPSB0cnVlO1xuICAgIGlmIChNb2R1bGUubm9Jbml0aWFsUnVuKSBzaG91bGRSdW5Ob3cgPSBmYWxzZTtcbiAgICBydW4oKTtcblxuICAgIHJldHVybiBNb2R1bGU7XG59XG4iLG51bGwsbnVsbF0sIm5hbWVzIjpbIlJlbmRlcmVyIiwid2FzbU1hbmFnZXIiLCJwaXhlbERhdGEiLCJjYW1lcmFCdWYiLCJyZW5kZXJDdHgiLCJjb25zdHJ1Y3RvciIsImNyZWF0ZUJvdW5kIiwibW9kZWwiLCJjcmVhdGVCdWZmZXJzIiwidGV4dHVyZSIsIm1hdGVyaWFsIiwiaXNWYWxpZCIsImlkIiwiYnVmZmVyIiwiY2FsbEZ1bmN0aW9uIiwiY2FsbENyZWF0ZUJvdW5kaW5nIiwicG9zaXRpb25CdWZmZXIiLCJsZW5ndGgiLCJpbmRpY2llc0J1ZmZlciIsIm5vcm1hbEJ1ZmZlciIsInRleGNvb3JkQnVmZmVyIiwibWF0cml4QnVmZmVyIiwicmVuZGVyIiwiY2FudmFzIiwiY2FtZXJhIiwid2lkdGgiLCJoZWlnaHQiLCJjdHgiLCJnZXRDb250ZXh0IiwiY29uc29sZSIsImVycm9yIiwiaW1hZ2VkYXRhIiwiY3JlYXRlSW1hZ2VEYXRhIiwicGl4ZWxzIiwiZGF0YSIsInJlbGVhc2UiLCJjcmVhdGVCdWZmZXIiLCJzZXRBcnJheSIsImR1bXBBc0FycmF5IiwiY2FsbFNldENhbWVyYSIsInJlc3VsdCIsImNhbGxQYXRoVHJhY2VyIiwibG9nIiwicmVzdWx0MiIsImNhbGxSZWFkU3RyZWFtIiwicmVuZGVyZnVuYyIsInRpbWVyIiwic2V0SW50ZXJ2YWwiLCJpIiwiZ2V0IiwicHV0SW1hZ2VEYXRhIiwiY2xlYXJJbnRlcnZhbCIsInByZXBhcmVQYXJ0aWFsUmVuZGVyaW5nIiwiaW1hZ2VEYXRhIiwicGFydGlhbFJlbmRlcmluZyIsInVwZGF0ZSIsIlZlY3RvcjMiLCJ4IiwieSIsInoiLCJfeCIsIl95IiwiX3oiLCJzZXQiLCJsZW5ndGgyIiwiTWF0aCIsInNxcnQiLCJkaXN0YW5jZSIsImEiLCJhZGQiLCJzdWJ0cmFjdCIsIm11bHRpcGx5IiwiZGl2aWRlIiwiYXNzZXJ0Iiwibm9ybWFsaXplIiwiZG90IiwiY3Jvc3MiLCJlcXVhbCIsImNvcHkiLCJnZXRBcnJheSIsIkZsb2F0MzJBcnJheSIsIlZlY3RvcjQiLCJ3IiwiX3ciLCJNYXRyaXg0IiwibWF0cml4IiwibnVtQXJyYXkiLCJleWUiLCJlbXB0eSIsImZpbGwiLCJzY2FsZU1hdHJpeCIsInNjYWxlIiwidHJhbnNsYXRlTWF0cml4IiwibW92ZSIsIm0iLCJuIiwic3ViIiwibXVsIiwidHJhbnNwb3NlIiwiaW52ZXJzZSIsIm1hdCIsImIiLCJjIiwiZCIsImUiLCJmIiwiZyIsImgiLCJqIiwiayIsImwiLCJvIiwicCIsInEiLCJyIiwicyIsInQiLCJ1IiwidiIsIkEiLCJCIiwiaXZkIiwiRXJyb3IiLCJkZXN0IiwiZ2V0U2NhbGVSb3RhdGlvbk1hdHJpeCIsImdldFRyYW5zbGF0ZVZlY3RvciIsIlF1YXRlcm5pb24iLCJhbmdsZUF4aXMiLCJhbmdsZSIsIl9heGlzIiwiYXhpcyIsInNpbiIsImNvcyIsImV1bGFyQW5nbGUiLCJyb3QiLCJ4YyIsInhzIiwieWMiLCJ5cyIsInpjIiwienMiLCJmcm9tTWF0cml4IiwibTAwIiwibTEwIiwibTIwIiwibTAxIiwibTExIiwibTIxIiwibTAyIiwibTEyIiwibTIyIiwiZWxlbWVudCIsIm1heEluZGV4IiwibGVuIiwiVHJhbnNmb3JtIiwicm90YXRpb24iLCJwb3NpdGlvbiIsInRyYW5zbGF0ZSIsIk1vZGVsIiwiX3Bvc2l0aW9uIiwiX3Bvc2l0aW9uQnVmZmVyIiwiX25vcm1hbCIsIl9ub3JtYWxCdWZmZXIiLCJfdGV4Y29vcmQiLCJfdGV4Y29vcmRCdWZmZXIiLCJfaW5kaWNpZXMiLCJJbnQzMkFycmF5IiwiX2luZGljaWVzQnVmZmVyIiwiX2JvdW5kaW5nQm94IiwibWluIiwibWF4IiwiX21hdHJpeCIsIl9tYXRyaXhCdWZmZXIiLCJfdHJhbnNmb3JtIiwiX21hdGVyaWFsIiwiY3JlYXRlQm91bmRpbmdCb3giLCJwb3MiLCJ0cmFuc2Zvcm0iLCJub3JtYWwiLCJ0ZXhjb29yZCIsImluZGljaWVzIiwibWFuYWdlciIsImNvbmNhdCIsImJvdW5kaW5nQm94IiwiR0xURkxvYWRlciIsInJhd0pzb24iLCJsb2FkIiwidXJsIiwicmVzcG9uc2UiLCJmZXRjaCIsImhlYWRlcnMiLCJqc29uIiwiYW5hbGl6ZSIsIm5vZGVzIiwibWVzaGVzIiwiYWNjZXNzb3JzIiwiYnVmZmVyVmlld3MiLCJidWZmZXJzIiwiQXJyYXkiLCJpc0FycmF5Iiwibm9kZSIsInByaW1pdGl2ZXMiLCJwcmltaXRpdmUiLCJidWZQb3MiLCJhdHRyaWJ1dGVzIiwiUE9TSVRJT04iLCJidWZOb3JtIiwiTk9STUFMIiwiYnVmVGV4IiwiVEVYQ09PUkRfMCIsImJ1ZkluZCIsImluZGljZXMiLCJ1cmkiLCJ0cmFuc2xhdGlvbiIsImJsb2IiLCJhcnJheUJ1ZmZlciIsImJ5dGVPZmZzZXQiLCJieXRlTGVuZ3RoIiwiZnJvbSIsIkludDE2QXJyYXkiLCJNQVRFUklBTF9VTklGT1JNX0xFTkdUSCIsIk1hdGVyaWFsIiwiX21hdGVyaWFsQnVmZmVyIiwiY3JlYXRlT3B0aW9uQXJyYXkiLCJHbGFzcyIsIl9yaG8iLCJyaG8iLCJEaWZmdXNlIiwiY29sb3IiLCJDYW1lcmEiLCJfcG9zIiwiX2ZvcndhcmQiLCJfdG9wIiwiX3JpZ2h0IiwiX2Rpc3QiLCJ2aWV3QW5nbGUiLCJ0YW4iLCJmb3J3YXJkIiwicmlnaHQiLCJ0b3AiLCJkaXN0IiwiYXRhbiIsImxvb2tBdCIsInRvIiwiSU1BR0VfU0laRSIsIlRleHR1cmUiLCJpbWFnZSIsImltYWdlQXJyYXkiLCJ2YWxpZCIsIl9idWZmZXIiLCJzZXRUZXh0dXJlIiwiY252IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiZHJhd0ltYWdlIiwiZ2V0SW1hZ2VEYXRhIiwid2FzbSIsIldhc21CdWZmZXIiLCJfbW9kdWxlIiwiX2Jhc2UiLCJfdHlwZSIsIl9zdHJpZGUiLCJfbGVuZ3RoIiwidHlwZSIsIm1vZHVsZSIsInNpemUiLCJfbWFsbG9jIiwiaW5kZXgiLCJnZXRWYWx1ZSIsInZhbHVlIiwic2V0VmFsdWUiLCJhcnJheSIsImZvckVhY2giLCJnZXRQb2ludGVyIiwiX2ZyZWUiLCJXYXNtTW9kdWxlR2VuZXJhdG9yIiwid29ya2VyR2xvYmFsU2NvcGUiLCJNb2R1bGUiLCJhcmd1bWVudHNfIiwidGhpc1Byb2dyYW0iLCJxdWl0XyIsInN0YXR1cyIsInRvVGhyb3ciLCJFTlZJUk9OTUVOVF9JU19XRUIiLCJ3aW5kb3ciLCJFTlZJUk9OTUVOVF9JU19XT1JLRVIiLCJpbXBvcnRTY3JpcHRzIiwiRU5WSVJPTk1FTlRfSVNfTk9ERSIsInByb2Nlc3MiLCJ2ZXJzaW9ucyIsInNjcmlwdERpcmVjdG9yeSIsImxvY2F0ZUZpbGUiLCJwYXRoIiwicmVhZF8iLCJyZWFkQXN5bmMiLCJyZWFkQmluYXJ5IiwibG9nRXhjZXB0aW9uT25FeGl0IiwiRXhpdFN0YXR1cyIsInRvTG9nIiwiZXJyIiwibm9kZUZTIiwibm9kZVBhdGgiLCJyZXF1aXJlIiwiZGlybmFtZSIsIl9fZGlybmFtZSIsInNoZWxsX3JlYWQiLCJmaWxlbmFtZSIsImJpbmFyeSIsInJlYWRGaWxlU3luYyIsInJldCIsIlVpbnQ4QXJyYXkiLCJvbmxvYWQiLCJvbmVycm9yIiwicmVhZEZpbGUiLCJhcmd2IiwicmVwbGFjZSIsInNsaWNlIiwiZXhwb3J0cyIsIm9uIiwiZXgiLCJyZWFzb24iLCJrZWVwUnVudGltZUFsaXZlIiwiZXhpdENvZGUiLCJleGl0IiwiaW5zcGVjdCIsInNlbGYiLCJsb2NhdGlvbiIsImhyZWYiLCJjdXJyZW50U2NyaXB0Iiwic3JjIiwiaW5kZXhPZiIsInN1YnN0ciIsImxhc3RJbmRleE9mIiwieGhyIiwiWE1MSHR0cFJlcXVlc3QiLCJvcGVuIiwic2VuZCIsInJlc3BvbnNlVGV4dCIsInJlc3BvbnNlVHlwZSIsIm91dCIsInByaW50IiwiYmluZCIsInByaW50RXJyIiwid2FybiIsImFyZ3VtZW50cyIsInF1aXQiLCJiYXNlNjRUb0FycmF5QnVmZmVyIiwiYmFzZTY0IiwiYmluYXJ5X3N0cmluZyIsIkJ1ZmZlciIsInRvU3RyaW5nIiwiYXRvYiIsImJ5dGVzIiwiY2hhckNvZGVBdCIsIndhc21CaW5hcnkiLCJtYWluV2FzbSIsIm5vRXhpdFJ1bnRpbWUiLCJXZWJBc3NlbWJseSIsImFib3J0IiwicHRyIiwiY2hhckF0IiwiSEVBUDgiLCJIRUFQMTYiLCJIRUFQMzIiLCJ0ZW1wSTY0IiwidGVtcERvdWJsZSIsImFicyIsImZsb29yIiwiY2VpbCIsIkhFQVBGMzIiLCJIRUFQRjY0IiwiTnVtYmVyIiwid2FzbU1lbW9yeSIsIkFCT1JUIiwiRVhJVFNUQVRVUyIsImNvbmRpdGlvbiIsInRleHQiLCJnZXRDRnVuYyIsImlkZW50IiwiZnVuYyIsImNjYWxsIiwicmV0dXJuVHlwZSIsImFyZ1R5cGVzIiwiYXJncyIsInRvQyIsInN0ciIsInVuZGVmaW5lZCIsInN0YWNrQWxsb2MiLCJzdHJpbmdUb1VURjgiLCJhcnIiLCJ3cml0ZUFycmF5VG9NZW1vcnkiLCJjb252ZXJ0UmV0dXJuVmFsdWUiLCJVVEY4VG9TdHJpbmciLCJCb29sZWFuIiwiY0FyZ3MiLCJzdGFjayIsImNvbnZlcnRlciIsInN0YWNrU2F2ZSIsIm9uRG9uZSIsInN0YWNrUmVzdG9yZSIsIlVURjhEZWNvZGVyIiwiVGV4dERlY29kZXIiLCJVVEY4QXJyYXlUb1N0cmluZyIsImhlYXAiLCJpZHgiLCJtYXhCeXRlc1RvUmVhZCIsImVuZElkeCIsImVuZFB0ciIsInN1YmFycmF5IiwiZGVjb2RlIiwidTAiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJ1MSIsInUyIiwiY2giLCJIRUFQVTgiLCJzdHJpbmdUb1VURjhBcnJheSIsIm91dElkeCIsIm1heEJ5dGVzVG9Xcml0ZSIsInN0YXJ0SWR4Iiwib3V0UHRyIiwibGVuZ3RoQnl0ZXNVVEY4IiwiYWxsb2NhdGVVVEY4T25TdGFjayIsImFsaWduVXAiLCJtdWx0aXBsZSIsInVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzIiwiYnVmIiwiSW50OEFycmF5IiwiSEVBUFUxNiIsIlVpbnQxNkFycmF5IiwiSEVBUFUzMiIsIlVpbnQzMkFycmF5IiwiRmxvYXQ2NEFycmF5Iiwid2FzbVRhYmxlIiwiX19BVFBSRVJVTl9fIiwiX19BVElOSVRfXyIsIl9fQVRNQUlOX18iLCJfX0FUUE9TVFJVTl9fIiwicnVudGltZUtlZXBhbGl2ZUNvdW50ZXIiLCJwcmVSdW4iLCJhZGRPblByZVJ1biIsInNoaWZ0IiwiY2FsbFJ1bnRpbWVDYWxsYmFja3MiLCJpbml0UnVudGltZSIsInByZU1haW4iLCJwb3N0UnVuIiwiYWRkT25Qb3N0UnVuIiwiY2IiLCJ1bnNoaWZ0IiwiYWRkT25Jbml0IiwicnVuRGVwZW5kZW5jaWVzIiwiZGVwZW5kZW5jaWVzRnVsZmlsbGVkIiwiYWRkUnVuRGVwZW5kZW5jeSIsIm1vbml0b3JSdW5EZXBlbmRlbmNpZXMiLCJyZW1vdmVSdW5EZXBlbmRlbmN5IiwiY2FsbGJhY2siLCJwcmVsb2FkZWRJbWFnZXMiLCJwcmVsb2FkZWRBdWRpb3MiLCJ3aGF0Iiwib25BYm9ydCIsIlJ1bnRpbWVFcnJvciIsImRhdGFVUklQcmVmaXgiLCJpc0RhdGFVUkkiLCJzdGFydHNXaXRoIiwiaXNGaWxlVVJJIiwid2FzbUJpbmFyeUZpbGUiLCJnZXRCaW5hcnkiLCJmaWxlIiwiZ2V0QmluYXJ5UHJvbWlzZSIsImNyZWRlbnRpYWxzIiwidGhlbiIsIm9rIiwiY2F0Y2giLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNyZWF0ZVdhc20iLCJpbmZvIiwiYXNtTGlicmFyeUFyZyIsInJlY2VpdmVJbnN0YW5jZSIsImluc3RhbmNlIiwiYXNtIiwibWVtb3J5IiwiX19pbmRpcmVjdF9mdW5jdGlvbl90YWJsZSIsIl9fd2FzbV9jYWxsX2N0b3JzIiwicmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQiLCJpbnN0YW50aWF0ZUFycmF5QnVmZmVyIiwicmVjZWl2ZXIiLCJpbnN0YW50aWF0ZSIsImluc3RhbnRpYXRlQXN5bmMiLCJpbnN0YW50aWF0ZVN0cmVhbWluZyIsImluc3RhbnRpYXRlV2FzbSIsImNhbGxiYWNrcyIsImFyZyIsImdldFdhc21UYWJsZUVudHJ5Iiwid2FzbVRhYmxlTWlycm9yIiwiZnVuY1B0ciIsImhhbmRsZUV4Y2VwdGlvbiIsIl9fX2Fzc2VydF9mYWlsIiwibGluZSIsIl9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24iLCJfYXRleGl0IiwiX19fY3hhX2F0ZXhpdCIsImEwIiwiYTEiLCJFeGNlcHRpb25JbmZvIiwiZXhjUHRyIiwic2V0X3R5cGUiLCJnZXRfdHlwZSIsInNldF9kZXN0cnVjdG9yIiwiZGVzdHJ1Y3RvciIsImdldF9kZXN0cnVjdG9yIiwic2V0X3JlZmNvdW50IiwicmVmY291bnQiLCJzZXRfY2F1Z2h0IiwiY2F1Z2h0IiwiZ2V0X2NhdWdodCIsInNldF9yZXRocm93biIsInJldGhyb3duIiwiZ2V0X3JldGhyb3duIiwiaW5pdCIsImFkZF9yZWYiLCJyZWxlYXNlX3JlZiIsInByZXYiLCJfX19jeGFfdGhyb3ciLCJfYWJvcnQiLCJfZW1zY3JpcHRlbl9tZW1jcHlfYmlnIiwibnVtIiwiY29weVdpdGhpbiIsImVtc2NyaXB0ZW5fcmVhbGxvY19idWZmZXIiLCJncm93IiwiX2Vtc2NyaXB0ZW5fcmVzaXplX2hlYXAiLCJyZXF1ZXN0ZWRTaXplIiwib2xkU2l6ZSIsIm1heEhlYXBTaXplIiwiY3V0RG93biIsIm92ZXJHcm93bkhlYXBTaXplIiwibmV3U2l6ZSIsInJlcGxhY2VtZW50IiwiU1lTQ0FMTFMiLCJtYXBwaW5ncyIsInByaW50Q2hhciIsInN0cmVhbSIsImN1cnIiLCJwdXNoIiwidmFyYXJncyIsImdldFN0ciIsImdldDY0IiwibG93IiwiX2ZkX3dyaXRlIiwiZmQiLCJpb3YiLCJpb3ZjbnQiLCJwbnVtIiwiX3NldFRlbXBSZXQwIiwidmFsIiwiX19fd2FzbV9jYWxsX2N0b3JzIiwiYXBwbHkiLCJfbWFpbiIsIm1haW4iLCJfY3JlYXRlVGV4dHVyZSIsImNyZWF0ZVRleHR1cmUiLCJfY3JlYXRlQm91bmRpbmciLCJjcmVhdGVCb3VuZGluZyIsIl9zZXRDYW1lcmEiLCJzZXRDYW1lcmEiLCJfcmVhZFN0cmVhbSIsInJlYWRTdHJlYW0iLCJfcGF0aFRyYWNlciIsInBhdGhUcmFjZXIiLCJfX19lcnJub19sb2NhdGlvbiIsIl9fZXJybm9fbG9jYXRpb24iLCJtYWxsb2MiLCJmcmVlIiwiZHluQ2FsbF9qaWppIiwiY2FsbGVkUnVuIiwibmFtZSIsIm1lc3NhZ2UiLCJydW5DYWxsZXIiLCJydW4iLCJjYWxsTWFpbiIsImVudHJ5RnVuY3Rpb24iLCJhcmdjIiwiZG9SdW4iLCJvblJ1bnRpbWVJbml0aWFsaXplZCIsInNob3VsZFJ1bk5vdyIsInNldFN0YXR1cyIsInNldFRpbWVvdXQiLCJwcm9jRXhpdCIsImNvZGUiLCJvbkV4aXQiLCJwcmVJbml0IiwicG9wIiwibm9Jbml0aWFsUnVuIiwiV2FzbU1hbmFnZXIiLCJFdmVudFRhcmdldCIsImRpc3BhdGNoRXZlbnQiLCJFdmVudCIsImZ1bmNuYW1lIiwicmF3QXJncyIsIm1hcCIsIlZlY3RvcjIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7SUFLQTs7Ozs7O1VBTWFBO0lBQ0hDLEVBQUFBLFdBQVc7SUFFWEMsRUFBQUEsU0FBUyxHQUFzQixJQUF0QjtJQUVUQyxFQUFBQSxTQUFTLEdBQXNCLElBQXRCOztJQUdUQyxFQUFBQSxTQUFTLEdBTU4sSUFOTTtJQVFqQjs7Ozs7OztJQU1BQyxFQUFBQSxZQUFZSjtJQUNWLFNBQUtBLFdBQUwsR0FBbUJBLFdBQW5CO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNT0ssRUFBQUEsV0FBVyxDQUFDQyxLQUFEO0lBQ2hCQSxJQUFBQSxLQUFLLENBQUNDLGFBQU4sQ0FBb0IsS0FBS1AsV0FBekI7SUFFQSxVQUFNO0lBQUNRLE1BQUFBO0lBQUQsUUFBWUYsS0FBSyxDQUFDRyxRQUF4Qjs7SUFFQSxRQUFHRCxPQUFPLElBQUlBLE9BQU8sQ0FBQ0UsT0FBUixFQUFYLElBQWdDRixPQUFPLENBQUNHLEVBQVIsR0FBYSxDQUE3QyxJQUFrREgsT0FBTyxDQUFDSSxNQUE3RCxFQUFzRTtJQUNwRSxZQUFNRCxFQUFFLEdBQUcsS0FBS1gsV0FBTCxDQUFpQmEs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QUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBcEMsR0FBMENELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FObEMsRUFPakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxDQUFELENBQXJDLEdBQTJDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxDQUFELENBUG5DLEVBUWpCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQUFyQyxHQUEyQ0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQVJuQyxFQVNqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLEVBQUQsQ0FBcEMsR0FBMkNELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FUbkMsRUFVakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxFQUFELENBQXBDLEdBQTJDRCxD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
