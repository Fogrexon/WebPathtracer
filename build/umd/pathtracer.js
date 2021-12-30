
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

    const TEXTURE_SIZE = 1024;
    /**
     * Image renderer. pass model and render image.
     *
     * @export
     * @class Renderer
     */

    class Renderer {
      wasmManager;
      textureCanvas;
      isWorker;
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
        this.isWorker = typeof window === 'undefined';
        this.textureCanvas = this.isWorker ? new OffscreenCanvas(TEXTURE_SIZE, TEXTURE_SIZE) : document.createElement('canvas');
        this.textureCanvas.width = TEXTURE_SIZE;
        this.textureCanvas.height = TEXTURE_SIZE;
      }
      /**
       * Create BVH.
       *
       * @return {*}
       * @memberof Renderer
       */


      createBound(model) {
        model.createBuffers(this.wasmManager, this.textureCanvas);
        const {
          texture
        } = model.material;

        if (texture && texture.isValid() && texture.id < 0 && texture.buffer) {
          const id = this.wasmManager.callFunction('createTexture', texture.buffer);
          texture.id = id;
          model.material.createBuffers(this.wasmManager, this.textureCanvas);
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
          console.error('cannot get context');
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

    /* eslint-disable no-console */
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

    /* eslint-disable no-console */
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

    /* eslint-disable no-console */
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

      createBuffers(manager, canvas) {
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

        this._material.createBuffers(manager, canvas);
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
      } // eslint-disable-next-line @typescript-eslint/no-unused-vars


      createBuffers(manager, canvas) {
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

      createBuffers(manager, canvas) {
        var _this$texture;

        (_this$texture = this.texture) === null || _this$texture === void 0 ? void 0 : _this$texture.createBuffer(manager, canvas);
        super.createBuffers(manager, canvas);
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
      needsUpdate;
      imageArray = null;
      valid = false;
      _buffer = null;
      id = -1;

      get buffer() {
        return this._buffer;
      }

      constructor(image) {
        this.image = image || null;
        this.needsUpdate = true;
      }

      createPixelArray(canvas) {
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('cannot create texture.');
          return;
        }

        if (this.image) ctx.drawImage(this.image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
        this.imageArray = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
        this.valid = true;
      }

      createBuffer(wasm, canvas) {
        if (this.needsUpdate) this.createPixelArray(canvas);
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

    const loadWorkerImage = async url => {
      const imageResponse = await fetch(url);
      const imageBlob = await imageResponse.blob();
      return createImageBitmap(imageBlob);
    };

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

    var mainWasm = "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EEALIAIoArgCIgEEQCACIAE2ArwCIAEQQAsgAkEANgIQIAJCADcDCCACKALMAiACKALIAiIEayIBBEAgAUEASA0DIAIgARArIgM2AgggAiADNgIMIAIgAyABQQZ1QQZ0ajYCECACIAMgBCABEEggAWo2AgwLIAJBADYCHCACQgA3AhQgAigC2AIgAigC1AIiCWsiAUHIAG0hBCABBEAgBEHk8bgcTw0EIAIgARArIgM2AhQgAiADNgIYIAIgAyAEQcgAbGo2AhwgAiABQQBKBH8gAyAJIAEQSCABQcgAbkHIAGxqBSADCzYCGAsgAkEgaiAKQYABEEghCiACQaABaiAAQYABEEgaIAIgBTYCoAICQEH07AAoAgAiAUH47AAoAgBHBEAgAUEANgIIIAFCADcCACACKAIMIAIoAghrIgQEQCAEQQBIDQcgASAEECsiAzYCACABIAM2AgQgASADIARBBnVBBnRqNgIIIAEgAigCDCACKAIIIgBrIgRBAEoEfyADIAAgBBBIIARqBSADCzYCBAsgAUIANwIMIAFBADYCFCACKAIYIAIoAhRrIgNByABtIQQgAwRAIARB5PG4HE8NCCABIAMQKyIDNgIMIAEgAzYCECABIAMgBEHIAGxqNgIUIAEgAigCGCACKAIUIgBrIgRBAEoEfyADIAAgBBBIIARByABuQcgAbGoFIAMLNgIQCyABQRhqIApBhAIQSBpB9OwAIAFBoAJqNgIADAELIAJBCGohBAJAAkACQEH07AAoAgBB8OwAKAIAIgBrQaACbSIDQQFqIgFBuZyOB0kEQCABQfjsACgCACAAa0GgAm0iAEEBdCIKIAEgCksbQbicjgcgAEGcjscDSRsiAQR/IAFBuZyOB08NAiABQaACbBArBUEACyIKIANBoAJsaiIAQQA2AgggAEIANwIAAkACQAJAIAQiAygCBCADKAIAayIJBEAgCUEASA0BIAAgCRArIgU2AgAgACAFNgIEIAAgBSAJQQZ1QQZ0ajYCCCAAIAMoAgQgAygCACIMayIJQQBKBH8gBSAMIAkQSCAJagUgBQs2AgQLIABCADcCDCAAQQA2AhQgAygCECADKAIMayIFQcgAbSEJIAUEQCAJQeTxuBxPDQIgACAFECsiBTYCDCAAIAU2AhAgACAFIAlByABsajYCFCAAIAMoAhAgAygCDCIJ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";

    /* eslint-disable prefer-rest-params */
    const WasmModuleGenerator = () => {
      const Module = {};
      let arguments_ = [];
      let thisProgram = "./this.program";

      let quit_ = function (status, toThrow) {
        throw toThrow;
      };

      const ENVIRONMENT_IS_WEB = typeof window === "object";
      const ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
      const ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
      let scriptDirectory = ""; // eslint-disable-next-line no-restricted-globals

      const workerGlobalScope = ENVIRONMENT_IS_WORKER ? self : null;

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

    /* eslint-disable no-console */
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
    exports.loadWorkerImage = loadWorkerImage;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aHRyYWNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvcmVuZGVyZXIvUmVuZGVyZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IzLnRzIiwiLi4vLi4vc3JjL21hdGgvVmVjdG9yNC50cyIsIi4uLy4uL3NyYy9tYXRoL01hdHJpeDQudHMiLCIuLi8uLi9zcmMvbWF0aC9RdWF0ZXJuaW9uLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvVHJhbnNmb3JtLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTW9kZWwudHMiLCIuLi8uLi9zcmMvY29yZS9tb2RlbC9HTFRGTG9hZGVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvbWF0ZXJpYWwvTWF0ZXJpYWwudHMiLCIuLi8uLi9zcmMvY29yZS9tYXRlcmlhbC9HbGFzcy50cyIsIi4uLy4uL3NyYy9jb3JlL21hdGVyaWFsL0RpZmZ1c2UudHMiLCIuLi8uLi9zcmMvY29yZS9jYW1lcmEvQ2FtZXJhLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9UZXh0dXJlLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9Xb3JrZXJJbWFnZS50cyIsIi4uLy4uL3NyYy9jb3JlL3dhc20vV2FzbUJ1ZmZlci50cyIsIi4uLy4uL3NyYy9jb3JlL3dhc20vV2FzbU1vZHVsZS5qcyIsIi4uLy4uL3NyYy9jb3JlL3dhc20vV2FzbU1hbmFnZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsIi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1yZXN0LXBhcmFtcyAqL1xuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItc3ByZWFkICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1yZXR1cm4tYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBjb25zaXN0ZW50LXJldHVybiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tbXVsdGktYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb250aW51ZSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcGx1c3BsdXMgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLW5lc3RlZC10ZXJuYXJ5ICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItZGVzdHJ1Y3R1cmluZyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuLyogZXNsaW50LWRpc2FibGUgdmFycy1vbi10b3AgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1zaGFkb3cgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4vKiBlc2xpbnQtZGlzYWJsZSBnbG9iYWwtcmVxdWlyZSAqL1xuLyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5pbXBvcnQgbWFpbldhc20gZnJvbSAnLi4vLi4vLi4vYnVpbGQvd2FzbS9tYWluLndhc20nO1xuXG5leHBvcnQgLyoqXG4gKiBXYXNtIG1vZHVsZSBnZW5lcmF0b3IuIFRoaXMgY29kZSBpcyBiYXNlZCBvbiBFbXNjcmlwdGVuIGRlZmF1bHQganMgdGVtcGxhdGUuXG4gKlxuICogQHJldHVybiB7Kn0gXG4gKi9cbmNvbnN0IFdhc21Nb2R1bGVHZW5lcmF0b3IgPSAoKSA9PiB7XG4gICAgY29uc3QgTW9kdWxlID0ge307XG4gICAgbGV0IGFyZ3VtZW50c18gPSBbXTtcbiAgICBsZXQgdGhpc1Byb2dyYW0gPSBcIi4vdGhpcy5wcm9ncmFtXCI7XG4gICAgbGV0IHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgIHRocm93IHRvVGhyb3dcbiAgICB9O1xuICAgIGNvbnN0IEVOVklST05NRU5UX0lTX1dFQiA9IHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCI7XG4gICAgY29uc3QgRU5WSVJPTk1FTlRfSVNfV09SS0VSID0gdHlwZW9mIGltcG9ydFNjcmlwdHMgPT09IFwiZnVuY3Rpb25cIjtcbiAgICBjb25zdCBFTlZJUk9OTUVOVF9JU19OT0RFID0gdHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMubm9kZSA9PT0gXCJzdHJpbmdcIjtcbiAgICBsZXQgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLWdsb2JhbHNcbiAgICBjb25zdCB3b3JrZXJHbG9iYWxTY29wZSA9IEVOVklST05NRU5UX0lTX1dPUktFUiA/IHNlbGYgOiBudWxsO1xuXG4gICAgZnVuY3Rpb24gbG9jYXRlRmlsZShwYXRoKSB7XG4gICAgICAgIGlmIChNb2R1bGUubG9jYXRlRmlsZSkge1xuICAgICAgICAgICAgcmV0dXJuIE1vZHVsZS5sb2NhdGVGaWxlKHBhdGgsIHNjcmlwdERpcmVjdG9yeSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2NyaXB0RGlyZWN0b3J5ICsgcGF0aFxuICAgIH1cbiAgICBsZXQgcmVhZF87IGxldCByZWFkQXN5bmM7IGxldCByZWFkQmluYXJ5O1xuXG4gICAgZnVuY3Rpb24gbG9nRXhjZXB0aW9uT25FeGl0KGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFeGl0U3RhdHVzKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRvTG9nID0gZTtcbiAgICAgICAgZXJyKGBleGl0aW5nIGR1ZSB0byBleGNlcHRpb246ICR7ICB0b0xvZ31gKVxuICAgIH1cbiAgICBsZXQgbm9kZUZTO1xuICAgIGxldCBub2RlUGF0aDtcbiAgICBpZiAoRU5WSVJPTk1FTlRfSVNfTk9ERSkge1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBgJHtyZXF1aXJlKFwicGF0aFwiKS5kaXJuYW1lKHNjcmlwdERpcmVjdG9yeSkgIH0vYFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gYCR7X19kaXJuYW1lICB9L2BcbiAgICAgICAgfVxuICAgICAgICByZWFkXyA9IGZ1bmN0aW9uIHNoZWxsX3JlYWQoZmlsZW5hbWUsIGJpbmFyeSkge1xuICAgICAgICAgICAgaWYgKCFub2RlRlMpIG5vZGVGUyA9IHJlcXVpcmUoXCJmc1wiKTtcbiAgICAgICAgICAgIGlmICghbm9kZVBhdGgpIG5vZGVQYXRoID0gcmVxdWlyZShcInBhdGhcIik7XG4gICAgICAgICAgICBmaWxlbmFtZSA9IG5vZGVQYXRoLm5vcm1hbGl6ZShmaWxlbmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZUZTLnJlYWRGaWxlU3luYyhmaWxlbmFtZSwgYmluYXJ5ID8gbnVsbCA6IFwidXRmOFwiKVxuICAgICAgICB9O1xuICAgICAgICByZWFkQmluYXJ5ID0gZnVuY3Rpb24gcmVhZEJpbmFyeShmaWxlbmFtZSkge1xuICAgICAgICAgICAgbGV0IHJldCA9IHJlYWRfKGZpbGVuYW1lLCB0cnVlKTtcbiAgICAgICAgICAgIGlmICghcmV0LmJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldCA9IG5ldyBVaW50OEFycmF5KHJldClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFzc2VydChyZXQuYnVmZmVyKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZEFzeW5jID0gZnVuY3Rpb24gcmVhZEFzeW5jKGZpbGVuYW1lLCBvbmxvYWQsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICghbm9kZUZTKSBub2RlRlMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICBpZiAoIW5vZGVQYXRoKSBub2RlUGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xuICAgICAgICAgICAgZmlsZW5hbWUgPSBub2RlUGF0aC5ub3JtYWxpemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgbm9kZUZTLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgb25lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIGVsc2Ugb25sb2FkKGRhdGEuYnVmZmVyKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHByb2Nlc3MuYXJndi5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aGlzUHJvZ3JhbSA9IHByb2Nlc3MuYXJndlsxXS5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxuICAgICAgICB9XG4gICAgICAgIGFyZ3VtZW50c18gPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZHVsZVxuICAgICAgICB9XG4gICAgICAgIHByb2Nlc3Mub24oXCJ1bmNhdWdodEV4Y2VwdGlvblwiLCAoZXgpID0+IHtcbiAgICAgICAgICAgIGlmICghKGV4IGluc3RhbmNlb2YgRXhpdFN0YXR1cykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBleFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcHJvY2Vzcy5vbihcInVuaGFuZGxlZFJlamVjdGlvblwiLCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyByZWFzb25cbiAgICAgICAgfSk7XG4gICAgICAgIHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgICAgICBpZiAoa2VlcFJ1bnRpbWVBbGl2ZSgpKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5leGl0Q29kZSA9IHN0YXR1cztcbiAgICAgICAgICAgICAgICB0aHJvdyB0b1Rocm93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2dFeGNlcHRpb25PbkV4aXQodG9UaHJvdyk7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoc3RhdHVzKVxuICAgICAgICB9O1xuICAgICAgICBNb2R1bGUuaW5zcGVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiW0Vtc2NyaXB0ZW4gTW9kdWxlIG9iamVjdF1cIlxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChFTlZJUk9OTUVOVF9JU19XRUIgfHwgRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLWdsb2JhbHNcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IHNlbGYubG9jYXRpb24uaHJlZlxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkb2N1bWVudC5jdXJyZW50U2NyaXB0KSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBkb2N1bWVudC5jdXJyZW50U2NyaXB0LnNyY1xuICAgICAgICB9XG4gICAgICAgIGlmIChzY3JpcHREaXJlY3RvcnkuaW5kZXhPZihcImJsb2I6XCIpICE9PSAwKSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBzY3JpcHREaXJlY3Rvcnkuc3Vic3RyKDAsIHNjcmlwdERpcmVjdG9yeS5yZXBsYWNlKC9bPyNdLiovLCBcIlwiKS5sYXN0SW5kZXhPZihcIi9cIikgKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIlxuICAgICAgICB9XG4gICAgICAgIHJlYWRfID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIGZhbHNlKTtcbiAgICAgICAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgcmVhZEJpbmFyeSA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuICAgICAgICAgICAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSh4aHIucmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVhZEFzeW5jID0gZnVuY3Rpb24odXJsLCBvbmxvYWQsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgICAgIHhoci5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuICAgICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDAgfHwgeGhyLnN0YXR1cyA9PT0gMCAmJiB4aHIucmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgb25sb2FkKHhoci5yZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbmVycm9yKClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB4aHIub25lcnJvciA9IG9uZXJyb3I7XG4gICAgICAgICAgICB4aHIuc2VuZChudWxsKVxuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IG91dCA9IE1vZHVsZS5wcmludCB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGNvbnN0IGVyciA9IE1vZHVsZS5wcmludEVyciB8fCBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIGlmIChNb2R1bGUuYXJndW1lbnRzKSBhcmd1bWVudHNfID0gTW9kdWxlLmFyZ3VtZW50cztcbiAgICBpZiAoTW9kdWxlLnRoaXNQcm9ncmFtKSB0aGlzUHJvZ3JhbSA9IE1vZHVsZS50aGlzUHJvZ3JhbTtcbiAgICBpZiAoTW9kdWxlLnF1aXQpIHF1aXRfID0gTW9kdWxlLnF1aXQ7XG5cbiAgICBmdW5jdGlvbiBiYXNlNjRUb0FycmF5QnVmZmVyKGJhc2U2NCkge1xuICAgICAgICBsZXQgYmluYXJ5X3N0cmluZyA9ICcnO1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfTk9ERSkge1xuICAgICAgICAgICAgYmluYXJ5X3N0cmluZyA9IEJ1ZmZlci5mcm9tKGJhc2U2NCwgJ2Jhc2U2NCcpLnRvU3RyaW5nKCdhc2NpaScpO1xuICAgICAgICB9IGVsc2UgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSB3b3JrZXJHbG9iYWxTY29wZS5hdG9iKGJhc2U2NCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSB3aW5kb3cuYXRvYihiYXNlNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICBjb25zdCBsZW4gPSBiaW5hcnlfc3RyaW5nLmxlbmd0aDtcbiAgICAgICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShsZW4pO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGJ5dGVzW2ldID0gYmluYXJ5X3N0cmluZy5jaGFyQ29kZUF0KGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlcy5idWZmZXI7XG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbUJpbmFyeSA9IGJhc2U2NFRvQXJyYXlCdWZmZXIobWFpbldhc20pO1xuICAgIGNvbnN0IG5vRXhpdFJ1bnRpbWUgPSBNb2R1bGUubm9FeGl0UnVudGltZSB8fCB0cnVlO1xuICAgIGlmICh0eXBlb2YgV2ViQXNzZW1ibHkgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgYWJvcnQoXCJubyBuYXRpdmUgd2FzbSBzdXBwb3J0IGRldGVjdGVkXCIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0VmFsdWUocHRyLCB2YWx1ZSwgdHlwZSkge1xuICAgICAgICB0eXBlID0gdHlwZSB8fCBcImk4XCI7XG4gICAgICAgIGlmICh0eXBlLmNoYXJBdCh0eXBlLmxlbmd0aCAtIDEpID09PSBcIipcIikgdHlwZSA9IFwiaTMyXCI7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImkxXCI6XG4gICAgICAgICAgICAgICAgSEVBUDhbcHRyID4+IDBdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaThcIjpcbiAgICAgICAgICAgICAgICBIRUFQOFtwdHIgPj4gMF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJpMTZcIjpcbiAgICAgICAgICAgICAgICBIRUFQMTZbcHRyID4+IDFdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaTMyXCI6XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciA+PiAyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImk2NFwiOlxuICAgICAgICAgICAgICAgIHRlbXBJNjQgPSBbXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID4+PiAwLFxuICAgICAgICAgICAgICAgICAgICAodGVtcERvdWJsZSA9IHZhbHVlLCArTWF0aC5hYnModGVtcERvdWJsZSkgPj0gMSA/IHRlbXBEb3VibGUgPiAwID8gKE1hdGgubWluKCtNYXRoLmZsb29yKHRlbXBEb3VibGUgLyA0Mjk0OTY3Mjk2KSwgNDI5NDk2NzI5NSkgfCAwKSA+Pj4gMCA6IH5+K01hdGguY2VpbCgodGVtcERvdWJsZSAtICsofn50ZW1wRG91YmxlID4+PiAwKSkgLyA0Mjk0OTY3Mjk2KSA+Pj4gMCA6IDApXTtcbiAgICAgICAgICAgICAgICBIRUFQMzJbcHRyID4+IDJdID0gdGVtcEk2NFswXTtcbiAgICAgICAgICAgICAgICBIRUFQMzJbcHRyICsgNCA+PiAyXSA9IHRlbXBJNjRbMV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICAgICAgICBIRUFQRjMyW3B0ciA+PiAyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImRvdWJsZVwiOlxuICAgICAgICAgICAgICAgIEhFQVBGNjRbcHRyID4+IDNdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFib3J0KGBpbnZhbGlkIHR5cGUgZm9yIHNldFZhbHVlOiAkeyAgdHlwZX1gKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VmFsdWUocHRyLCB0eXBlKSB7XG4gICAgICAgIHR5cGUgPSB0eXBlIHx8IFwiaThcIjtcbiAgICAgICAgaWYgKHR5cGUuY2hhckF0KHR5cGUubGVuZ3RoIC0gMSkgPT09IFwiKlwiKSB0eXBlID0gXCJpMzJcIjtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFwiaTFcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDhbcHRyID4+IDBdO1xuICAgICAgICAgICAgY2FzZSBcImk4XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3B0ciA+PiAwXTtcbiAgICAgICAgICAgIGNhc2UgXCJpMTZcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDE2W3B0ciA+PiAxXTtcbiAgICAgICAgICAgIGNhc2UgXCJpMzJcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJpNjRcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBIRUFQRjMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKEhFQVBGNjRbcHRyID4+IDNdKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYWJvcnQoYGludmFsaWQgdHlwZSBmb3IgZ2V0VmFsdWU6ICR7ICB0eXBlfWApXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgbGV0IHdhc21NZW1vcnk7XG4gICAgbGV0IEFCT1JUID0gZmFsc2U7XG4gICAgbGV0IEVYSVRTVEFUVVM7XG5cbiAgICBmdW5jdGlvbiBhc3NlcnQoY29uZGl0aW9uLCB0ZXh0KSB7XG4gICAgICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgICAgICBhYm9ydChgQXNzZXJ0aW9uIGZhaWxlZDogJHsgIHRleHR9YClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldENGdW5jKGlkZW50KSB7XG4gICAgICAgIGNvbnN0IGZ1bmMgPSBNb2R1bGVbYF8keyAgaWRlbnR9YF07XG4gICAgICAgIGFzc2VydChmdW5jLCBgQ2Fubm90IGNhbGwgdW5rbm93biBmdW5jdGlvbiAkeyAgaWRlbnQgIH0sIG1ha2Ugc3VyZSBpdCBpcyBleHBvcnRlZGApO1xuICAgICAgICByZXR1cm4gZnVuY1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNjYWxsKGlkZW50LCByZXR1cm5UeXBlLCBhcmdUeXBlcywgYXJncykge1xuICAgICAgICBjb25zdCB0b0MgPSB7XG4gICAgICAgICAgICBcInN0cmluZ1wiOiBmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0ID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoc3RyICE9PSBudWxsICYmIHN0ciAhPT0gdW5kZWZpbmVkICYmIHN0ciAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSAoc3RyLmxlbmd0aCA8PCAyKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldCA9IHN0YWNrQWxsb2MobGVuKTtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5nVG9VVEY4KHN0ciwgcmV0LCBsZW4pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcImFycmF5XCI6IGZ1bmN0aW9uKGFycikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldCA9IHN0YWNrQWxsb2MoYXJyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgd3JpdGVBcnJheVRvTWVtb3J5KGFyciwgcmV0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gY29udmVydFJldHVyblZhbHVlKHJldCkge1xuICAgICAgICAgICAgaWYgKHJldHVyblR5cGUgPT09IFwic3RyaW5nXCIpIHJldHVybiBVVEY4VG9TdHJpbmcocmV0KTtcbiAgICAgICAgICAgIGlmIChyZXR1cm5UeXBlID09PSBcImJvb2xlYW5cIikgcmV0dXJuIEJvb2xlYW4ocmV0KTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdW5jID0gZ2V0Q0Z1bmMoaWRlbnQpO1xuICAgICAgICBjb25zdCBjQXJncyA9IFtdO1xuICAgICAgICBsZXQgc3RhY2sgPSAwO1xuICAgICAgICBpZiAoYXJncykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udmVydGVyID0gdG9DW2FyZ1R5cGVzW2ldXTtcbiAgICAgICAgICAgICAgICBpZiAoY29udmVydGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGFjayA9PT0gMCkgc3RhY2sgPSBzdGFja1NhdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgY0FyZ3NbaV0gPSBjb252ZXJ0ZXIoYXJnc1tpXSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjQXJnc1tpXSA9IGFyZ3NbaV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHJldCA9IGZ1bmMoLi4uY0FyZ3MpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRG9uZShyZXQpIHtcbiAgICAgICAgICAgIGlmIChzdGFjayAhPT0gMCkgc3RhY2tSZXN0b3JlKHN0YWNrKTtcbiAgICAgICAgICAgIHJldHVybiBjb252ZXJ0UmV0dXJuVmFsdWUocmV0KVxuICAgICAgICB9XG4gICAgICAgIHJldCA9IG9uRG9uZShyZXQpO1xuICAgICAgICByZXR1cm4gcmV0XG4gICAgfVxuICAgIGNvbnN0IFVURjhEZWNvZGVyID0gdHlwZW9mIFRleHREZWNvZGVyICE9PSBcInVuZGVmaW5lZFwiID8gbmV3IFRleHREZWNvZGVyKFwidXRmOFwiKSA6IHVuZGVmaW5lZDtcblxuICAgIGZ1bmN0aW9uIFVURjhBcnJheVRvU3RyaW5nKGhlYXAsIGlkeCwgbWF4Qnl0ZXNUb1JlYWQpIHtcbiAgICAgICAgY29uc3QgZW5kSWR4ID0gaWR4ICsgbWF4Qnl0ZXNUb1JlYWQ7XG4gICAgICAgIGxldCBlbmRQdHIgPSBpZHg7XG4gICAgICAgIHdoaWxlIChoZWFwW2VuZFB0cl0gJiYgIShlbmRQdHIgPj0gZW5kSWR4KSkgKytlbmRQdHI7XG4gICAgICAgIGlmIChlbmRQdHIgLSBpZHggPiAxNiAmJiBoZWFwLnN1YmFycmF5ICYmIFVURjhEZWNvZGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gVVRGOERlY29kZXIuZGVjb2RlKGhlYXAuc3ViYXJyYXkoaWR4LCBlbmRQdHIpKVxuICAgICAgICB9IFxuICAgICAgICAgICAgbGV0IHN0ciA9IFwiXCI7XG4gICAgICAgICAgICB3aGlsZSAoaWR4IDwgZW5kUHRyKSB7XG4gICAgICAgICAgICAgICAgbGV0IHUwID0gaGVhcFtpZHgrK107XG4gICAgICAgICAgICAgICAgaWYgKCEodTAgJiAxMjgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHUwKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgdTEgPSBoZWFwW2lkeCsrXSAmIDYzO1xuICAgICAgICAgICAgICAgIGlmICgodTAgJiAyMjQpID09PSAxOTIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKHUwICYgMzEpIDw8IDYgfCB1MSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHUyID0gaGVhcFtpZHgrK10gJiA2MztcbiAgICAgICAgICAgICAgICBpZiAoKHUwICYgMjQwKSA9PT0gMjI0KSB7XG4gICAgICAgICAgICAgICAgICAgIHUwID0gKHUwICYgMTUpIDw8IDEyIHwgdTEgPDwgNiB8IHUyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdTAgPSAodTAgJiA3KSA8PCAxOCB8IHUxIDw8IDEyIHwgdTIgPDwgNiB8IGhlYXBbaWR4KytdICYgNjNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHUwIDwgNjU1MzYpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodTApXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2ggPSB1MCAtIDY1NTM2O1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSg1NTI5NiB8IGNoID4+IDEwLCA1NjMyMCB8IGNoICYgMTAyMylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gc3RyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gVVRGOFRvU3RyaW5nKHB0ciwgbWF4Qnl0ZXNUb1JlYWQpIHtcbiAgICAgICAgcmV0dXJuIHB0ciA/IFVURjhBcnJheVRvU3RyaW5nKEhFQVBVOCwgcHRyLCBtYXhCeXRlc1RvUmVhZCkgOiBcIlwiXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RyaW5nVG9VVEY4QXJyYXkoc3RyLCBoZWFwLCBvdXRJZHgsIG1heEJ5dGVzVG9Xcml0ZSkge1xuICAgICAgICBpZiAoIShtYXhCeXRlc1RvV3JpdGUgPiAwKSkgcmV0dXJuIDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0SWR4ID0gb3V0SWR4O1xuICAgICAgICBjb25zdCBlbmRJZHggPSBvdXRJZHggKyBtYXhCeXRlc1RvV3JpdGUgLSAxO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IHUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIGlmICh1ID49IDU1Mjk2ICYmIHUgPD0gNTczNDMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1MSA9IHN0ci5jaGFyQ29kZUF0KCsraSk7XG4gICAgICAgICAgICAgICAgdSA9IDY1NTM2ICsgKCh1ICYgMTAyMykgPDwgMTApIHwgdTEgJiAxMDIzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodSA8PSAxMjcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSB1XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHUgPD0gMjA0Nykge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAxID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxOTIgfCB1ID4+IDY7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodSA8PSA2NTUzNSkge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAyID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAyMjQgfCB1ID4+IDEyO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiA2ICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dElkeCArIDMgPj0gZW5kSWR4KSBicmVhaztcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDI0MCB8IHUgPj4gMTg7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ID4+IDEyICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ID4+IDYgJiA2MztcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDEyOCB8IHUgJiA2M1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGhlYXBbb3V0SWR4XSA9IDA7XG4gICAgICAgIHJldHVybiBvdXRJZHggLSBzdGFydElkeFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmluZ1RvVVRGOChzdHIsIG91dFB0ciwgbWF4Qnl0ZXNUb1dyaXRlKSB7XG4gICAgICAgIHJldHVybiBzdHJpbmdUb1VURjhBcnJheShzdHIsIEhFQVBVOCwgb3V0UHRyLCBtYXhCeXRlc1RvV3JpdGUpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGVuZ3RoQnl0ZXNVVEY4KHN0cikge1xuICAgICAgICBsZXQgbGVuID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCB1ID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAodSA+PSA1NTI5NiAmJiB1IDw9IDU3MzQzKSB1ID0gNjU1MzYgKyAoKHUgJiAxMDIzKSA8PCAxMCkgfCBzdHIuY2hhckNvZGVBdCgrK2kpICYgMTAyMztcbiAgICAgICAgICAgIGlmICh1IDw9IDEyNykgKytsZW47XG4gICAgICAgICAgICBlbHNlIGlmICh1IDw9IDIwNDcpIGxlbiArPSAyO1xuICAgICAgICAgICAgZWxzZSBpZiAodSA8PSA2NTUzNSkgbGVuICs9IDM7XG4gICAgICAgICAgICBlbHNlIGxlbiArPSA0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxlblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbG9jYXRlVVRGOE9uU3RhY2soc3RyKSB7XG4gICAgICAgIGNvbnN0IHNpemUgPSBsZW5ndGhCeXRlc1VURjgoc3RyKSArIDE7XG4gICAgICAgIGNvbnN0IHJldCA9IHN0YWNrQWxsb2Moc2l6ZSk7XG4gICAgICAgIHN0cmluZ1RvVVRGOEFycmF5KHN0ciwgSEVBUDgsIHJldCwgc2l6ZSk7XG4gICAgICAgIHJldHVybiByZXRcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3cml0ZUFycmF5VG9NZW1vcnkoYXJyYXksIGJ1ZmZlcikge1xuICAgICAgICBIRUFQOC5zZXQoYXJyYXksIGJ1ZmZlcilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGlnblVwKHgsIG11bHRpcGxlKSB7XG4gICAgICAgIGlmICh4ICUgbXVsdGlwbGUgPiAwKSB7XG4gICAgICAgICAgICB4ICs9IG11bHRpcGxlIC0geCAlIG11bHRpcGxlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHhcbiAgICB9XG4gICAgbGV0IGJ1ZmZlcjsgbGV0IEhFQVA4OyBsZXQgSEVBUFU4OyBsZXQgSEVBUDE2OyBsZXQgSEVBUFUxNjsgbGV0IEhFQVAzMjsgbGV0IEhFQVBVMzI7IGxldCBIRUFQRjMyOyBsZXQgSEVBUEY2NDtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKGJ1Zikge1xuICAgICAgICBidWZmZXIgPSBidWY7XG4gICAgICAgIE1vZHVsZS5IRUFQOCA9IEhFQVA4ID0gbmV3IEludDhBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUDE2ID0gSEVBUDE2ID0gbmV3IEludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVAzMiA9IEhFQVAzMiA9IG5ldyBJbnQzMkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQVTggPSBIRUFQVTggPSBuZXcgVWludDhBcnJheShidWYpO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIE1vZHVsZS5IRUFQVTE2ID0gSEVBUFUxNiA9IG5ldyBVaW50MTZBcnJheShidWYpO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIE1vZHVsZS5IRUFQVTMyID0gSEVBUFUzMiA9IG5ldyBVaW50MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUEYzMiA9IEhFQVBGMzIgPSBuZXcgRmxvYXQzMkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQRjY0ID0gSEVBUEY2NCA9IG5ldyBGbG9hdDY0QXJyYXkoYnVmKVxuICAgIH1cbiAgICBsZXQgd2FzbVRhYmxlO1xuICAgIGNvbnN0IF9fQVRQUkVSVU5fXyA9IFtdO1xuICAgIGNvbnN0IF9fQVRJTklUX18gPSBbXTtcbiAgICBjb25zdCBfX0FUTUFJTl9fID0gW107XG4gICAgY29uc3QgX19BVFBPU1RSVU5fXyA9IFtdO1xuICAgIGNvbnN0IHJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIGtlZXBSdW50aW1lQWxpdmUoKSB7XG4gICAgICAgIHJldHVybiBub0V4aXRSdW50aW1lIHx8IHJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyID4gMFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByZVJ1bigpIHtcbiAgICAgICAgaWYgKE1vZHVsZS5wcmVSdW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnByZVJ1biA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucHJlUnVuID0gW01vZHVsZS5wcmVSdW5dO1xuICAgICAgICAgICAgd2hpbGUgKE1vZHVsZS5wcmVSdW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYWRkT25QcmVSdW4oTW9kdWxlLnByZVJ1bi5zaGlmdCgpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRQUkVSVU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0UnVudGltZSgpIHtcbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVElOSVRfXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVNYWluKCkge1xuICAgICAgICBjYWxsUnVudGltZUNhbGxiYWNrcyhfX0FUTUFJTl9fKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4aXRSdW50aW1lKCkge1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBvc3RSdW4oKSB7XG4gICAgICAgIGlmIChNb2R1bGUucG9zdFJ1bikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBNb2R1bGUucG9zdFJ1biA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucG9zdFJ1biA9IFtNb2R1bGUucG9zdFJ1bl07XG4gICAgICAgICAgICB3aGlsZSAoTW9kdWxlLnBvc3RSdW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYWRkT25Qb3N0UnVuKE1vZHVsZS5wb3N0UnVuLnNoaWZ0KCkpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVFBPU1RSVU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPblByZVJ1bihjYikge1xuICAgICAgICBfX0FUUFJFUlVOX18udW5zaGlmdChjYilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPbkluaXQoY2IpIHtcbiAgICAgICAgX19BVElOSVRfXy51bnNoaWZ0KGNiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE9uUG9zdFJ1bihjYikge1xuICAgICAgICBfX0FUUE9TVFJVTl9fLnVuc2hpZnQoY2IpXG4gICAgfVxuICAgIGxldCBydW5EZXBlbmRlbmNpZXMgPSAwO1xuICAgIGxldCBydW5EZXBlbmRlbmN5V2F0Y2hlciA9IG51bGw7XG4gICAgbGV0IGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IG51bGw7XG5cbiAgICBmdW5jdGlvbiBhZGRSdW5EZXBlbmRlbmN5KCkge1xuICAgICAgICBydW5EZXBlbmRlbmNpZXMrKztcbiAgICAgICAgaWYgKE1vZHVsZS5tb25pdG9yUnVuRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcyhydW5EZXBlbmRlbmNpZXMpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVSdW5EZXBlbmRlbmN5KCkge1xuICAgICAgICBydW5EZXBlbmRlbmNpZXMtLTtcbiAgICAgICAgaWYgKE1vZHVsZS5tb25pdG9yUnVuRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcyhydW5EZXBlbmRlbmNpZXMpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY2llcyA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY3lXYXRjaGVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChydW5EZXBlbmRlbmN5V2F0Y2hlcik7XG4gICAgICAgICAgICAgICAgcnVuRGVwZW5kZW5jeVdhdGNoZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGVwZW5kZW5jaWVzRnVsZmlsbGVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBkZXBlbmRlbmNpZXNGdWxmaWxsZWQ7XG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzRnVsZmlsbGVkID0gbnVsbDtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTW9kdWxlLnByZWxvYWRlZEltYWdlcyA9IHt9O1xuICAgIE1vZHVsZS5wcmVsb2FkZWRBdWRpb3MgPSB7fTtcblxuICAgIGZ1bmN0aW9uIGFib3J0KHdoYXQpIHtcbiAgICAgICAgaWYgKE1vZHVsZS5vbkFib3J0KSB7XG4gICAgICAgICAgICBNb2R1bGUub25BYm9ydCh3aGF0KVxuICAgICAgICB9XG4gICAgICAgIHdoYXQgPSBgQWJvcnRlZCgkeyAgd2hhdCAgfSlgO1xuICAgICAgICBlcnIod2hhdCk7XG4gICAgICAgIEFCT1JUID0gdHJ1ZTtcbiAgICAgICAgRVhJVFNUQVRVUyA9IDE7XG4gICAgICAgIHdoYXQgKz0gXCIuIEJ1aWxkIHdpdGggLXMgQVNTRVJUSU9OUz0xIGZvciBtb3JlIGluZm8uXCI7XG4gICAgICAgIGNvbnN0IGUgPSBuZXcgV2ViQXNzZW1ibHkuUnVudGltZUVycm9yKHdoYXQpO1xuICAgICAgICB0aHJvdyBlXG4gICAgfVxuICAgIGNvbnN0IGRhdGFVUklQcmVmaXggPSBcImRhdGE6YXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtO2Jhc2U2NCxcIjtcblxuICAgIGZ1bmN0aW9uIGlzRGF0YVVSSShmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZmlsZW5hbWUuc3RhcnRzV2l0aChkYXRhVVJJUHJlZml4KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRmlsZVVSSShmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZmlsZW5hbWUuc3RhcnRzV2l0aChcImZpbGU6Ly9cIilcbiAgICB9XG4gICAgbGV0IHdhc21CaW5hcnlGaWxlO1xuICAgIHdhc21CaW5hcnlGaWxlID0gbWFpbldhc207XG4gICAgaWYgKCFpc0RhdGFVUkkod2FzbUJpbmFyeUZpbGUpKSB7XG4gICAgICAgIHdhc21CaW5hcnlGaWxlID0gbG9jYXRlRmlsZSh3YXNtQmluYXJ5RmlsZSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCaW5hcnkoZmlsZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGZpbGUgPT09IHdhc21CaW5hcnlGaWxlICYmIHdhc21CaW5hcnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkod2FzbUJpbmFyeSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWFkQmluYXJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlYWRCaW5hcnkoZmlsZSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYm90aCBhc3luYyBhbmQgc3luYyBmZXRjaGluZyBvZiB0aGUgd2FzbSBmYWlsZWRcIik7XG4gICAgICAgICAgICBcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBhYm9ydChlcnIpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEJpbmFyeVByb21pc2UoKSB7XG4gICAgICAgIGlmICghd2FzbUJpbmFyeSAmJiAoRU5WSVJPTk1FTlRfSVNfV0VCIHx8IEVOVklST05NRU5UX0lTX1dPUktFUikpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmV0Y2ggPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNGaWxlVVJJKHdhc21CaW5hcnlGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCh3YXNtQmluYXJ5RmlsZSwge1xuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsczogXCJzYW1lLW9yaWdpblwiXG4gICAgICAgICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gbG9hZCB3YXNtIGJpbmFyeSBmaWxlIGF0ICckeyAgd2FzbUJpbmFyeUZpbGUgIH0nYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmFycmF5QnVmZmVyKClcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBnZXRCaW5hcnkod2FzbUJpbmFyeUZpbGUpKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBpZiAocmVhZEFzeW5jKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWFkQXN5bmMod2FzbUJpbmFyeUZpbGUsIChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUobmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UpKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgcmVqZWN0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IGdldEJpbmFyeSh3YXNtQmluYXJ5RmlsZSkpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlV2FzbSgpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgIFwiZW52XCI6IGFzbUxpYnJhcnlBcmcsXG4gICAgICAgICAgICBcIndhc2lfc25hcHNob3RfcHJldmlldzFcIjogYXNtTGlicmFyeUFyZ1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVJbnN0YW5jZShpbnN0YW5jZSkge1xuICAgICAgICAgICAgY29uc3Qge2V4cG9ydHN9ID0gaW5zdGFuY2U7XG4gICAgICAgICAgICBNb2R1bGUuYXNtID0gZXhwb3J0cztcbiAgICAgICAgICAgIHdhc21NZW1vcnkgPSBNb2R1bGUuYXNtLm1lbW9yeTtcbiAgICAgICAgICAgIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKHdhc21NZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgICAgIHdhc21UYWJsZSA9IE1vZHVsZS5hc20uX19pbmRpcmVjdF9mdW5jdGlvbl90YWJsZTtcbiAgICAgICAgICAgIGFkZE9uSW5pdChNb2R1bGUuYXNtLl9fd2FzbV9jYWxsX2N0b3JzKTtcbiAgICAgICAgICAgIHJlbW92ZVJ1bkRlcGVuZGVuY3koXCJ3YXNtLWluc3RhbnRpYXRlXCIpXG4gICAgICAgIH1cbiAgICAgICAgYWRkUnVuRGVwZW5kZW5jeShcIndhc20taW5zdGFudGlhdGVcIik7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQocmVzdWx0KSB7XG4gICAgICAgICAgICByZWNlaXZlSW5zdGFuY2UocmVzdWx0Lmluc3RhbmNlKVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlcikge1xuICAgICAgICAgICAgcmV0dXJuIGdldEJpbmFyeVByb21pc2UoKS50aGVuKChiaW5hcnkpID0+IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGJpbmFyeSwgaW5mbykpLnRoZW4oKGluc3RhbmNlKSA9PiBpbnN0YW5jZSkudGhlbihyZWNlaXZlciwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgICAgIGVycihgZmFpbGVkIHRvIGFzeW5jaHJvbm91c2x5IHByZXBhcmUgd2FzbTogJHsgIHJlYXNvbn1gKTtcbiAgICAgICAgICAgICAgICBhYm9ydChyZWFzb24pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zdGFudGlhdGVBc3luYygpIHtcbiAgICAgICAgICAgIGlmICghd2FzbUJpbmFyeSAmJiB0eXBlb2YgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcgPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNEYXRhVVJJKHdhc21CaW5hcnlGaWxlKSAmJiAhaXNGaWxlVVJJKHdhc21CaW5hcnlGaWxlKSAmJiB0eXBlb2YgZmV0Y2ggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCh3YXNtQmluYXJ5RmlsZSwge1xuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsczogXCJzYW1lLW9yaWdpblwiXG4gICAgICAgICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcocmVzcG9uc2UsIGluZm8pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnRoZW4ocmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQsIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycihgd2FzbSBzdHJlYW1pbmcgY29tcGlsZSBmYWlsZWQ6ICR7ICByZWFzb259YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoXCJmYWxsaW5nIGJhY2sgdG8gQXJyYXlCdWZmZXIgaW5zdGFudGlhdGlvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW50aWF0ZUFycmF5QnVmZmVyKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW50aWF0ZUFycmF5QnVmZmVyKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KVxuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1vZHVsZS5pbnN0YW50aWF0ZVdhc20pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhwb3J0cyA9IE1vZHVsZS5pbnN0YW50aWF0ZVdhc20oaW5mbywgcmVjZWl2ZUluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwb3J0c1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGVycihgTW9kdWxlLmluc3RhbnRpYXRlV2FzbSBjYWxsYmFjayBmYWlsZWQgd2l0aCBlcnJvcjogJHsgIGV9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaW5zdGFudGlhdGVBc3luYygpO1xuICAgICAgICByZXR1cm4ge31cbiAgICB9XG4gICAgbGV0IHRlbXBEb3VibGU7XG4gICAgbGV0IHRlbXBJNjQ7XG5cbiAgICBmdW5jdGlvbiBjYWxsUnVudGltZUNhbGxiYWNrcyhjYWxsYmFja3MpIHtcbiAgICAgICAgd2hpbGUgKGNhbGxiYWNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IGNhbGxiYWNrcy5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soTW9kdWxlKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge2Z1bmN9ID0gY2FsbGJhY2s7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suYXJnID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0V2FzbVRhYmxlRW50cnkoZnVuYykoKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFdhc21UYWJsZUVudHJ5KGZ1bmMpKGNhbGxiYWNrLmFyZylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZ1bmMoY2FsbGJhY2suYXJnID09PSB1bmRlZmluZWQgPyBudWxsIDogY2FsbGJhY2suYXJnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbVRhYmxlTWlycm9yID0gW107XG5cbiAgICBmdW5jdGlvbiBnZXRXYXNtVGFibGVFbnRyeShmdW5jUHRyKSB7XG4gICAgICAgIGxldCBmdW5jID0gd2FzbVRhYmxlTWlycm9yW2Z1bmNQdHJdO1xuICAgICAgICBpZiAoIWZ1bmMpIHtcbiAgICAgICAgICAgIGlmIChmdW5jUHRyID49IHdhc21UYWJsZU1pcnJvci5sZW5ndGgpIHdhc21UYWJsZU1pcnJvci5sZW5ndGggPSBmdW5jUHRyICsgMTtcbiAgICAgICAgICAgIHdhc21UYWJsZU1pcnJvcltmdW5jUHRyXSA9IGZ1bmMgPSB3YXNtVGFibGUuZ2V0KGZ1bmNQdHIpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZ1bmNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVFeGNlcHRpb24oZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEV4aXRTdGF0dXMgfHwgZSA9PT0gXCJ1bndpbmRcIikge1xuICAgICAgICAgICAgcmV0dXJuIEVYSVRTVEFUVVNcbiAgICAgICAgfVxuICAgICAgICBxdWl0XygxLCBlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fX2Fzc2VydF9mYWlsKGNvbmRpdGlvbiwgZmlsZW5hbWUsIGxpbmUsIGZ1bmMpIHtcbiAgICAgICAgYWJvcnQoYEFzc2VydGlvbiBmYWlsZWQ6ICR7ICBVVEY4VG9TdHJpbmcoY29uZGl0aW9uKSAgfSwgYXQ6ICR7ICBbZmlsZW5hbWUgPyBVVEY4VG9TdHJpbmcoZmlsZW5hbWUpIDogXCJ1bmtub3duIGZpbGVuYW1lXCIsIGxpbmUsIGZ1bmMgPyBVVEY4VG9TdHJpbmcoZnVuYykgOiBcInVua25vd24gZnVuY3Rpb25cIl19YClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uKHNpemUpIHtcbiAgICAgICAgcmV0dXJuIF9tYWxsb2Moc2l6ZSArIDE2KSArIDE2XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2F0ZXhpdCgpIHt9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfYXRleGl0KGEwLCBhMSkge1xuICAgICAgICByZXR1cm4gX2F0ZXhpdChhMCwgYTEpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gRXhjZXB0aW9uSW5mbyhleGNQdHIpIHtcbiAgICAgICAgdGhpcy5leGNQdHIgPSBleGNQdHI7XG4gICAgICAgIHRoaXMucHRyID0gZXhjUHRyIC0gMTY7XG4gICAgICAgIHRoaXMuc2V0X3R5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgKyA0ID4+IDJdID0gdHlwZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdldF90eXBlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDMyW3RoaXMucHRyICsgNCA+PiAyXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldF9kZXN0cnVjdG9yID0gZnVuY3Rpb24oZGVzdHJ1Y3Rvcikge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyICsgOCA+PiAyXSA9IGRlc3RydWN0b3JcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVAzMlt0aGlzLnB0ciArIDggPj4gMl1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfcmVmY291bnQgPSBmdW5jdGlvbihyZWZjb3VudCkge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyID4+IDJdID0gcmVmY291bnRcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfY2F1Z2h0ID0gZnVuY3Rpb24oY2F1Z2h0KSB7XG4gICAgICAgICAgICBjYXVnaHQgPSBjYXVnaHQgPyAxIDogMDtcbiAgICAgICAgICAgIEhFQVA4W3RoaXMucHRyICsgMTIgPj4gMF0gPSBjYXVnaHRcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfY2F1Z2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDhbdGhpcy5wdHIgKyAxMiA+PiAwXSAhPT0gMFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldF9yZXRocm93biA9IGZ1bmN0aW9uKHJldGhyb3duKSB7XG4gICAgICAgICAgICByZXRocm93biA9IHJldGhyb3duID8gMSA6IDA7XG4gICAgICAgICAgICBIRUFQOFt0aGlzLnB0ciArIDEzID4+IDBdID0gcmV0aHJvd25cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfcmV0aHJvd24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBIRUFQOFt0aGlzLnB0ciArIDEzID4+IDBdICE9PSAwXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKHR5cGUsIGRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0X3R5cGUodHlwZSk7XG4gICAgICAgICAgICB0aGlzLnNldF9kZXN0cnVjdG9yKGRlc3RydWN0b3IpO1xuICAgICAgICAgICAgdGhpcy5zZXRfcmVmY291bnQoMCk7XG4gICAgICAgICAgICB0aGlzLnNldF9jYXVnaHQoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5zZXRfcmV0aHJvd24oZmFsc2UpXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuYWRkX3JlZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBIRUFQMzJbdGhpcy5wdHIgPj4gMl07XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgPj4gMl0gPSB2YWx1ZSArIDFcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5yZWxlYXNlX3JlZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc3QgcHJldiA9IEhFQVAzMlt0aGlzLnB0ciA+PiAyXTtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciA+PiAyXSA9IHByZXYgLSAxO1xuICAgICAgICAgICAgcmV0dXJuIHByZXYgPT09IDFcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fX2N4YV90aHJvdyhwdHIsIHR5cGUsIGRlc3RydWN0b3IpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IG5ldyBFeGNlcHRpb25JbmZvKHB0cik7XG4gICAgICAgIGluZm8uaW5pdCh0eXBlLCBkZXN0cnVjdG9yKTtcbiAgICAgICAgdGhyb3cgcHRyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2Fib3J0KCkge1xuICAgICAgICBhYm9ydChcIlwiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbXNjcmlwdGVuX21lbWNweV9iaWcoZGVzdCwgc3JjLCBudW0pIHtcbiAgICAgICAgSEVBUFU4LmNvcHlXaXRoaW4oZGVzdCwgc3JjLCBzcmMgKyBudW0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlcihzaXplKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3YXNtTWVtb3J5Lmdyb3coc2l6ZSAtIGJ1ZmZlci5ieXRlTGVuZ3RoICsgNjU1MzUgPj4+IDE2KTtcbiAgICAgICAgICAgIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKHdhc21NZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgICAgIHJldHVybiAxXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1lbXB0eVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwKHJlcXVlc3RlZFNpemUpIHtcbiAgICAgICAgY29uc3Qgb2xkU2l6ZSA9IEhFQVBVOC5sZW5ndGg7XG4gICAgICAgIHJlcXVlc3RlZFNpemUgPj4+PSAwO1xuICAgICAgICBjb25zdCBtYXhIZWFwU2l6ZSA9IDIxNDc0ODM2NDg7XG4gICAgICAgIGlmIChyZXF1ZXN0ZWRTaXplID4gbWF4SGVhcFNpemUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGN1dERvd24gPSAxOyBjdXREb3duIDw9IDQ7IGN1dERvd24gKj0gMikge1xuICAgICAgICAgICAgbGV0IG92ZXJHcm93bkhlYXBTaXplID0gb2xkU2l6ZSAqICgxICsgLjIgLyBjdXREb3duKTtcbiAgICAgICAgICAgIG92ZXJHcm93bkhlYXBTaXplID0gTWF0aC5taW4ob3Zlckdyb3duSGVhcFNpemUsIHJlcXVlc3RlZFNpemUgKyAxMDA2NjMyOTYpO1xuICAgICAgICAgICAgY29uc3QgbmV3U2l6ZSA9IE1hdGgubWluKG1heEhlYXBTaXplLCBhbGlnblVwKE1hdGgubWF4KHJlcXVlc3RlZFNpemUsIG92ZXJHcm93bkhlYXBTaXplKSwgNjU1MzYpKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlcihuZXdTaXplKTtcbiAgICAgICAgICAgIGlmIChyZXBsYWNlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IFNZU0NBTExTID0ge1xuICAgICAgICBtYXBwaW5nczoge30sXG4gICAgICAgIGJ1ZmZlcnM6IFtudWxsLCBbXSxcbiAgICAgICAgICAgIFtdXG4gICAgICAgIF0sXG4gICAgICAgIHByaW50Q2hhcihzdHJlYW0sIGN1cnIpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IFNZU0NBTExTLmJ1ZmZlcnNbc3RyZWFtXTtcbiAgICAgICAgICAgIGlmIChjdXJyID09PSAwIHx8IGN1cnIgPT09IDEwKSB7XG4gICAgICAgICAgICAgICAgKHN0cmVhbSA9PT0gMSA/IG91dCA6IGVycikoVVRGOEFycmF5VG9TdHJpbmcoYnVmZmVyLCAwKSk7XG4gICAgICAgICAgICAgICAgYnVmZmVyLmxlbmd0aCA9IDBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyLnB1c2goY3VycilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgdmFyYXJnczogdW5kZWZpbmVkLFxuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICBTWVNDQUxMUy52YXJhcmdzICs9IDQ7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBIRUFQMzJbU1lTQ0FMTFMudmFyYXJncyAtIDQgPj4gMl07XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0cihwdHIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IFVURjhUb1N0cmluZyhwdHIpO1xuICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICB9LFxuICAgICAgICBnZXQ2NChsb3cpIHtcbiAgICAgICAgICAgIHJldHVybiBsb3dcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBfZmRfd3JpdGUoZmQsIGlvdiwgaW92Y250LCBwbnVtKSB7XG4gICAgICAgIGxldCBudW0gPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlvdmNudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwdHIgPSBIRUFQMzJbaW92ID4+IDJdO1xuICAgICAgICAgICAgY29uc3QgbGVuID0gSEVBUDMyW2lvdiArIDQgPj4gMl07XG4gICAgICAgICAgICBpb3YgKz0gODtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBTWVNDQUxMUy5wcmludENoYXIoZmQsIEhFQVBVOFtwdHIgKyBqXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG51bSArPSBsZW5cbiAgICAgICAgfVxuICAgICAgICBIRUFQMzJbcG51bSA+PiAyXSA9IG51bTtcbiAgICAgICAgcmV0dXJuIDBcbiAgICB9XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgZnVuY3Rpb24gX3NldFRlbXBSZXQwKHZhbCkge1xuICAgICAgICAvLyBzZXRUZW1wUmV0MCh2YWwpXG4gICAgfVxuICAgIGNvbnN0IGFzbUxpYnJhcnlBcmcgPSB7XG4gICAgICAgIFwiX19hc3NlcnRfZmFpbFwiOiBfX19hc3NlcnRfZmFpbCxcbiAgICAgICAgXCJfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb25cIjogX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbixcbiAgICAgICAgXCJfX2N4YV9hdGV4aXRcIjogX19fY3hhX2F0ZXhpdCxcbiAgICAgICAgXCJfX2N4YV90aHJvd1wiOiBfX19jeGFfdGhyb3csXG4gICAgICAgIFwiYWJvcnRcIjogX2Fib3J0LFxuICAgICAgICBcImVtc2NyaXB0ZW5fbWVtY3B5X2JpZ1wiOiBfZW1zY3JpcHRlbl9tZW1jcHlfYmlnLFxuICAgICAgICBcImVtc2NyaXB0ZW5fcmVzaXplX2hlYXBcIjogX2Vtc2NyaXB0ZW5fcmVzaXplX2hlYXAsXG4gICAgICAgIFwiZmRfd3JpdGVcIjogX2ZkX3dyaXRlLFxuICAgICAgICBcInNldFRlbXBSZXQwXCI6IF9zZXRUZW1wUmV0MFxuICAgIH07XG4gICAgY3JlYXRlV2FzbSgpO1xuICAgIGxldCBfX193YXNtX2NhbGxfY3RvcnMgPSBNb2R1bGUuX19fd2FzbV9jYWxsX2N0b3JzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX19fd2FzbV9jYWxsX2N0b3JzID0gTW9kdWxlLl9fX3dhc21fY2FsbF9jdG9ycyA9IE1vZHVsZS5hc20uX193YXNtX2NhbGxfY3RvcnMpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfbWFpbiA9IE1vZHVsZS5fbWFpbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9tYWluID0gTW9kdWxlLl9tYWluID0gTW9kdWxlLmFzbS5tYWluKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuX2NyZWF0ZVRleHR1cmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfY3JlYXRlVGV4dHVyZSA9IE1vZHVsZS5fY3JlYXRlVGV4dHVyZSA9IE1vZHVsZS5hc20uY3JlYXRlVGV4dHVyZSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9jcmVhdGVCb3VuZGluZyA9IE1vZHVsZS5fY3JlYXRlQm91bmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfY3JlYXRlQm91bmRpbmcgPSBNb2R1bGUuX2NyZWF0ZUJvdW5kaW5nID0gTW9kdWxlLmFzbS5jcmVhdGVCb3VuZGluZykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9zZXRDYW1lcmEgPSBNb2R1bGUuX3NldENhbWVyYSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9zZXRDYW1lcmEgPSBNb2R1bGUuX3NldENhbWVyYSA9IE1vZHVsZS5hc20uc2V0Q2FtZXJhKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX3JlYWRTdHJlYW0gPSBNb2R1bGUuX3JlYWRTdHJlYW0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfcmVhZFN0cmVhbSA9IE1vZHVsZS5fcmVhZFN0cmVhbSA9IE1vZHVsZS5hc20ucmVhZFN0cmVhbSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9wYXRoVHJhY2VyID0gTW9kdWxlLl9wYXRoVHJhY2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX3BhdGhUcmFjZXIgPSBNb2R1bGUuX3BhdGhUcmFjZXIgPSBNb2R1bGUuYXNtLnBhdGhUcmFjZXIpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5fX19lcnJub19sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9fX2Vycm5vX2xvY2F0aW9uID0gTW9kdWxlLl9fX2Vycm5vX2xvY2F0aW9uID0gTW9kdWxlLmFzbS5fX2Vycm5vX2xvY2F0aW9uKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgc3RhY2tTYXZlID0gTW9kdWxlLnN0YWNrU2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKHN0YWNrU2F2ZSA9IE1vZHVsZS5zdGFja1NhdmUgPSBNb2R1bGUuYXNtLnN0YWNrU2F2ZSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IHN0YWNrUmVzdG9yZSA9IE1vZHVsZS5zdGFja1Jlc3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja1Jlc3RvcmUgPSBNb2R1bGUuc3RhY2tSZXN0b3JlID0gTW9kdWxlLmFzbS5zdGFja1Jlc3RvcmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBzdGFja0FsbG9jID0gTW9kdWxlLnN0YWNrQWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja0FsbG9jID0gTW9kdWxlLnN0YWNrQWxsb2MgPSBNb2R1bGUuYXNtLnN0YWNrQWxsb2MpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfbWFsbG9jID0gTW9kdWxlLl9tYWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfbWFsbG9jID0gTW9kdWxlLl9tYWxsb2MgPSBNb2R1bGUuYXNtLm1hbGxvYykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9mcmVlID0gTW9kdWxlLl9mcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2ZyZWUgPSBNb2R1bGUuX2ZyZWUgPSBNb2R1bGUuYXNtLmZyZWUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBkeW5DYWxsX2ppamkgPSBNb2R1bGUuZHluQ2FsbF9qaWppID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoZHluQ2FsbF9qaWppID0gTW9kdWxlLmR5bkNhbGxfamlqaSA9IE1vZHVsZS5hc20uZHluQ2FsbF9qaWppKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBNb2R1bGUuY2NhbGwgPSBjY2FsbDtcbiAgICBNb2R1bGUuc2V0VmFsdWUgPSBzZXRWYWx1ZTtcbiAgICBNb2R1bGUuZ2V0VmFsdWUgPSBnZXRWYWx1ZTtcbiAgICBsZXQgY2FsbGVkUnVuO1xuXG4gICAgZnVuY3Rpb24gRXhpdFN0YXR1cyhzdGF0dXMpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gXCJFeGl0U3RhdHVzXCI7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IGBQcm9ncmFtIHRlcm1pbmF0ZWQgd2l0aCBleGl0KCR7ICBzdGF0dXMgIH0pYDtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXNcbiAgICB9XG4gICAgbGV0IGNhbGxlZE1haW4gPSBmYWxzZTtcbiAgICBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBmdW5jdGlvbiBydW5DYWxsZXIoKSB7XG4gICAgICAgIGlmICghY2FsbGVkUnVuKSBydW4oKTtcbiAgICAgICAgaWYgKCFjYWxsZWRSdW4pIGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IHJ1bkNhbGxlclxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBjYWxsTWFpbihhcmdzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5RnVuY3Rpb24gPSBNb2R1bGUuX21haW47XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IFtdO1xuICAgICAgICBjb25zdCBhcmdjID0gYXJncy5sZW5ndGggKyAxO1xuICAgICAgICBjb25zdCBhcmd2ID0gc3RhY2tBbGxvYygoYXJnYyArIDEpICogNCk7XG4gICAgICAgIEhFQVAzMlthcmd2ID4+IDJdID0gYWxsb2NhdGVVVEY4T25TdGFjayh0aGlzUHJvZ3JhbSk7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgYXJnYzsgaSsrKSB7XG4gICAgICAgICAgICBIRUFQMzJbKGFyZ3YgPj4gMikgKyBpXSA9IGFsbG9jYXRlVVRGOE9uU3RhY2soYXJnc1tpIC0gMV0pXG4gICAgICAgIH1cbiAgICAgICAgSEVBUDMyWyhhcmd2ID4+IDIpICsgYXJnY10gPSAwO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmV0ID0gZW50cnlGdW5jdGlvbihhcmdjLCBhcmd2KTtcbiAgICAgICAgICAgIGV4aXQocmV0LCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZUV4Y2VwdGlvbihlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICAgICAgY2FsbGVkTWFpbiA9IHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJ1bihhcmdzKSB7XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IGFyZ3VtZW50c187XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBwcmVSdW4oKTtcbiAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY2llcyA+IDApIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZG9SdW4oKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGVkUnVuKSByZXR1cm47XG4gICAgICAgICAgICBjYWxsZWRSdW4gPSB0cnVlO1xuICAgICAgICAgICAgTW9kdWxlLmNhbGxlZFJ1biA9IHRydWU7XG4gICAgICAgICAgICBpZiAoQUJPUlQpIHJldHVybjtcbiAgICAgICAgICAgIGluaXRSdW50aW1lKCk7XG4gICAgICAgICAgICBwcmVNYWluKCk7XG4gICAgICAgICAgICBpZiAoTW9kdWxlLm9uUnVudGltZUluaXRpYWxpemVkKSBNb2R1bGUub25SdW50aW1lSW5pdGlhbGl6ZWQoKTtcbiAgICAgICAgICAgIGlmIChzaG91bGRSdW5Ob3cpIGNhbGxNYWluKGFyZ3MpO1xuICAgICAgICAgICAgcG9zdFJ1bigpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1vZHVsZS5zZXRTdGF0dXMpIHtcbiAgICAgICAgICAgIE1vZHVsZS5zZXRTdGF0dXMoXCJSdW5uaW5nLi4uXCIpO1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIE1vZHVsZS5zZXRTdGF0dXMoXCJcIilcbiAgICAgICAgICAgICAgICB9LCAxKTtcbiAgICAgICAgICAgICAgICBkb1J1bigpXG4gICAgICAgICAgICB9LCAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9SdW4oKVxuICAgICAgICB9XG4gICAgfVxuICAgIE1vZHVsZS5ydW4gPSBydW47XG5cbiAgICBmdW5jdGlvbiBleGl0KHN0YXR1cykge1xuICAgICAgICBFWElUU1RBVFVTID0gc3RhdHVzO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHlcbiAgICAgICAgaWYgKGtlZXBSdW50aW1lQWxpdmUoKSkge30gZWxzZSB7XG4gICAgICAgICAgICBleGl0UnVudGltZSgpXG4gICAgICAgIH1cbiAgICAgICAgcHJvY0V4aXQoc3RhdHVzKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2NFeGl0KGNvZGUpIHtcbiAgICAgICAgRVhJVFNUQVRVUyA9IGNvZGU7XG4gICAgICAgIGlmICgha2VlcFJ1bnRpbWVBbGl2ZSgpKSB7XG4gICAgICAgICAgICBpZiAoTW9kdWxlLm9uRXhpdCkgTW9kdWxlLm9uRXhpdChjb2RlKTtcbiAgICAgICAgICAgIEFCT1JUID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIHF1aXRfKGNvZGUsIG5ldyBFeGl0U3RhdHVzKGNvZGUpKVxuICAgIH1cbiAgICBpZiAoTW9kdWxlLnByZUluaXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBNb2R1bGUucHJlSW5pdCA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucHJlSW5pdCA9IFtNb2R1bGUucHJlSW5pdF07XG4gICAgICAgIHdoaWxlIChNb2R1bGUucHJlSW5pdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBNb2R1bGUucHJlSW5pdC5wb3AoKSgpXG4gICAgICAgIH1cbiAgICB9XG4gICAgbGV0IHNob3VsZFJ1bk5vdyA9IHRydWU7XG4gICAgaWYgKE1vZHVsZS5ub0luaXRpYWxSdW4pIHNob3VsZFJ1bk5vdyA9IGZhbHNlO1xuICAgIHJ1bigpO1xuXG4gICAgcmV0dXJuIE1vZHVsZTtcbn1cbiIsbnVsbCxudWxsXSwibmFtZXMiOlsiVEVYVFVSRV9TSVpFIiwiUmVuZGVyZXIiLCJ3YXNtTWFuYWdlciIsInRleHR1cmVDYW52YXMiLCJpc1dvcmtlciIsInBpeGVsRGF0YSIsImNhbWVyYUJ1ZiIsInJlbmRlckN0eCIsImNvbnN0cnVjdG9yIiwid2luZG93IiwiT2Zmc2NyZWVuQ2FudmFzIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwid2lkdGgiLCJoZWlnaHQiLCJjcmVhdGVCb3VuZCIsIm1vZGVsIiwiY3JlYXRlQnVmZmVycyIsInRleHR1cmUiLCJtYXRlcmlhbCIsImlzVmFsaWQiLCJpZCIsImJ1ZmZlciIsImNhbGxGdW5jdGlvbiIsImNhbGxDcmVhdGVCb3VuZGluZyIsInBvc2l0aW9uQnVmZmVyIiwibGVuZ3RoIiwiaW5kaWNpZXNCdWZmZXIiLCJub3JtYWxCdWZmZXIiLCJ0ZXhjb29yZEJ1ZmZlciIsIm1hdHJpeEJ1ZmZlciIsInJlbmRlciIsImNhbnZhcyIsImNhbWVyYSIsImN0eCIsImdldENvbnRleHQiLCJjb25zb2xlIiwiZXJyb3IiLCJpbWFnZWRhdGEiLCJjcmVhdGVJbWFnZURhdGEiLCJwaXhlbHMiLCJkYXRhIiwicmVsZWFzZSIsImNyZWF0ZUJ1ZmZlciIsInNldEFycmF5IiwiZHVtcEFzQXJyYXkiLCJjYWxsU2V0Q2FtZXJhIiwicmVzdWx0IiwiY2FsbFBhdGhUcmFjZXIiLCJyZXN1bHQyIiwiY2FsbFJlYWRTdHJlYW0iLCJyZW5kZXJmdW5jIiwidGltZXIiLCJzZXRJbnRlcnZhbCIsImkiLCJnZXQiLCJwdXRJbWFnZURhdGEiLCJjbGVhckludGVydmFsIiwicHJlcGFyZVBhcnRpYWxSZW5kZXJpbmciLCJpbWFnZURhdGEiLCJwYXJ0aWFsUmVuZGVyaW5nIiwidXBkYXRlIiwiVmVjdG9yMyIsIngiLCJ5IiwieiIsIl94IiwiX3kiLCJfeiIsInNldCIsImxlbmd0aDIiLCJNYXRoIiwic3FydCIsImRpc3RhbmNlIiwiYSIsImFkZCIsInN1YnRyYWN0IiwibXVsdGlwbHkiLCJkaXZpZGUiLCJhc3NlcnQiLCJub3JtYWxpemUiLCJkb3QiLCJjcm9zcyIsImVxdWFsIiwiY29weSIsImdldEFycmF5IiwiRmxvYXQzMkFycmF5IiwiVmVjdG9yNCIsInciLCJfdyIsIk1hdHJpeDQiLCJtYXRyaXgiLCJudW1BcnJheSIsImV5ZSIsImVtcHR5IiwiZmlsbCIsInNjYWxlTWF0cml4Iiwic2NhbGUiLCJ0cmFuc2xhdGVNYXRyaXgiLCJtb3ZlIiwibSIsIm4iLCJzdWIiLCJtdWwiLCJ0cmFuc3Bvc2UiLCJpbnZlcnNlIiwibWF0IiwiYiIsImMiLCJkIiwiZSIsImYiLCJnIiwiaCIsImoiLCJrIiwibCIsIm8iLCJwIiwicSIsInIiLCJzIiwidCIsInUiLCJ2IiwiQSIsIkIiLCJpdmQiLCJFcnJvciIsImRlc3QiLCJnZXRTY2FsZVJvdGF0aW9uTWF0cml4IiwiZ2V0VHJhbnNsYXRlVmVjdG9yIiwiUXVhdGVybmlvbiIsImFuZ2xlQXhpcyIsImFuZ2xlIiwiX2F4aXMiLCJheGlzIiwic2luIiwiY29zIiwiZXVsYXJBbmdsZSIsInJvdCIsInhjIiwieHMiLCJ5YyIsInlzIiwiemMiLCJ6cyIsImZyb21NYXRyaXgiLCJtMDAiLCJtMTAiLCJtMjAiLCJtMDEiLCJtMTEiLCJtMjEiLCJtMDIiLCJtMTIiLCJtMjIiLCJlbGVtZW50IiwibWF4SW5kZXgiLCJsZW4iLCJUcmFuc2Zvcm0iLCJyb3RhdGlvbiIsInBvc2l0aW9uIiwidHJhbnNsYXRlIiwiTW9kZWwiLCJfcG9zaXRpb24iLCJfcG9zaXRpb25CdWZmZXIiLCJfbm9ybWFsIiwiX25vcm1hbEJ1ZmZlciIsIl90ZXhjb29yZCIsIl90ZXhjb29yZEJ1ZmZlciIsIl9pbmRpY2llcyIsIkludDMyQXJyYXkiLCJfaW5kaWNpZXNCdWZmZXIiLCJfYm91bmRpbmdCb3giLCJtaW4iLCJtYXgiLCJfbWF0cml4IiwiX21hdHJpeEJ1ZmZlciIsIl90cmFuc2Zvcm0iLCJfbWF0ZXJpYWwiLCJjcmVhdGVCb3VuZGluZ0JveCIsInBvcyIsInRyYW5zZm9ybSIsIm5vcm1hbCIsInRleGNvb3JkIiwiaW5kaWNpZXMiLCJtYW5hZ2VyIiwiY29uY2F0IiwiYm91bmRpbmdCb3giLCJHTFRGTG9hZGVyIiwicmF3SnNvbiIsImxvYWQiLCJ1cmwiLCJyZXNwb25zZSIsImZldGNoIiwiaGVhZGVycyIsImpzb24iLCJhbmFsaXplIiwibm9kZXMiLCJtZXNoZXMiLCJhY2Nlc3NvcnMiLCJidWZmZXJWaWV3cyIsImJ1ZmZlcnMiLCJBcnJheSIsImlzQXJyYXkiLCJub2RlIiwicHJpbWl0aXZlcyIsInByaW1pdGl2ZSIsImJ1ZlBvcyIsImF0dHJpYnV0ZXMiLCJQT1NJVElPTiIsImJ1Zk5vcm0iLCJOT1JNQUwiLCJidWZUZXgiLCJURVhDT09SRF8wIiwiYnVmSW5kIiwiaW5kaWNlcyIsInVyaSIsInRyYW5zbGF0aW9uIiwiYmxvYiIsImFycmF5QnVmZmVyIiwiYnl0ZU9mZnNldCIsImJ5dGVMZW5ndGgiLCJmcm9tIiwiSW50MTZBcnJheSIsIk1BVEVSSUFMX1VOSUZPUk1fTEVOR1RIIiwiTWF0ZXJpYWwiLCJfbWF0ZXJpYWxCdWZmZXIiLCJjcmVhdGVPcHRpb25BcnJheSIsIkdsYXNzIiwiX3JobyIsInJobyIsIkRpZmZ1c2UiLCJjb2xvciIsIkNhbWVyYSIsIl9wb3MiLCJfZm9yd2FyZCIsIl90b3AiLCJfcmlnaHQiLCJfZGlzdCIsInZpZXdBbmdsZSIsInRhbiIsImZvcndhcmQiLCJyaWdodCIsInRvcCIsImRpc3QiLCJhdGFuIiwibG9va0F0IiwidG8iLCJJTUFHRV9TSVpFIiwiVGV4dHVyZSIsImltYWdlIiwibmVlZHNVcGRhdGUiLCJpbWFnZUFycmF5IiwidmFsaWQiLCJfYnVmZmVyIiwiY3JlYXRlUGl4ZWxBcnJheSIsImRyYXdJbWFnZSIsImdldEltYWdlRGF0YSIsIndhc20iLCJsb2FkV29ya2VySW1hZ2UiLCJpbWFnZVJlc3BvbnNlIiwiaW1hZ2VCbG9iIiwiY3JlYXRlSW1hZ2VCaXRtYXAiLCJXYXNtQnVmZmVyIiwiX21vZHVsZSIsIl9iYXNlIiwiX3R5cGUiLCJfc3RyaWRlIiwiX2xlbmd0aCIsInR5cGUiLCJtb2R1bGUiLCJzaXplIiwiX21hbGxvYyIsImluZGV4IiwiZ2V0VmFsdWUiLCJ2YWx1ZSIsInNldFZhbHVlIiwiYXJyYXkiLCJmb3JFYWNoIiwiZ2V0UG9pbnRlciIsIl9mcmVlIiwiV2FzbU1vZHVsZUdlbmVyYXRvciIsIk1vZHVsZSIsImFyZ3VtZW50c18iLCJ0aGlzUHJvZ3JhbSIsInF1aXRfIiwic3RhdHVzIiwidG9UaHJvdyIsIkVOVklST05NRU5UX0lTX1dFQiIsIkVOVklST05NRU5UX0lTX1dPUktFUiIsImltcG9ydFNjcmlwdHMiLCJFTlZJUk9OTUVOVF9JU19OT0RFIiwicHJvY2VzcyIsInZlcnNpb25zIiwic2NyaXB0RGlyZWN0b3J5Iiwid29ya2VyR2xvYmFsU2NvcGUiLCJzZWxmIiwibG9jYXRlRmlsZSIsInBhdGgiLCJyZWFkXyIsInJlYWRBc3luYyIsInJlYWRCaW5hcnkiLCJsb2dFeGNlcHRpb25PbkV4aXQiLCJFeGl0U3RhdHVzIiwidG9Mb2ciLCJlcnIiLCJub2RlRlMiLCJub2RlUGF0aCIsInJlcXVpcmUiLCJkaXJuYW1lIiwiX19kaXJuYW1lIiwic2hlbGxfcmVhZCIsImZpbGVuYW1lIiwiYmluYXJ5IiwicmVhZEZpbGVTeW5jIiwicmV0IiwiVWludDhBcnJheSIsIm9ubG9hZCIsIm9uZXJyb3IiLCJyZWFkRmlsZSIsImFyZ3YiLCJyZXBsYWNlIiwic2xpY2UiLCJleHBvcnRzIiwib24iLCJleCIsInJlYXNvbiIsImtlZXBSdW50aW1lQWxpdmUiLCJleGl0Q29kZSIsImV4aXQiLCJpbnNwZWN0IiwibG9jYXRpb24iLCJocmVmIiwiY3VycmVudFNjcmlwdCIsInNyYyIsImluZGV4T2YiLCJzdWJzdHIiLCJsYXN0SW5kZXhPZiIsInhociIsIlhNTEh0dHBSZXF1ZXN0Iiwib3BlbiIsInNlbmQiLCJyZXNwb25zZVRleHQiLCJyZXNwb25zZVR5cGUiLCJvdXQiLCJwcmludCIsImxvZyIsImJpbmQiLCJwcmludEVyciIsIndhcm4iLCJhcmd1bWVudHMiLCJxdWl0IiwiYmFzZTY0VG9BcnJheUJ1ZmZlciIsImJhc2U2NCIsImJpbmFyeV9zdHJpbmciLCJCdWZmZXIiLCJ0b1N0cmluZyIsImF0b2IiLCJieXRlcyIsImNoYXJDb2RlQXQiLCJ3YXNtQmluYXJ5IiwibWFpbldhc20iLCJub0V4aXRSdW50aW1lIiwiV2ViQXNzZW1ibHkiLCJhYm9ydCIsInB0ciIsImNoYXJBdCIsIkhFQVA4IiwiSEVBUDE2IiwiSEVBUDMyIiwidGVtcEk2NCIsInRlbXBEb3VibGUiLCJhYnMiLCJmbG9vciIsImNlaWwiLCJIRUFQRjMyIiwiSEVBUEY2NCIsIk51bWJlciIsIndhc21NZW1vcnkiLCJBQk9SVCIsIkVYSVRTVEFUVVMiLCJjb25kaXRpb24iLCJ0ZXh0IiwiZ2V0Q0Z1bmMiLCJpZGVudCIsImZ1bmMiLCJjY2FsbCIsInJldHVyblR5cGUiLCJhcmdUeXBlcyIsImFyZ3MiLCJ0b0MiLCJzdHIiLCJ1bmRlZmluZWQiLCJzdGFja0FsbG9jIiwic3RyaW5nVG9VVEY4IiwiYXJyIiwid3JpdGVBcnJheVRvTWVtb3J5IiwiY29udmVydFJldHVyblZhbHVlIiwiVVRGOFRvU3RyaW5nIiwiQm9vbGVhbiIsImNBcmdzIiwic3RhY2siLCJjb252ZXJ0ZXIiLCJzdGFja1NhdmUiLCJvbkRvbmUiLCJzdGFja1Jlc3RvcmUiLCJVVEY4RGVjb2RlciIsIlRleHREZWNvZGVyIiwiVVRGOEFycmF5VG9TdHJpbmciLCJoZWFwIiwiaWR4IiwibWF4Qnl0ZXNUb1JlYWQiLCJlbmRJZHgiLCJlbmRQdHIiLCJzdWJhcnJheSIsImRlY29kZSIsInUwIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidTEiLCJ1MiIsImNoIiwiSEVBUFU4Iiwic3RyaW5nVG9VVEY4QXJyYXkiLCJvdXRJZHgiLCJtYXhCeXRlc1RvV3JpdGUiLCJzdGFydElkeCIsIm91dFB0ciIsImxlbmd0aEJ5dGVzVVRGOCIsImFsbG9jYXRlVVRGOE9uU3RhY2siLCJhbGlnblVwIiwibXVsdGlwbGUiLCJ1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyIsImJ1ZiIsIkludDhBcnJheSIsIkhFQVBVMTYiLCJVaW50MTZBcnJheSIsIkhFQVBVMzIiLCJVaW50MzJBcnJheSIsIkZsb2F0NjRBcnJheSIsIndhc21UYWJsZSIsIl9fQVRQUkVSVU5fXyIsIl9fQVRJTklUX18iLCJfX0FUTUFJTl9fIiwiX19BVFBPU1RSVU5fXyIsInJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyIiwicHJlUnVuIiwiYWRkT25QcmVSdW4iLCJzaGlmdCIsImNhbGxSdW50aW1lQ2FsbGJhY2tzIiwiaW5pdFJ1bnRpbWUiLCJwcmVNYWluIiwicG9zdFJ1biIsImFkZE9uUG9zdFJ1biIsImNiIiwidW5zaGlmdCIsImFkZE9uSW5pdCIsInJ1bkRlcGVuZGVuY2llcyIsImRlcGVuZGVuY2llc0Z1bGZpbGxlZCIsImFkZFJ1bkRlcGVuZGVuY3kiLCJtb25pdG9yUnVuRGVwZW5kZW5jaWVzIiwicmVtb3ZlUnVuRGVwZW5kZW5jeSIsImNhbGxiYWNrIiwicHJlbG9hZGVkSW1hZ2VzIiwicHJlbG9hZGVkQXVkaW9zIiwid2hhdCIsIm9uQWJvcnQiLCJSdW50aW1lRXJyb3IiLCJkYXRhVVJJUHJlZml4IiwiaXNEYXRhVVJJIiwic3RhcnRzV2l0aCIsImlzRmlsZVVSSSIsIndhc21CaW5hcnlGaWxlIiwiZ2V0QmluYXJ5IiwiZmlsZSIsImdldEJpbmFyeVByb21pc2UiLCJjcmVkZW50aWFscyIsInRoZW4iLCJvayIsImNhdGNoIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjcmVhdGVXYXNtIiwiaW5mbyIsImFzbUxpYnJhcnlBcmciLCJyZWNlaXZlSW5zdGFuY2UiLCJpbnN0YW5jZSIsImFzbSIsIm1lbW9yeSIsIl9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUiLCJfX3dhc21fY2FsbF9jdG9ycyIsInJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0IiwiaW5zdGFudGlhdGVBcnJheUJ1ZmZlciIsInJlY2VpdmVyIiwiaW5zdGFudGlhdGUiLCJpbnN0YW50aWF0ZUFzeW5jIiwiaW5zdGFudGlhdGVTdHJlYW1pbmciLCJpbnN0YW50aWF0ZVdhc20iLCJjYWxsYmFja3MiLCJhcmciLCJnZXRXYXNtVGFibGVFbnRyeSIsIndhc21UYWJsZU1pcnJvciIsImZ1bmNQdHIiLCJoYW5kbGVFeGNlcHRpb24iLCJfX19hc3NlcnRfZmFpbCIsImxpbmUiLCJfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uIiwiX2F0ZXhpdCIsIl9fX2N4YV9hdGV4aXQiLCJhMCIsImExIiwiRXhjZXB0aW9uSW5mbyIsImV4Y1B0ciIsInNldF90eXBlIiwiZ2V0X3R5cGUiLCJzZXRfZGVzdHJ1Y3RvciIsImRlc3RydWN0b3IiLCJnZXRfZGVzdHJ1Y3RvciIsInNldF9yZWZjb3VudCIsInJlZmNvdW50Iiwic2V0X2NhdWdodCIsImNhdWdodCIsImdldF9jYXVnaHQiLCJzZXRfcmV0aHJvd24iLCJyZXRocm93biIsImdldF9yZXRocm93biIsImluaXQiLCJhZGRfcmVmIiwicmVsZWFzZV9yZWYiLCJwcmV2IiwiX19fY3hhX3Rocm93IiwiX2Fib3J0IiwiX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZyIsIm51bSIsImNvcHlXaXRoaW4iLCJlbXNjcmlwdGVuX3JlYWxsb2NfYnVmZmVyIiwiZ3JvdyIsIl9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwIiwicmVxdWVzdGVkU2l6ZSIsIm9sZFNpemUiLCJtYXhIZWFwU2l6ZSIsImN1dERvd24iLCJvdmVyR3Jvd25IZWFwU2l6ZSIsIm5ld1NpemUiLCJyZXBsYWNlbWVudCIsIlNZU0NBTExTIiwibWFwcGluZ3MiLCJwcmludENoYXIiLCJzdHJlYW0iLCJjdXJyIiwicHVzaCIsInZhcmFyZ3MiLCJnZXRTdHIiLCJnZXQ2NCIsImxvdyIsIl9mZF93cml0ZSIsImZkIiwiaW92IiwiaW92Y250IiwicG51bSIsIl9zZXRUZW1wUmV0MCIsInZhbCIsIl9fX3dhc21fY2FsbF9jdG9ycyIsImFwcGx5IiwiX21haW4iLCJtYWluIiwiX2NyZWF0ZVRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiX2NyZWF0ZUJvdW5kaW5nIiwiY3JlYXRlQm91bmRpbmciLCJfc2V0Q2FtZXJhIiwic2V0Q2FtZXJhIiwiX3JlYWRTdHJlYW0iLCJyZWFkU3RyZWFtIiwiX3BhdGhUcmFjZXIiLCJwYXRoVHJhY2VyIiwiX19fZXJybm9fbG9jYXRpb24iLCJfX2Vycm5vX2xvY2F0aW9uIiwibWFsbG9jIiwiZnJlZSIsImR5bkNhbGxfamlqaSIsImNhbGxlZFJ1biIsIm5hbWUiLCJtZXNzYWdlIiwicnVuQ2FsbGVyIiwicnVuIiwiY2FsbE1haW4iLCJlbnRyeUZ1bmN0aW9uIiwiYXJnYyIsImRvUnVuIiwib25SdW50aW1lSW5pdGlhbGl6ZWQiLCJzaG91bGRSdW5Ob3ciLCJzZXRTdGF0dXMiLCJzZXRUaW1lb3V0IiwicHJvY0V4aXQiLCJjb2RlIiwib25FeGl0IiwicHJlSW5pdCIsInBvcCIsIm5vSW5pdGlhbFJ1biIsIldhc21NYW5hZ2VyIiwiRXZlbnRUYXJnZXQiLCJkaXNwYXRjaEV2ZW50IiwiRXZlbnQiLCJmdW5jbmFtZSIsInJhd0FyZ3MiLCJtYXAiLCJWZWN0b3IyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0lBS0EsTUFBTUEsWUFBWSxHQUFHLElBQXJCO0lBRUE7Ozs7Ozs7VUFNYUM7SUFDSEMsRUFBQUEsV0FBVztJQUVYQyxFQUFBQSxhQUFhO0lBRWJDLEVBQUFBLFFBQVE7SUFFUkMsRUFBQUEsU0FBUyxHQUFzQixJQUF0QjtJQUVUQyxFQUFBQSxTQUFTLEdBQXNCLElBQXRCOztJQUdUQyxFQUFBQSxTQUFTLEdBTU4sSUFOTTtJ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QUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FBckMsR0FBMkNELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FKbkMsRUFLakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXBDLEdBQTBDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxDQUFELENBTGxDLEVBTWpCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFwQyxHQUEwQ0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQU5sQyxFQU9qQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FBckMsR0FBMkNELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FQbkMsRUFRakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFD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
