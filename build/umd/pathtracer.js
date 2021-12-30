
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

    var mainWasm = "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EEALIAIoArgCIgEEQCACIAE2ArwCIAEQQAsgAkEANgIQIAJCADcDCCACKALMAiACKALIAiIEayIBBEAgAUEASA0DIAIgARArIgM2AgggAiADNgIMIAIgAyABQQZ1QQZ0ajYCECACIAMgBCABEEggAWo2AgwLIAJBADYCHCACQgA3AhQgAigC2AIgAigC1AIiCWsiAUHIAG0hBCABBEAgBEHk8bgcTw0EIAIgARArIgM2AhQgAiADNgIYIAIgAyAEQcgAbGo2AhwgAiABQQBKBH8gAyAJIAEQSCABQcgAbkHIAGxqBSADCzYCGAsgAkEgaiAKQYABEEghCiACQaABaiAAQYABEEgaIAIgBTYCoAICQEH07AAoAgAiAUH47AAoAgBHBEAgAUEANgIIIAFCADcCACACKAIMIAIoAghrIgQEQCAEQQBIDQcgASAEECsiAzYCACABIAM2AgQgASADIARBBnVBBnRqNgIIIAEgAigCDCACKAIIIgBrIgRBAEoEfyADIAAgBBBIIARqBSADCzYCBAsgAUIANwIMIAFBADYCFCACKAIYIAIoAhRrIgNByABtIQQgAwRAIARB5PG4HE8NCCABIAMQKyIDNgIMIAEgAzYCECABIAMgBEHIAGxqNgIUIAEgAigCGCACKAIUIgBrIgRBAEoEfyADIAAgBBBIIARByABuQcgAbGoFIAMLNgIQCyABQRhqIApBhAIQSBpB9OwAIAFBoAJqNgIADAELIAJBCGohBAJAAkACQEH07AAoAgBB8OwAKAIAIgBrQaACbSIDQQFqIgFBuZyOB0kEQCABQfjsACgCACAAa0GgAm0iAEEBdCIKIAEgCksbQbicjgcgAEGcjscDSRsiAQR/IAFBuZyOB08NAiABQaACbBArBUEACyIKIANBoAJsaiIAQQA2AgggAEIANwIAAkACQAJAIAQiAygCBCADKAIAayIJBEAgCUEASA0BIAAgCRArIgU2AgAgACAFNgIEIAAgBSAJQQZ1QQZ0ajYCCCAAIAMoAgQgAygCACIMayIJQQBKBH8gBSAMIAkQSCAJagUgBQs2AgQLIABCADcCDCAAQQA2AhQgAygCECADKAIMayIFQcgAbSEJIAUEQCAJQeTxuBxPDQIgACAFECsiBTYCDCAAIAU2AhAgACAFIAlByABsajYCFCAAIAMoAhAgAygCDCIJ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AQsgBiAISgRAIAcPCyADKwMIIgQgAisDCCIFYw0AIAQgBWQEQCAHDwsgAygCECACKAIQSA0AIAcPCyACIAY2AgAgAyAINgIAIAIgBDkDCCADIAU5AwggAigCECEGIAIgAygCEDYCECADIAY2AhACQAJAIAIoAgAiBiABKAIAIghIBEAgAisDCCEEIAErAwghBQwBCyAHQQFqIQMgBiAISg0BIAIrAwgiBCABKwMIIgVjDQAgBCAFZA0BIAIoAhAgASgCEE4NAQsgASAGNgIAIAIgCDYCACABIAQ5AwggAiAFOQMIIAEoAhAhAyABIAIoAhA2AhAgAiADNgIQAkAgASgCACICIAAoAgAiBkgEQCABKwMIIQQgACsDCCEFDAELIAdBAmohAyACIAZKDQEgASsDCCIEIAArAwgiBWMNACAEIAVkDQEgASgCECAAKAIQTg0BCyAAIAI2AgAgASAGNgIAIAAgBDkDCCABIAU5AwggACgCECECIAAgASgCEDYCECABIAI2AhAgB0EDaiEDCyADC9IEAgJ8A38gACABIAIgAxAZIQgCQCAEKAIAIgcgAygCACIJSARAIAQrAwghBSADKwMIIQYMAQsgByAJSgRAIAgPCyAEKwMIIgUgAysDCCIGYw0AIAUgBmQEQCAIDwsgBCgCECADKAIQSA0AIAgPCyADIAc2AgAgBCAJNgIAIAMgBTkDCCAEIAY5AwggAygCECEHIAMgBCgCEDYCECAEIAc2AhACQAJAIAMoAgAiByACKAIAIglIBEAgAysDCCEFIAIrAwghBgwBCyAIQQFqIQQgByAJSg0BIAMrAwgiBSACKwMIIgZjDQAgBSAGZA0BIAMoAhAgAigCEE4NAQsgAiAHNgIAIAMgCTYCACACIAU5AwggAyAGOQMIIAIoAhAhBCACIAMoAhA2AhAgAyAENgIQAkAgAigCACIDIAEoAgAiB0gEQCACKwMIIQUgASsDCCEGDAELIAhBAmohBCADIAdKDQEgAisDCCIFIAErAwgiBmMNACAFIAZkDQEgAigCECABKAIQTg0BCyABIAM2AgAgAiAHNgIAIAEgBTkDCCACIAY5AwggASgCECEDIAEgAigCEDYCECACIAM2AhACQCABKAIAIgMgACgCACICSARAIAErAwghBSAAKwMIIQYMAQsgCEEDaiEEIAIgA0gNASAB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IiAGIQEgAyEADAULIAQgCCIFRg0BA38gBCIAQQhqIQQgAyAAECNFDQADQCADIAVBCGsiBRAjDQALIAAgBU8Ef0EEBSAAIAUQJAwBCwsLIQUgACEDIAVBAmsOAwIAAQALCwsLCw0AIAArAwAgASsDAGMLNQEBfyMAQRBrIgIkACACIAArAwA5AwggACABKwMAOQMAIAEgAkEIaisDADkDACACQRBqJAALUQEBfyAAIAEgAhAnIQQgAyACECMEfyACIAMQJCACIAEQI0UEQCAEQQFqDwsgASACECQgASAAECNFBEAgBEECag8LIAAgARAkIARBA2oFIAQLC2kBAX8gACABIAIgAxAlIQUgBCADECMEfyADIAQQJCADIAIQI0UEQCAFQQFqDwsgAiADECQgAiABECNFBEAgBUECag8LIAEgAhAkIAEgABAjRQRAIAVBA2oPCyAAIAEQJCAFQQRqBSAFCwtqAQJ/IAEgABAjIQQgAiABECMhAwJ/AkAgBEUEQEEAIANFDQIaIAEgAhAkQQEgASAAECNFDQIaIAAgARAkDAELIAMEQCAAIAIQJEEBDwsgACABECRBASACIAEQI0UNARogASACECQLQQILC7ECAQZ/IwBBEGsiBCQAQQEhBgJAAkACQAJAAkACQCABIABrQQN1DgYFBQABAgMECyABQQhrIgIgABAjRQ0EIAAgAhAkDAQLIAAgAEEIaiABQQhrECcaDAMLIAAgAEEIaiAAQRBqIAFBCGsQJRoMAgsgACAAQQhqIABBEGogAEEYaiABQQhrECYaDAELIAAgAEEIaiAAQRBqIgUQJxogAEEYaiEDA0AgASADRg0BAkAgAyAFECMEQCAEIAMrAwA5AwggAyECA0ACQCACIAUiAisDADkDACAAIAJGBEAgACECDAELIARBCGogAkEIayIFECMNAQsLIAIgBEEIaisDADkDACAHQQFqIgdBCEYNAQsgAyEFIANBCGohAwwBCwsgA0EIaiABRiEGCyAEQRBqJAAgBgsEACAACwgAQZgIEA0ACzMBAX8gAEEBIAAbIQECQANAIAEQPyIADQFBqO0AKAIAIgAEQCAAEQgADAELCxADAAsgAAsGACAAEEALBQBB4QgLOQECfyAAQfQiNgIAIABBBGooAgBBDGsiAkEIaiIBIAEoAgBBAWsiATYCACABQQBIBEAg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QQAgACABTRsNACAAPwBBEHRLBEAgABAERQ0BC0GI1wAgADYCACABDwtBrO0AQTA2AgBBfwuoAQACQCABQYAITgRAIABEAAAAAAAA4H+iIQAgAUH/D0kEQCABQf8HayEBDAILIABEAAAAAAAA4H+iIQAgAUH9FyABQf0XSRtB/g9rIQEMAQsgAUGBeEoNACAARAAAAAAAAGADoiEAIAFBuHBLBEAgAUHJB2ohAQwBCyAARAAAAAAAAGADoiEAIAFB8GggAUHwaEsbQZIPaiEBCyAAIAFB/wdqrUI0hr+iCx4BAX8jAEEQayICIAGaIAEgABs5AwggAisDCCABogsPACAARAAAAAAAAABwEEMLDwAgAEQAAAAAAAAAEBBDC90KAwl8A34GfyMAQRBrIhEkAAJAAkAgAb0iDEI0iKciEkH/D3EiE0G+CGsiDkH/fksgAL0iC0I0iKciD0H/D2tBgnBPcQ0AIAxCAYYiDUIBfUL/////////b1oEQEQAAAAAAADwPyECIA1QDQIgC0KAgICAgICA+D9RDQIgDUKBgICAgICAcFQgC0IBhiILQoCAgICAgIBwWHFFBEAgACABoCECDAMLIAtCgICAgICAgPD/AFENAkQAAAAAAAAAACABIAGiIAxCP4hQIAtCgICAgICAgPD/AFRGGyECDAILIAtCAYZCAX1C/////////29aBEAgACAAoiECIAtCAFMEQCACmiACIAwQR0EBRhshAgsgDEIAWQ0CIBFEAAAAAAAA8D8gAqM5AwggESsDCCECDAILIAtCAFMEQCAMEEciEEUEQCAAIAChIgAgAKMhAgwDCyAPQf8PcSEPIBBBAUZBEnQhECALQv///////////wCDIQsLIA5B/35NBEBEAAAAAAAA8D8hAiALQoCAgICAgID4P1ENAiATQb0HTQRAIAEgAZogC0KAgICAgICA+D9WG0QAAAAAAADwP6AhAgwDCyASQYAQSSALQoGAgICAgID4P1RHBEBBABBEIQIMAwtBABBFIQIMAgsgDw0AIABEAAAAAAAAMEOivUL///////////8Ag0KAgICAgICAoAN9IQsLAkAgDEKAgIBAg78iBiALIAtCgICAgNCqpfM/fSIMQoCAgICAgIB4g30iC0KAgICACHxCgICAgHCDvyICIAxCLYinQf8AcUEFdCIOQYg3aisD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";

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aHRyYWNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvcmVuZGVyZXIvUmVuZGVyZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IzLnRzIiwiLi4vLi4vc3JjL21hdGgvVmVjdG9yNC50cyIsIi4uLy4uL3NyYy9tYXRoL01hdHJpeDQudHMiLCIuLi8uLi9zcmMvbWF0aC9RdWF0ZXJuaW9uLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvVHJhbnNmb3JtLnRzIiwiLi4vLi4vc3JjL2NvcmUvbW9kZWwvTW9kZWwudHMiLCIuLi8uLi9zcmMvY29yZS9tb2RlbC9HTFRGTG9hZGVyLnRzIiwiLi4vLi4vc3JjL2NvcmUvbWF0ZXJpYWwvTWF0ZXJpYWwudHMiLCIuLi8uLi9zcmMvY29yZS9tYXRlcmlhbC9HbGFzcy50cyIsIi4uLy4uL3NyYy9jb3JlL21hdGVyaWFsL0RpZmZ1c2UudHMiLCIuLi8uLi9zcmMvY29yZS9jYW1lcmEvQ2FtZXJhLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9UZXh0dXJlLnRzIiwiLi4vLi4vc3JjL2NvcmUvdGV4dHVyZS9Xb3JrZXJJbWFnZS50cyIsIi4uLy4uL3NyYy9jb3JlL3dhc20vV2FzbUJ1ZmZlci50cyIsIi4uLy4uL3NyYy9jb3JlL3dhc20vV2FzbU1vZHVsZS5qcyIsIi4uLy4uL3NyYy9jb3JlL3dhc20vV2FzbU1hbmFnZXIudHMiLCIuLi8uLi9zcmMvbWF0aC9WZWN0b3IyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsIi8qIGVzbGludC1kaXNhYmxlIHByZWZlci1yZXN0LXBhcmFtcyAqL1xuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItc3ByZWFkICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1yZXR1cm4tYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBjb25zaXN0ZW50LXJldHVybiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tbXVsdGktYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb250aW51ZSAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcGx1c3BsdXMgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLW5lc3RlZC10ZXJuYXJ5ICovXG4vKiBlc2xpbnQtZGlzYWJsZSBwcmVmZXItZGVzdHJ1Y3R1cmluZyAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuLyogZXNsaW50LWRpc2FibGUgdmFycy1vbi10b3AgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1zaGFkb3cgKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4vKiBlc2xpbnQtZGlzYWJsZSBnbG9iYWwtcmVxdWlyZSAqL1xuLyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5pbXBvcnQgbWFpbldhc20gZnJvbSAnLi4vLi4vLi4vYnVpbGQvd2FzbS9tYWluLndhc20nO1xuXG5leHBvcnQgLyoqXG4gKiBXYXNtIG1vZHVsZSBnZW5lcmF0b3IuIFRoaXMgY29kZSBpcyBiYXNlZCBvbiBFbXNjcmlwdGVuIGRlZmF1bHQganMgdGVtcGxhdGUuXG4gKlxuICogQHJldHVybiB7Kn0gXG4gKi9cbmNvbnN0IFdhc21Nb2R1bGVHZW5lcmF0b3IgPSAoKSA9PiB7XG4gICAgY29uc3QgTW9kdWxlID0ge307XG4gICAgbGV0IGFyZ3VtZW50c18gPSBbXTtcbiAgICBsZXQgdGhpc1Byb2dyYW0gPSBcIi4vdGhpcy5wcm9ncmFtXCI7XG4gICAgbGV0IHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgIHRocm93IHRvVGhyb3dcbiAgICB9O1xuICAgIGNvbnN0IEVOVklST05NRU5UX0lTX1dFQiA9IHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCI7XG4gICAgY29uc3QgRU5WSVJPTk1FTlRfSVNfV09SS0VSID0gdHlwZW9mIGltcG9ydFNjcmlwdHMgPT09IFwiZnVuY3Rpb25cIjtcbiAgICBjb25zdCBFTlZJUk9OTUVOVF9JU19OT0RFID0gdHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MudmVyc2lvbnMubm9kZSA9PT0gXCJzdHJpbmdcIjtcbiAgICBsZXQgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLWdsb2JhbHNcbiAgICBjb25zdCB3b3JrZXJHbG9iYWxTY29wZSA9IEVOVklST05NRU5UX0lTX1dPUktFUiA/IHNlbGYgOiBudWxsO1xuXG4gICAgZnVuY3Rpb24gbG9jYXRlRmlsZShwYXRoKSB7XG4gICAgICAgIGlmIChNb2R1bGUubG9jYXRlRmlsZSkge1xuICAgICAgICAgICAgcmV0dXJuIE1vZHVsZS5sb2NhdGVGaWxlKHBhdGgsIHNjcmlwdERpcmVjdG9yeSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2NyaXB0RGlyZWN0b3J5ICsgcGF0aFxuICAgIH1cbiAgICBsZXQgcmVhZF87IGxldCByZWFkQXN5bmM7IGxldCByZWFkQmluYXJ5O1xuXG4gICAgZnVuY3Rpb24gbG9nRXhjZXB0aW9uT25FeGl0KGUpIHtcbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFeGl0U3RhdHVzKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRvTG9nID0gZTtcbiAgICAgICAgZXJyKGBleGl0aW5nIGR1ZSB0byBleGNlcHRpb246ICR7ICB0b0xvZ31gKVxuICAgIH1cbiAgICBsZXQgbm9kZUZTO1xuICAgIGxldCBub2RlUGF0aDtcbiAgICBpZiAoRU5WSVJPTk1FTlRfSVNfTk9ERSkge1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBgJHtyZXF1aXJlKFwicGF0aFwiKS5kaXJuYW1lKHNjcmlwdERpcmVjdG9yeSkgIH0vYFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gYCR7X19kaXJuYW1lICB9L2BcbiAgICAgICAgfVxuICAgICAgICByZWFkXyA9IGZ1bmN0aW9uIHNoZWxsX3JlYWQoZmlsZW5hbWUsIGJpbmFyeSkge1xuICAgICAgICAgICAgaWYgKCFub2RlRlMpIG5vZGVGUyA9IHJlcXVpcmUoXCJmc1wiKTtcbiAgICAgICAgICAgIGlmICghbm9kZVBhdGgpIG5vZGVQYXRoID0gcmVxdWlyZShcInBhdGhcIik7XG4gICAgICAgICAgICBmaWxlbmFtZSA9IG5vZGVQYXRoLm5vcm1hbGl6ZShmaWxlbmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZUZTLnJlYWRGaWxlU3luYyhmaWxlbmFtZSwgYmluYXJ5ID8gbnVsbCA6IFwidXRmOFwiKVxuICAgICAgICB9O1xuICAgICAgICByZWFkQmluYXJ5ID0gZnVuY3Rpb24gcmVhZEJpbmFyeShmaWxlbmFtZSkge1xuICAgICAgICAgICAgbGV0IHJldCA9IHJlYWRfKGZpbGVuYW1lLCB0cnVlKTtcbiAgICAgICAgICAgIGlmICghcmV0LmJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldCA9IG5ldyBVaW50OEFycmF5KHJldClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFzc2VydChyZXQuYnVmZmVyKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZEFzeW5jID0gZnVuY3Rpb24gcmVhZEFzeW5jKGZpbGVuYW1lLCBvbmxvYWQsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICghbm9kZUZTKSBub2RlRlMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgICAgICAgICBpZiAoIW5vZGVQYXRoKSBub2RlUGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpO1xuICAgICAgICAgICAgZmlsZW5hbWUgPSBub2RlUGF0aC5ub3JtYWxpemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgbm9kZUZTLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikgb25lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIGVsc2Ugb25sb2FkKGRhdGEuYnVmZmVyKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHByb2Nlc3MuYXJndi5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aGlzUHJvZ3JhbSA9IHByb2Nlc3MuYXJndlsxXS5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxuICAgICAgICB9XG4gICAgICAgIGFyZ3VtZW50c18gPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMik7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZHVsZVxuICAgICAgICB9XG4gICAgICAgIHByb2Nlc3Mub24oXCJ1bmNhdWdodEV4Y2VwdGlvblwiLCAoZXgpID0+IHtcbiAgICAgICAgICAgIGlmICghKGV4IGluc3RhbmNlb2YgRXhpdFN0YXR1cykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBleFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcHJvY2Vzcy5vbihcInVuaGFuZGxlZFJlamVjdGlvblwiLCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyByZWFzb25cbiAgICAgICAgfSk7XG4gICAgICAgIHF1aXRfID0gZnVuY3Rpb24oc3RhdHVzLCB0b1Rocm93KSB7XG4gICAgICAgICAgICBpZiAoa2VlcFJ1bnRpbWVBbGl2ZSgpKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5leGl0Q29kZSA9IHN0YXR1cztcbiAgICAgICAgICAgICAgICB0aHJvdyB0b1Rocm93XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2dFeGNlcHRpb25PbkV4aXQodG9UaHJvdyk7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoc3RhdHVzKVxuICAgICAgICB9O1xuICAgICAgICBNb2R1bGUuaW5zcGVjdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiW0Vtc2NyaXB0ZW4gTW9kdWxlIG9iamVjdF1cIlxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChFTlZJUk9OTUVOVF9JU19XRUIgfHwgRU5WSVJPTk1FTlRfSVNfV09SS0VSKSB7XG4gICAgICAgIGlmIChFTlZJUk9OTUVOVF9JU19XT1JLRVIpIHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLWdsb2JhbHNcbiAgICAgICAgICAgIHNjcmlwdERpcmVjdG9yeSA9IHNlbGYubG9jYXRpb24uaHJlZlxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkb2N1bWVudC5jdXJyZW50U2NyaXB0KSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBkb2N1bWVudC5jdXJyZW50U2NyaXB0LnNyY1xuICAgICAgICB9XG4gICAgICAgIGlmIChzY3JpcHREaXJlY3RvcnkuaW5kZXhPZihcImJsb2I6XCIpICE9PSAwKSB7XG4gICAgICAgICAgICBzY3JpcHREaXJlY3RvcnkgPSBzY3JpcHREaXJlY3Rvcnkuc3Vic3RyKDAsIHNjcmlwdERpcmVjdG9yeS5yZXBsYWNlKC9bPyNdLiovLCBcIlwiKS5sYXN0SW5kZXhPZihcIi9cIikgKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIlxuICAgICAgICB9XG4gICAgICAgIHJlYWRfID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIGZhbHNlKTtcbiAgICAgICAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgcmVhZEJpbmFyeSA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgICAgICAgICB4aHIub3BlbihcIkdFVFwiLCB1cmwsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuICAgICAgICAgICAgICAgIHhoci5zZW5kKG51bGwpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSh4aHIucmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVhZEFzeW5jID0gZnVuY3Rpb24odXJsLCBvbmxvYWQsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgICAgIHhoci5vcGVuKFwiR0VUXCIsIHVybCwgdHJ1ZSk7XG4gICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuICAgICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDAgfHwgeGhyLnN0YXR1cyA9PT0gMCAmJiB4aHIucmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgb25sb2FkKHhoci5yZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbmVycm9yKClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB4aHIub25lcnJvciA9IG9uZXJyb3I7XG4gICAgICAgICAgICB4aHIuc2VuZChudWxsKVxuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IG91dCA9IE1vZHVsZS5wcmludCB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGNvbnN0IGVyciA9IE1vZHVsZS5wcmludEVyciB8fCBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIGlmIChNb2R1bGUuYXJndW1lbnRzKSBhcmd1bWVudHNfID0gTW9kdWxlLmFyZ3VtZW50cztcbiAgICBpZiAoTW9kdWxlLnRoaXNQcm9ncmFtKSB0aGlzUHJvZ3JhbSA9IE1vZHVsZS50aGlzUHJvZ3JhbTtcbiAgICBpZiAoTW9kdWxlLnF1aXQpIHF1aXRfID0gTW9kdWxlLnF1aXQ7XG5cbiAgICBmdW5jdGlvbiBiYXNlNjRUb0FycmF5QnVmZmVyKGJhc2U2NCkge1xuICAgICAgICBsZXQgYmluYXJ5X3N0cmluZyA9ICcnO1xuICAgICAgICBpZiAoRU5WSVJPTk1FTlRfSVNfTk9ERSkge1xuICAgICAgICAgICAgYmluYXJ5X3N0cmluZyA9IEJ1ZmZlci5mcm9tKGJhc2U2NCwgJ2Jhc2U2NCcpLnRvU3RyaW5nKCdhc2NpaScpO1xuICAgICAgICB9IGVsc2UgaWYgKEVOVklST05NRU5UX0lTX1dPUktFUikge1xuICAgICAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSB3b3JrZXJHbG9iYWxTY29wZS5hdG9iKGJhc2U2NCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJpbmFyeV9zdHJpbmcgPSB3aW5kb3cuYXRvYihiYXNlNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICBjb25zdCBsZW4gPSBiaW5hcnlfc3RyaW5nLmxlbmd0aDtcbiAgICAgICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShsZW4pO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGJ5dGVzW2ldID0gYmluYXJ5X3N0cmluZy5jaGFyQ29kZUF0KGkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlcy5idWZmZXI7XG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbUJpbmFyeSA9IGJhc2U2NFRvQXJyYXlCdWZmZXIobWFpbldhc20pO1xuICAgIGNvbnN0IG5vRXhpdFJ1bnRpbWUgPSBNb2R1bGUubm9FeGl0UnVudGltZSB8fCB0cnVlO1xuICAgIGlmICh0eXBlb2YgV2ViQXNzZW1ibHkgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgYWJvcnQoXCJubyBuYXRpdmUgd2FzbSBzdXBwb3J0IGRldGVjdGVkXCIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0VmFsdWUocHRyLCB2YWx1ZSwgdHlwZSkge1xuICAgICAgICB0eXBlID0gdHlwZSB8fCBcImk4XCI7XG4gICAgICAgIGlmICh0eXBlLmNoYXJBdCh0eXBlLmxlbmd0aCAtIDEpID09PSBcIipcIikgdHlwZSA9IFwiaTMyXCI7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImkxXCI6XG4gICAgICAgICAgICAgICAgSEVBUDhbcHRyID4+IDBdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaThcIjpcbiAgICAgICAgICAgICAgICBIRUFQOFtwdHIgPj4gMF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJpMTZcIjpcbiAgICAgICAgICAgICAgICBIRUFQMTZbcHRyID4+IDFdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaTMyXCI6XG4gICAgICAgICAgICAgICAgSEVBUDMyW3B0ciA+PiAyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImk2NFwiOlxuICAgICAgICAgICAgICAgIHRlbXBJNjQgPSBbXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID4+PiAwLFxuICAgICAgICAgICAgICAgICAgICAodGVtcERvdWJsZSA9IHZhbHVlLCArTWF0aC5hYnModGVtcERvdWJsZSkgPj0gMSA/IHRlbXBEb3VibGUgPiAwID8gKE1hdGgubWluKCtNYXRoLmZsb29yKHRlbXBEb3VibGUgLyA0Mjk0OTY3Mjk2KSwgNDI5NDk2NzI5NSkgfCAwKSA+Pj4gMCA6IH5+K01hdGguY2VpbCgodGVtcERvdWJsZSAtICsofn50ZW1wRG91YmxlID4+PiAwKSkgLyA0Mjk0OTY3Mjk2KSA+Pj4gMCA6IDApXTtcbiAgICAgICAgICAgICAgICBIRUFQMzJbcHRyID4+IDJdID0gdGVtcEk2NFswXTtcbiAgICAgICAgICAgICAgICBIRUFQMzJbcHRyICsgNCA+PiAyXSA9IHRlbXBJNjRbMV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICAgICAgICBIRUFQRjMyW3B0ciA+PiAyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImRvdWJsZVwiOlxuICAgICAgICAgICAgICAgIEhFQVBGNjRbcHRyID4+IDNdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGFib3J0KGBpbnZhbGlkIHR5cGUgZm9yIHNldFZhbHVlOiAkeyAgdHlwZX1gKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VmFsdWUocHRyLCB0eXBlKSB7XG4gICAgICAgIHR5cGUgPSB0eXBlIHx8IFwiaThcIjtcbiAgICAgICAgaWYgKHR5cGUuY2hhckF0KHR5cGUubGVuZ3RoIC0gMSkgPT09IFwiKlwiKSB0eXBlID0gXCJpMzJcIjtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFwiaTFcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDhbcHRyID4+IDBdO1xuICAgICAgICAgICAgY2FzZSBcImk4XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIEhFQVA4W3B0ciA+PiAwXTtcbiAgICAgICAgICAgIGNhc2UgXCJpMTZcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDE2W3B0ciA+PiAxXTtcbiAgICAgICAgICAgIGNhc2UgXCJpMzJcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJpNjRcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gSEVBUDMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBIRUFQRjMyW3B0ciA+PiAyXTtcbiAgICAgICAgICAgIGNhc2UgXCJkb3VibGVcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKEhFQVBGNjRbcHRyID4+IDNdKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYWJvcnQoYGludmFsaWQgdHlwZSBmb3IgZ2V0VmFsdWU6ICR7ICB0eXBlfWApXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgbGV0IHdhc21NZW1vcnk7XG4gICAgbGV0IEFCT1JUID0gZmFsc2U7XG4gICAgbGV0IEVYSVRTVEFUVVM7XG5cbiAgICBmdW5jdGlvbiBhc3NlcnQoY29uZGl0aW9uLCB0ZXh0KSB7XG4gICAgICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICAgICAgICBhYm9ydChgQXNzZXJ0aW9uIGZhaWxlZDogJHsgIHRleHR9YClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldENGdW5jKGlkZW50KSB7XG4gICAgICAgIGNvbnN0IGZ1bmMgPSBNb2R1bGVbYF8keyAgaWRlbnR9YF07XG4gICAgICAgIGFzc2VydChmdW5jLCBgQ2Fubm90IGNhbGwgdW5rbm93biBmdW5jdGlvbiAkeyAgaWRlbnQgIH0sIG1ha2Ugc3VyZSBpdCBpcyBleHBvcnRlZGApO1xuICAgICAgICByZXR1cm4gZnVuY1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNjYWxsKGlkZW50LCByZXR1cm5UeXBlLCBhcmdUeXBlcywgYXJncykge1xuICAgICAgICBjb25zdCB0b0MgPSB7XG4gICAgICAgICAgICBcInN0cmluZ1wiOiBmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmV0ID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoc3RyICE9PSBudWxsICYmIHN0ciAhPT0gdW5kZWZpbmVkICYmIHN0ciAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSAoc3RyLmxlbmd0aCA8PCAyKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldCA9IHN0YWNrQWxsb2MobGVuKTtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5nVG9VVEY4KHN0ciwgcmV0LCBsZW4pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcImFycmF5XCI6IGZ1bmN0aW9uKGFycikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldCA9IHN0YWNrQWxsb2MoYXJyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgd3JpdGVBcnJheVRvTWVtb3J5KGFyciwgcmV0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gY29udmVydFJldHVyblZhbHVlKHJldCkge1xuICAgICAgICAgICAgaWYgKHJldHVyblR5cGUgPT09IFwic3RyaW5nXCIpIHJldHVybiBVVEY4VG9TdHJpbmcocmV0KTtcbiAgICAgICAgICAgIGlmIChyZXR1cm5UeXBlID09PSBcImJvb2xlYW5cIikgcmV0dXJuIEJvb2xlYW4ocmV0KTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdW5jID0gZ2V0Q0Z1bmMoaWRlbnQpO1xuICAgICAgICBjb25zdCBjQXJncyA9IFtdO1xuICAgICAgICBsZXQgc3RhY2sgPSAwO1xuICAgICAgICBpZiAoYXJncykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udmVydGVyID0gdG9DW2FyZ1R5cGVzW2ldXTtcbiAgICAgICAgICAgICAgICBpZiAoY29udmVydGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGFjayA9PT0gMCkgc3RhY2sgPSBzdGFja1NhdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgY0FyZ3NbaV0gPSBjb252ZXJ0ZXIoYXJnc1tpXSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjQXJnc1tpXSA9IGFyZ3NbaV1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHJldCA9IGZ1bmMoLi4uY0FyZ3MpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRG9uZShyZXQpIHtcbiAgICAgICAgICAgIGlmIChzdGFjayAhPT0gMCkgc3RhY2tSZXN0b3JlKHN0YWNrKTtcbiAgICAgICAgICAgIHJldHVybiBjb252ZXJ0UmV0dXJuVmFsdWUocmV0KVxuICAgICAgICB9XG4gICAgICAgIHJldCA9IG9uRG9uZShyZXQpO1xuICAgICAgICByZXR1cm4gcmV0XG4gICAgfVxuICAgIGNvbnN0IFVURjhEZWNvZGVyID0gdHlwZW9mIFRleHREZWNvZGVyICE9PSBcInVuZGVmaW5lZFwiID8gbmV3IFRleHREZWNvZGVyKFwidXRmOFwiKSA6IHVuZGVmaW5lZDtcblxuICAgIGZ1bmN0aW9uIFVURjhBcnJheVRvU3RyaW5nKGhlYXAsIGlkeCwgbWF4Qnl0ZXNUb1JlYWQpIHtcbiAgICAgICAgY29uc3QgZW5kSWR4ID0gaWR4ICsgbWF4Qnl0ZXNUb1JlYWQ7XG4gICAgICAgIGxldCBlbmRQdHIgPSBpZHg7XG4gICAgICAgIHdoaWxlIChoZWFwW2VuZFB0cl0gJiYgIShlbmRQdHIgPj0gZW5kSWR4KSkgKytlbmRQdHI7XG4gICAgICAgIGlmIChlbmRQdHIgLSBpZHggPiAxNiAmJiBoZWFwLnN1YmFycmF5ICYmIFVURjhEZWNvZGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gVVRGOERlY29kZXIuZGVjb2RlKGhlYXAuc3ViYXJyYXkoaWR4LCBlbmRQdHIpKVxuICAgICAgICB9IFxuICAgICAgICAgICAgbGV0IHN0ciA9IFwiXCI7XG4gICAgICAgICAgICB3aGlsZSAoaWR4IDwgZW5kUHRyKSB7XG4gICAgICAgICAgICAgICAgbGV0IHUwID0gaGVhcFtpZHgrK107XG4gICAgICAgICAgICAgICAgaWYgKCEodTAgJiAxMjgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHUwKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgdTEgPSBoZWFwW2lkeCsrXSAmIDYzO1xuICAgICAgICAgICAgICAgIGlmICgodTAgJiAyMjQpID09PSAxOTIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKHUwICYgMzEpIDw8IDYgfCB1MSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHUyID0gaGVhcFtpZHgrK10gJiA2MztcbiAgICAgICAgICAgICAgICBpZiAoKHUwICYgMjQwKSA9PT0gMjI0KSB7XG4gICAgICAgICAgICAgICAgICAgIHUwID0gKHUwICYgMTUpIDw8IDEyIHwgdTEgPDwgNiB8IHUyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdTAgPSAodTAgJiA3KSA8PCAxOCB8IHUxIDw8IDEyIHwgdTIgPDwgNiB8IGhlYXBbaWR4KytdICYgNjNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHUwIDwgNjU1MzYpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodTApXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2ggPSB1MCAtIDY1NTM2O1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSg1NTI5NiB8IGNoID4+IDEwLCA1NjMyMCB8IGNoICYgMTAyMylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gc3RyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gVVRGOFRvU3RyaW5nKHB0ciwgbWF4Qnl0ZXNUb1JlYWQpIHtcbiAgICAgICAgcmV0dXJuIHB0ciA/IFVURjhBcnJheVRvU3RyaW5nKEhFQVBVOCwgcHRyLCBtYXhCeXRlc1RvUmVhZCkgOiBcIlwiXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3RyaW5nVG9VVEY4QXJyYXkoc3RyLCBoZWFwLCBvdXRJZHgsIG1heEJ5dGVzVG9Xcml0ZSkge1xuICAgICAgICBpZiAoIShtYXhCeXRlc1RvV3JpdGUgPiAwKSkgcmV0dXJuIDA7XG4gICAgICAgIGNvbnN0IHN0YXJ0SWR4ID0gb3V0SWR4O1xuICAgICAgICBjb25zdCBlbmRJZHggPSBvdXRJZHggKyBtYXhCeXRlc1RvV3JpdGUgLSAxO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IHUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIGlmICh1ID49IDU1Mjk2ICYmIHUgPD0gNTczNDMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1MSA9IHN0ci5jaGFyQ29kZUF0KCsraSk7XG4gICAgICAgICAgICAgICAgdSA9IDY1NTM2ICsgKCh1ICYgMTAyMykgPDwgMTApIHwgdTEgJiAxMDIzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodSA8PSAxMjcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3V0SWR4ID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSB1XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHUgPD0gMjA0Nykge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAxID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxOTIgfCB1ID4+IDY7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodSA8PSA2NTUzNSkge1xuICAgICAgICAgICAgICAgIGlmIChvdXRJZHggKyAyID49IGVuZElkeCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAyMjQgfCB1ID4+IDEyO1xuICAgICAgICAgICAgICAgIGhlYXBbb3V0SWR4KytdID0gMTI4IHwgdSA+PiA2ICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ICYgNjNcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dElkeCArIDMgPj0gZW5kSWR4KSBicmVhaztcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDI0MCB8IHUgPj4gMTg7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ID4+IDEyICYgNjM7XG4gICAgICAgICAgICAgICAgaGVhcFtvdXRJZHgrK10gPSAxMjggfCB1ID4+IDYgJiA2MztcbiAgICAgICAgICAgICAgICBoZWFwW291dElkeCsrXSA9IDEyOCB8IHUgJiA2M1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGhlYXBbb3V0SWR4XSA9IDA7XG4gICAgICAgIHJldHVybiBvdXRJZHggLSBzdGFydElkeFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmluZ1RvVVRGOChzdHIsIG91dFB0ciwgbWF4Qnl0ZXNUb1dyaXRlKSB7XG4gICAgICAgIHJldHVybiBzdHJpbmdUb1VURjhBcnJheShzdHIsIEhFQVBVOCwgb3V0UHRyLCBtYXhCeXRlc1RvV3JpdGUpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGVuZ3RoQnl0ZXNVVEY4KHN0cikge1xuICAgICAgICBsZXQgbGVuID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCB1ID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBpZiAodSA+PSA1NTI5NiAmJiB1IDw9IDU3MzQzKSB1ID0gNjU1MzYgKyAoKHUgJiAxMDIzKSA8PCAxMCkgfCBzdHIuY2hhckNvZGVBdCgrK2kpICYgMTAyMztcbiAgICAgICAgICAgIGlmICh1IDw9IDEyNykgKytsZW47XG4gICAgICAgICAgICBlbHNlIGlmICh1IDw9IDIwNDcpIGxlbiArPSAyO1xuICAgICAgICAgICAgZWxzZSBpZiAodSA8PSA2NTUzNSkgbGVuICs9IDM7XG4gICAgICAgICAgICBlbHNlIGxlbiArPSA0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxlblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFsbG9jYXRlVVRGOE9uU3RhY2soc3RyKSB7XG4gICAgICAgIGNvbnN0IHNpemUgPSBsZW5ndGhCeXRlc1VURjgoc3RyKSArIDE7XG4gICAgICAgIGNvbnN0IHJldCA9IHN0YWNrQWxsb2Moc2l6ZSk7XG4gICAgICAgIHN0cmluZ1RvVVRGOEFycmF5KHN0ciwgSEVBUDgsIHJldCwgc2l6ZSk7XG4gICAgICAgIHJldHVybiByZXRcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3cml0ZUFycmF5VG9NZW1vcnkoYXJyYXksIGJ1ZmZlcikge1xuICAgICAgICBIRUFQOC5zZXQoYXJyYXksIGJ1ZmZlcilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhbGlnblVwKHgsIG11bHRpcGxlKSB7XG4gICAgICAgIGlmICh4ICUgbXVsdGlwbGUgPiAwKSB7XG4gICAgICAgICAgICB4ICs9IG11bHRpcGxlIC0geCAlIG11bHRpcGxlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHhcbiAgICB9XG4gICAgbGV0IGJ1ZmZlcjsgbGV0IEhFQVA4OyBsZXQgSEVBUFU4OyBsZXQgSEVBUDE2OyBsZXQgSEVBUFUxNjsgbGV0IEhFQVAzMjsgbGV0IEhFQVBVMzI7IGxldCBIRUFQRjMyOyBsZXQgSEVBUEY2NDtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKGJ1Zikge1xuICAgICAgICBidWZmZXIgPSBidWY7XG4gICAgICAgIE1vZHVsZS5IRUFQOCA9IEhFQVA4ID0gbmV3IEludDhBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUDE2ID0gSEVBUDE2ID0gbmV3IEludDE2QXJyYXkoYnVmKTtcbiAgICAgICAgTW9kdWxlLkhFQVAzMiA9IEhFQVAzMiA9IG5ldyBJbnQzMkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQVTggPSBIRUFQVTggPSBuZXcgVWludDhBcnJheShidWYpO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIE1vZHVsZS5IRUFQVTE2ID0gSEVBUFUxNiA9IG5ldyBVaW50MTZBcnJheShidWYpO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgICAgIE1vZHVsZS5IRUFQVTMyID0gSEVBUFUzMiA9IG5ldyBVaW50MzJBcnJheShidWYpO1xuICAgICAgICBNb2R1bGUuSEVBUEYzMiA9IEhFQVBGMzIgPSBuZXcgRmxvYXQzMkFycmF5KGJ1Zik7XG4gICAgICAgIE1vZHVsZS5IRUFQRjY0ID0gSEVBUEY2NCA9IG5ldyBGbG9hdDY0QXJyYXkoYnVmKVxuICAgIH1cbiAgICBsZXQgd2FzbVRhYmxlO1xuICAgIGNvbnN0IF9fQVRQUkVSVU5fXyA9IFtdO1xuICAgIGNvbnN0IF9fQVRJTklUX18gPSBbXTtcbiAgICBjb25zdCBfX0FUTUFJTl9fID0gW107XG4gICAgY29uc3QgX19BVFBPU1RSVU5fXyA9IFtdO1xuICAgIGNvbnN0IHJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyID0gMDtcblxuICAgIGZ1bmN0aW9uIGtlZXBSdW50aW1lQWxpdmUoKSB7XG4gICAgICAgIHJldHVybiBub0V4aXRSdW50aW1lIHx8IHJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyID4gMFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByZVJ1bigpIHtcbiAgICAgICAgaWYgKE1vZHVsZS5wcmVSdW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgTW9kdWxlLnByZVJ1biA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucHJlUnVuID0gW01vZHVsZS5wcmVSdW5dO1xuICAgICAgICAgICAgd2hpbGUgKE1vZHVsZS5wcmVSdW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYWRkT25QcmVSdW4oTW9kdWxlLnByZVJ1bi5zaGlmdCgpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhbGxSdW50aW1lQ2FsbGJhY2tzKF9fQVRQUkVSVU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0UnVudGltZSgpIHtcbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVElOSVRfXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVNYWluKCkge1xuICAgICAgICBjYWxsUnVudGltZUNhbGxiYWNrcyhfX0FUTUFJTl9fKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4aXRSdW50aW1lKCkge1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBvc3RSdW4oKSB7XG4gICAgICAgIGlmIChNb2R1bGUucG9zdFJ1bikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBNb2R1bGUucG9zdFJ1biA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucG9zdFJ1biA9IFtNb2R1bGUucG9zdFJ1bl07XG4gICAgICAgICAgICB3aGlsZSAoTW9kdWxlLnBvc3RSdW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYWRkT25Qb3N0UnVuKE1vZHVsZS5wb3N0UnVuLnNoaWZ0KCkpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2FsbFJ1bnRpbWVDYWxsYmFja3MoX19BVFBPU1RSVU5fXylcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPblByZVJ1bihjYikge1xuICAgICAgICBfX0FUUFJFUlVOX18udW5zaGlmdChjYilcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRPbkluaXQoY2IpIHtcbiAgICAgICAgX19BVElOSVRfXy51bnNoaWZ0KGNiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE9uUG9zdFJ1bihjYikge1xuICAgICAgICBfX0FUUE9TVFJVTl9fLnVuc2hpZnQoY2IpXG4gICAgfVxuICAgIGxldCBydW5EZXBlbmRlbmNpZXMgPSAwO1xuICAgIGxldCBydW5EZXBlbmRlbmN5V2F0Y2hlciA9IG51bGw7XG4gICAgbGV0IGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IG51bGw7XG5cbiAgICBmdW5jdGlvbiBhZGRSdW5EZXBlbmRlbmN5KCkge1xuICAgICAgICBydW5EZXBlbmRlbmNpZXMrKztcbiAgICAgICAgaWYgKE1vZHVsZS5tb25pdG9yUnVuRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcyhydW5EZXBlbmRlbmNpZXMpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVSdW5EZXBlbmRlbmN5KCkge1xuICAgICAgICBydW5EZXBlbmRlbmNpZXMtLTtcbiAgICAgICAgaWYgKE1vZHVsZS5tb25pdG9yUnVuRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBNb2R1bGUubW9uaXRvclJ1bkRlcGVuZGVuY2llcyhydW5EZXBlbmRlbmNpZXMpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY2llcyA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY3lXYXRjaGVyICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChydW5EZXBlbmRlbmN5V2F0Y2hlcik7XG4gICAgICAgICAgICAgICAgcnVuRGVwZW5kZW5jeVdhdGNoZXIgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGVwZW5kZW5jaWVzRnVsZmlsbGVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBkZXBlbmRlbmNpZXNGdWxmaWxsZWQ7XG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzRnVsZmlsbGVkID0gbnVsbDtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTW9kdWxlLnByZWxvYWRlZEltYWdlcyA9IHt9O1xuICAgIE1vZHVsZS5wcmVsb2FkZWRBdWRpb3MgPSB7fTtcblxuICAgIGZ1bmN0aW9uIGFib3J0KHdoYXQpIHtcbiAgICAgICAgaWYgKE1vZHVsZS5vbkFib3J0KSB7XG4gICAgICAgICAgICBNb2R1bGUub25BYm9ydCh3aGF0KVxuICAgICAgICB9XG4gICAgICAgIHdoYXQgPSBgQWJvcnRlZCgkeyAgd2hhdCAgfSlgO1xuICAgICAgICBlcnIod2hhdCk7XG4gICAgICAgIEFCT1JUID0gdHJ1ZTtcbiAgICAgICAgRVhJVFNUQVRVUyA9IDE7XG4gICAgICAgIHdoYXQgKz0gXCIuIEJ1aWxkIHdpdGggLXMgQVNTRVJUSU9OUz0xIGZvciBtb3JlIGluZm8uXCI7XG4gICAgICAgIGNvbnN0IGUgPSBuZXcgV2ViQXNzZW1ibHkuUnVudGltZUVycm9yKHdoYXQpO1xuICAgICAgICB0aHJvdyBlXG4gICAgfVxuICAgIGNvbnN0IGRhdGFVUklQcmVmaXggPSBcImRhdGE6YXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtO2Jhc2U2NCxcIjtcblxuICAgIGZ1bmN0aW9uIGlzRGF0YVVSSShmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZmlsZW5hbWUuc3RhcnRzV2l0aChkYXRhVVJJUHJlZml4KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzRmlsZVVSSShmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZmlsZW5hbWUuc3RhcnRzV2l0aChcImZpbGU6Ly9cIilcbiAgICB9XG4gICAgbGV0IHdhc21CaW5hcnlGaWxlO1xuICAgIHdhc21CaW5hcnlGaWxlID0gbWFpbldhc207XG4gICAgaWYgKCFpc0RhdGFVUkkod2FzbUJpbmFyeUZpbGUpKSB7XG4gICAgICAgIHdhc21CaW5hcnlGaWxlID0gbG9jYXRlRmlsZSh3YXNtQmluYXJ5RmlsZSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCaW5hcnkoZmlsZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGZpbGUgPT09IHdhc21CaW5hcnlGaWxlICYmIHdhc21CaW5hcnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkod2FzbUJpbmFyeSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWFkQmluYXJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlYWRCaW5hcnkoZmlsZSlcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYm90aCBhc3luYyBhbmQgc3luYyBmZXRjaGluZyBvZiB0aGUgd2FzbSBmYWlsZWRcIik7XG4gICAgICAgICAgICBcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBhYm9ydChlcnIpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEJpbmFyeVByb21pc2UoKSB7XG4gICAgICAgIGlmICghd2FzbUJpbmFyeSAmJiAoRU5WSVJPTk1FTlRfSVNfV0VCIHx8IEVOVklST05NRU5UX0lTX1dPUktFUikpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmV0Y2ggPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNGaWxlVVJJKHdhc21CaW5hcnlGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCh3YXNtQmluYXJ5RmlsZSwge1xuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsczogXCJzYW1lLW9yaWdpblwiXG4gICAgICAgICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gbG9hZCB3YXNtIGJpbmFyeSBmaWxlIGF0ICckeyAgd2FzbUJpbmFyeUZpbGUgIH0nYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmFycmF5QnVmZmVyKClcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBnZXRCaW5hcnkod2FzbUJpbmFyeUZpbGUpKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICBpZiAocmVhZEFzeW5jKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWFkQXN5bmMod2FzbUJpbmFyeUZpbGUsIChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUobmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UpKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgcmVqZWN0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IGdldEJpbmFyeSh3YXNtQmluYXJ5RmlsZSkpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlV2FzbSgpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgIFwiZW52XCI6IGFzbUxpYnJhcnlBcmcsXG4gICAgICAgICAgICBcIndhc2lfc25hcHNob3RfcHJldmlldzFcIjogYXNtTGlicmFyeUFyZ1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVJbnN0YW5jZShpbnN0YW5jZSkge1xuICAgICAgICAgICAgY29uc3Qge2V4cG9ydHN9ID0gaW5zdGFuY2U7XG4gICAgICAgICAgICBNb2R1bGUuYXNtID0gZXhwb3J0cztcbiAgICAgICAgICAgIHdhc21NZW1vcnkgPSBNb2R1bGUuYXNtLm1lbW9yeTtcbiAgICAgICAgICAgIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKHdhc21NZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgICAgIHdhc21UYWJsZSA9IE1vZHVsZS5hc20uX19pbmRpcmVjdF9mdW5jdGlvbl90YWJsZTtcbiAgICAgICAgICAgIGFkZE9uSW5pdChNb2R1bGUuYXNtLl9fd2FzbV9jYWxsX2N0b3JzKTtcbiAgICAgICAgICAgIHJlbW92ZVJ1bkRlcGVuZGVuY3koXCJ3YXNtLWluc3RhbnRpYXRlXCIpXG4gICAgICAgIH1cbiAgICAgICAgYWRkUnVuRGVwZW5kZW5jeShcIndhc20taW5zdGFudGlhdGVcIik7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQocmVzdWx0KSB7XG4gICAgICAgICAgICByZWNlaXZlSW5zdGFuY2UocmVzdWx0Lmluc3RhbmNlKVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zdGFudGlhdGVBcnJheUJ1ZmZlcihyZWNlaXZlcikge1xuICAgICAgICAgICAgcmV0dXJuIGdldEJpbmFyeVByb21pc2UoKS50aGVuKChiaW5hcnkpID0+IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKGJpbmFyeSwgaW5mbykpLnRoZW4oKGluc3RhbmNlKSA9PiBpbnN0YW5jZSkudGhlbihyZWNlaXZlciwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgICAgIGVycihgZmFpbGVkIHRvIGFzeW5jaHJvbm91c2x5IHByZXBhcmUgd2FzbTogJHsgIHJlYXNvbn1gKTtcbiAgICAgICAgICAgICAgICBhYm9ydChyZWFzb24pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zdGFudGlhdGVBc3luYygpIHtcbiAgICAgICAgICAgIGlmICghd2FzbUJpbmFyeSAmJiB0eXBlb2YgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcgPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNEYXRhVVJJKHdhc21CaW5hcnlGaWxlKSAmJiAhaXNGaWxlVVJJKHdhc21CaW5hcnlGaWxlKSAmJiB0eXBlb2YgZmV0Y2ggPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCh3YXNtQmluYXJ5RmlsZSwge1xuICAgICAgICAgICAgICAgICAgICBjcmVkZW50aWFsczogXCJzYW1lLW9yaWdpblwiXG4gICAgICAgICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcocmVzcG9uc2UsIGluZm8pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnRoZW4ocmVjZWl2ZUluc3RhbnRpYXRpb25SZXN1bHQsIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycihgd2FzbSBzdHJlYW1pbmcgY29tcGlsZSBmYWlsZWQ6ICR7ICByZWFzb259YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIoXCJmYWxsaW5nIGJhY2sgdG8gQXJyYXlCdWZmZXIgaW5zdGFudGlhdGlvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW50aWF0ZUFycmF5QnVmZmVyKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW50aWF0ZUFycmF5QnVmZmVyKHJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0KVxuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1vZHVsZS5pbnN0YW50aWF0ZVdhc20pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhwb3J0cyA9IE1vZHVsZS5pbnN0YW50aWF0ZVdhc20oaW5mbywgcmVjZWl2ZUluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwb3J0c1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGVycihgTW9kdWxlLmluc3RhbnRpYXRlV2FzbSBjYWxsYmFjayBmYWlsZWQgd2l0aCBlcnJvcjogJHsgIGV9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaW5zdGFudGlhdGVBc3luYygpO1xuICAgICAgICByZXR1cm4ge31cbiAgICB9XG4gICAgbGV0IHRlbXBEb3VibGU7XG4gICAgbGV0IHRlbXBJNjQ7XG5cbiAgICBmdW5jdGlvbiBjYWxsUnVudGltZUNhbGxiYWNrcyhjYWxsYmFja3MpIHtcbiAgICAgICAgd2hpbGUgKGNhbGxiYWNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IGNhbGxiYWNrcy5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soTW9kdWxlKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qge2Z1bmN9ID0gY2FsbGJhY2s7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suYXJnID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0V2FzbVRhYmxlRW50cnkoZnVuYykoKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdldFdhc21UYWJsZUVudHJ5KGZ1bmMpKGNhbGxiYWNrLmFyZylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZ1bmMoY2FsbGJhY2suYXJnID09PSB1bmRlZmluZWQgPyBudWxsIDogY2FsbGJhY2suYXJnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbVRhYmxlTWlycm9yID0gW107XG5cbiAgICBmdW5jdGlvbiBnZXRXYXNtVGFibGVFbnRyeShmdW5jUHRyKSB7XG4gICAgICAgIGxldCBmdW5jID0gd2FzbVRhYmxlTWlycm9yW2Z1bmNQdHJdO1xuICAgICAgICBpZiAoIWZ1bmMpIHtcbiAgICAgICAgICAgIGlmIChmdW5jUHRyID49IHdhc21UYWJsZU1pcnJvci5sZW5ndGgpIHdhc21UYWJsZU1pcnJvci5sZW5ndGggPSBmdW5jUHRyICsgMTtcbiAgICAgICAgICAgIHdhc21UYWJsZU1pcnJvcltmdW5jUHRyXSA9IGZ1bmMgPSB3YXNtVGFibGUuZ2V0KGZ1bmNQdHIpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZ1bmNcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVFeGNlcHRpb24oZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEV4aXRTdGF0dXMgfHwgZSA9PT0gXCJ1bndpbmRcIikge1xuICAgICAgICAgICAgcmV0dXJuIEVYSVRTVEFUVVNcbiAgICAgICAgfVxuICAgICAgICBxdWl0XygxLCBlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fX2Fzc2VydF9mYWlsKGNvbmRpdGlvbiwgZmlsZW5hbWUsIGxpbmUsIGZ1bmMpIHtcbiAgICAgICAgYWJvcnQoYEFzc2VydGlvbiBmYWlsZWQ6ICR7ICBVVEY4VG9TdHJpbmcoY29uZGl0aW9uKSAgfSwgYXQ6ICR7ICBbZmlsZW5hbWUgPyBVVEY4VG9TdHJpbmcoZmlsZW5hbWUpIDogXCJ1bmtub3duIGZpbGVuYW1lXCIsIGxpbmUsIGZ1bmMgPyBVVEY4VG9TdHJpbmcoZnVuYykgOiBcInVua25vd24gZnVuY3Rpb25cIl19YClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uKHNpemUpIHtcbiAgICAgICAgcmV0dXJuIF9tYWxsb2Moc2l6ZSArIDE2KSArIDE2XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2F0ZXhpdCgpIHt9XG5cbiAgICBmdW5jdGlvbiBfX19jeGFfYXRleGl0KGEwLCBhMSkge1xuICAgICAgICByZXR1cm4gX2F0ZXhpdChhMCwgYTEpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gRXhjZXB0aW9uSW5mbyhleGNQdHIpIHtcbiAgICAgICAgdGhpcy5leGNQdHIgPSBleGNQdHI7XG4gICAgICAgIHRoaXMucHRyID0gZXhjUHRyIC0gMTY7XG4gICAgICAgIHRoaXMuc2V0X3R5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgKyA0ID4+IDJdID0gdHlwZVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdldF90eXBlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDMyW3RoaXMucHRyICsgNCA+PiAyXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldF9kZXN0cnVjdG9yID0gZnVuY3Rpb24oZGVzdHJ1Y3Rvcikge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyICsgOCA+PiAyXSA9IGRlc3RydWN0b3JcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIEhFQVAzMlt0aGlzLnB0ciArIDggPj4gMl1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfcmVmY291bnQgPSBmdW5jdGlvbihyZWZjb3VudCkge1xuICAgICAgICAgICAgSEVBUDMyW3RoaXMucHRyID4+IDJdID0gcmVmY291bnRcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZXRfY2F1Z2h0ID0gZnVuY3Rpb24oY2F1Z2h0KSB7XG4gICAgICAgICAgICBjYXVnaHQgPSBjYXVnaHQgPyAxIDogMDtcbiAgICAgICAgICAgIEhFQVA4W3RoaXMucHRyICsgMTIgPj4gMF0gPSBjYXVnaHRcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfY2F1Z2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gSEVBUDhbdGhpcy5wdHIgKyAxMiA+PiAwXSAhPT0gMFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnNldF9yZXRocm93biA9IGZ1bmN0aW9uKHJldGhyb3duKSB7XG4gICAgICAgICAgICByZXRocm93biA9IHJldGhyb3duID8gMSA6IDA7XG4gICAgICAgICAgICBIRUFQOFt0aGlzLnB0ciArIDEzID4+IDBdID0gcmV0aHJvd25cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5nZXRfcmV0aHJvd24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBIRUFQOFt0aGlzLnB0ciArIDEzID4+IDBdICE9PSAwXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuaW5pdCA9IGZ1bmN0aW9uKHR5cGUsIGRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0X3R5cGUodHlwZSk7XG4gICAgICAgICAgICB0aGlzLnNldF9kZXN0cnVjdG9yKGRlc3RydWN0b3IpO1xuICAgICAgICAgICAgdGhpcy5zZXRfcmVmY291bnQoMCk7XG4gICAgICAgICAgICB0aGlzLnNldF9jYXVnaHQoZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5zZXRfcmV0aHJvd24oZmFsc2UpXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuYWRkX3JlZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBIRUFQMzJbdGhpcy5wdHIgPj4gMl07XG4gICAgICAgICAgICBIRUFQMzJbdGhpcy5wdHIgPj4gMl0gPSB2YWx1ZSArIDFcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5yZWxlYXNlX3JlZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc3QgcHJldiA9IEhFQVAzMlt0aGlzLnB0ciA+PiAyXTtcbiAgICAgICAgICAgIEhFQVAzMlt0aGlzLnB0ciA+PiAyXSA9IHByZXYgLSAxO1xuICAgICAgICAgICAgcmV0dXJuIHByZXYgPT09IDFcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9fX2N4YV90aHJvdyhwdHIsIHR5cGUsIGRlc3RydWN0b3IpIHtcbiAgICAgICAgY29uc3QgaW5mbyA9IG5ldyBFeGNlcHRpb25JbmZvKHB0cik7XG4gICAgICAgIGluZm8uaW5pdCh0eXBlLCBkZXN0cnVjdG9yKTtcbiAgICAgICAgdGhyb3cgcHRyXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2Fib3J0KCkge1xuICAgICAgICBhYm9ydChcIlwiKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbXNjcmlwdGVuX21lbWNweV9iaWcoZGVzdCwgc3JjLCBudW0pIHtcbiAgICAgICAgSEVBUFU4LmNvcHlXaXRoaW4oZGVzdCwgc3JjLCBzcmMgKyBudW0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlcihzaXplKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3YXNtTWVtb3J5Lmdyb3coc2l6ZSAtIGJ1ZmZlci5ieXRlTGVuZ3RoICsgNjU1MzUgPj4+IDE2KTtcbiAgICAgICAgICAgIHVwZGF0ZUdsb2JhbEJ1ZmZlckFuZFZpZXdzKHdhc21NZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgICAgIHJldHVybiAxXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1lbXB0eVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwKHJlcXVlc3RlZFNpemUpIHtcbiAgICAgICAgY29uc3Qgb2xkU2l6ZSA9IEhFQVBVOC5sZW5ndGg7XG4gICAgICAgIHJlcXVlc3RlZFNpemUgPj4+PSAwO1xuICAgICAgICBjb25zdCBtYXhIZWFwU2l6ZSA9IDIxNDc0ODM2NDg7XG4gICAgICAgIGlmIChyZXF1ZXN0ZWRTaXplID4gbWF4SGVhcFNpemUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGN1dERvd24gPSAxOyBjdXREb3duIDw9IDQ7IGN1dERvd24gKj0gMikge1xuICAgICAgICAgICAgbGV0IG92ZXJHcm93bkhlYXBTaXplID0gb2xkU2l6ZSAqICgxICsgLjIgLyBjdXREb3duKTtcbiAgICAgICAgICAgIG92ZXJHcm93bkhlYXBTaXplID0gTWF0aC5taW4ob3Zlckdyb3duSGVhcFNpemUsIHJlcXVlc3RlZFNpemUgKyAxMDA2NjMyOTYpO1xuICAgICAgICAgICAgY29uc3QgbmV3U2l6ZSA9IE1hdGgubWluKG1heEhlYXBTaXplLCBhbGlnblVwKE1hdGgubWF4KHJlcXVlc3RlZFNpemUsIG92ZXJHcm93bkhlYXBTaXplKSwgNjU1MzYpKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gZW1zY3JpcHRlbl9yZWFsbG9jX2J1ZmZlcihuZXdTaXplKTtcbiAgICAgICAgICAgIGlmIChyZXBsYWNlbWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IFNZU0NBTExTID0ge1xuICAgICAgICBtYXBwaW5nczoge30sXG4gICAgICAgIGJ1ZmZlcnM6IFtudWxsLCBbXSxcbiAgICAgICAgICAgIFtdXG4gICAgICAgIF0sXG4gICAgICAgIHByaW50Q2hhcihzdHJlYW0sIGN1cnIpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IFNZU0NBTExTLmJ1ZmZlcnNbc3RyZWFtXTtcbiAgICAgICAgICAgIGlmIChjdXJyID09PSAwIHx8IGN1cnIgPT09IDEwKSB7XG4gICAgICAgICAgICAgICAgKHN0cmVhbSA9PT0gMSA/IG91dCA6IGVycikoVVRGOEFycmF5VG9TdHJpbmcoYnVmZmVyLCAwKSk7XG4gICAgICAgICAgICAgICAgYnVmZmVyLmxlbmd0aCA9IDBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyLnB1c2goY3VycilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgdmFyYXJnczogdW5kZWZpbmVkLFxuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICBTWVNDQUxMUy52YXJhcmdzICs9IDQ7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBIRUFQMzJbU1lTQ0FMTFMudmFyYXJncyAtIDQgPj4gMl07XG4gICAgICAgICAgICByZXR1cm4gcmV0XG4gICAgICAgIH0sXG4gICAgICAgIGdldFN0cihwdHIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJldCA9IFVURjhUb1N0cmluZyhwdHIpO1xuICAgICAgICAgICAgcmV0dXJuIHJldFxuICAgICAgICB9LFxuICAgICAgICBnZXQ2NChsb3cpIHtcbiAgICAgICAgICAgIHJldHVybiBsb3dcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBfZmRfd3JpdGUoZmQsIGlvdiwgaW92Y250LCBwbnVtKSB7XG4gICAgICAgIGxldCBudW0gPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlvdmNudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwdHIgPSBIRUFQMzJbaW92ID4+IDJdO1xuICAgICAgICAgICAgY29uc3QgbGVuID0gSEVBUDMyW2lvdiArIDQgPj4gMl07XG4gICAgICAgICAgICBpb3YgKz0gODtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBTWVNDQUxMUy5wcmludENoYXIoZmQsIEhFQVBVOFtwdHIgKyBqXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG51bSArPSBsZW5cbiAgICAgICAgfVxuICAgICAgICBIRUFQMzJbcG51bSA+PiAyXSA9IG51bTtcbiAgICAgICAgcmV0dXJuIDBcbiAgICB9XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG4gICAgZnVuY3Rpb24gX3NldFRlbXBSZXQwKHZhbCkge1xuICAgICAgICAvLyBzZXRUZW1wUmV0MCh2YWwpXG4gICAgfVxuICAgIGNvbnN0IGFzbUxpYnJhcnlBcmcgPSB7XG4gICAgICAgIFwiX19hc3NlcnRfZmFpbFwiOiBfX19hc3NlcnRfZmFpbCxcbiAgICAgICAgXCJfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb25cIjogX19fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbixcbiAgICAgICAgXCJfX2N4YV9hdGV4aXRcIjogX19fY3hhX2F0ZXhpdCxcbiAgICAgICAgXCJfX2N4YV90aHJvd1wiOiBfX19jeGFfdGhyb3csXG4gICAgICAgIFwiYWJvcnRcIjogX2Fib3J0LFxuICAgICAgICBcImVtc2NyaXB0ZW5fbWVtY3B5X2JpZ1wiOiBfZW1zY3JpcHRlbl9tZW1jcHlfYmlnLFxuICAgICAgICBcImVtc2NyaXB0ZW5fcmVzaXplX2hlYXBcIjogX2Vtc2NyaXB0ZW5fcmVzaXplX2hlYXAsXG4gICAgICAgIFwiZmRfd3JpdGVcIjogX2ZkX3dyaXRlLFxuICAgICAgICBcInNldFRlbXBSZXQwXCI6IF9zZXRUZW1wUmV0MFxuICAgIH07XG4gICAgY3JlYXRlV2FzbSgpO1xuICAgIGxldCBfX193YXNtX2NhbGxfY3RvcnMgPSBNb2R1bGUuX19fd2FzbV9jYWxsX2N0b3JzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX19fd2FzbV9jYWxsX2N0b3JzID0gTW9kdWxlLl9fX3dhc21fY2FsbF9jdG9ycyA9IE1vZHVsZS5hc20uX193YXNtX2NhbGxfY3RvcnMpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfbWFpbiA9IE1vZHVsZS5fbWFpbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9tYWluID0gTW9kdWxlLl9tYWluID0gTW9kdWxlLmFzbS5tYWluKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX2NyZWF0ZVRleHR1cmUgPSBNb2R1bGUuX2NyZWF0ZVRleHR1cmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfY3JlYXRlVGV4dHVyZSA9IE1vZHVsZS5fY3JlYXRlVGV4dHVyZSA9IE1vZHVsZS5hc20uY3JlYXRlVGV4dHVyZSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9jcmVhdGVCb3VuZGluZyA9IE1vZHVsZS5fY3JlYXRlQm91bmRpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfY3JlYXRlQm91bmRpbmcgPSBNb2R1bGUuX2NyZWF0ZUJvdW5kaW5nID0gTW9kdWxlLmFzbS5jcmVhdGVCb3VuZGluZykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9zZXRDYW1lcmEgPSBNb2R1bGUuX3NldENhbWVyYSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9zZXRDYW1lcmEgPSBNb2R1bGUuX3NldENhbWVyYSA9IE1vZHVsZS5hc20uc2V0Q2FtZXJhKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgX3JlYWRTdHJlYW0gPSBNb2R1bGUuX3JlYWRTdHJlYW0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfcmVhZFN0cmVhbSA9IE1vZHVsZS5fcmVhZFN0cmVhbSA9IE1vZHVsZS5hc20ucmVhZFN0cmVhbSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9wYXRoVHJhY2VyID0gTW9kdWxlLl9wYXRoVHJhY2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX3BhdGhUcmFjZXIgPSBNb2R1bGUuX3BhdGhUcmFjZXIgPSBNb2R1bGUuYXNtLnBhdGhUcmFjZXIpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfX19lcnJub19sb2NhdGlvbiA9IE1vZHVsZS5fX19lcnJub19sb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKF9fX2Vycm5vX2xvY2F0aW9uID0gTW9kdWxlLl9fX2Vycm5vX2xvY2F0aW9uID0gTW9kdWxlLmFzbS5fX2Vycm5vX2xvY2F0aW9uKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBsZXQgc3RhY2tTYXZlID0gTW9kdWxlLnN0YWNrU2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKHN0YWNrU2F2ZSA9IE1vZHVsZS5zdGFja1NhdmUgPSBNb2R1bGUuYXNtLnN0YWNrU2F2ZSkuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IHN0YWNrUmVzdG9yZSA9IE1vZHVsZS5zdGFja1Jlc3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja1Jlc3RvcmUgPSBNb2R1bGUuc3RhY2tSZXN0b3JlID0gTW9kdWxlLmFzbS5zdGFja1Jlc3RvcmUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBzdGFja0FsbG9jID0gTW9kdWxlLnN0YWNrQWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChzdGFja0FsbG9jID0gTW9kdWxlLnN0YWNrQWxsb2MgPSBNb2R1bGUuYXNtLnN0YWNrQWxsb2MpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBfbWFsbG9jID0gTW9kdWxlLl9tYWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChfbWFsbG9jID0gTW9kdWxlLl9tYWxsb2MgPSBNb2R1bGUuYXNtLm1hbGxvYykuYXBwbHkobnVsbCwgYXJndW1lbnRzKVxuICAgIH07XG4gICAgbGV0IF9mcmVlID0gTW9kdWxlLl9mcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoX2ZyZWUgPSBNb2R1bGUuX2ZyZWUgPSBNb2R1bGUuYXNtLmZyZWUpLmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICB9O1xuICAgIGxldCBkeW5DYWxsX2ppamkgPSBNb2R1bGUuZHluQ2FsbF9qaWppID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoZHluQ2FsbF9qaWppID0gTW9kdWxlLmR5bkNhbGxfamlqaSA9IE1vZHVsZS5hc20uZHluQ2FsbF9qaWppKS5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gICAgfTtcbiAgICBNb2R1bGUuY2NhbGwgPSBjY2FsbDtcbiAgICBNb2R1bGUuc2V0VmFsdWUgPSBzZXRWYWx1ZTtcbiAgICBNb2R1bGUuZ2V0VmFsdWUgPSBnZXRWYWx1ZTtcbiAgICBsZXQgY2FsbGVkUnVuO1xuXG4gICAgZnVuY3Rpb24gRXhpdFN0YXR1cyhzdGF0dXMpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gXCJFeGl0U3RhdHVzXCI7XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IGBQcm9ncmFtIHRlcm1pbmF0ZWQgd2l0aCBleGl0KCR7ICBzdGF0dXMgIH0pYDtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSBzdGF0dXNcbiAgICB9XG4gICAgbGV0IGNhbGxlZE1haW4gPSBmYWxzZTtcbiAgICBkZXBlbmRlbmNpZXNGdWxmaWxsZWQgPSBmdW5jdGlvbiBydW5DYWxsZXIoKSB7XG4gICAgICAgIGlmICghY2FsbGVkUnVuKSBydW4oKTtcbiAgICAgICAgaWYgKCFjYWxsZWRSdW4pIGRlcGVuZGVuY2llc0Z1bGZpbGxlZCA9IHJ1bkNhbGxlclxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBjYWxsTWFpbihhcmdzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5RnVuY3Rpb24gPSBNb2R1bGUuX21haW47XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IFtdO1xuICAgICAgICBjb25zdCBhcmdjID0gYXJncy5sZW5ndGggKyAxO1xuICAgICAgICBjb25zdCBhcmd2ID0gc3RhY2tBbGxvYygoYXJnYyArIDEpICogNCk7XG4gICAgICAgIEhFQVAzMlthcmd2ID4+IDJdID0gYWxsb2NhdGVVVEY4T25TdGFjayh0aGlzUHJvZ3JhbSk7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgYXJnYzsgaSsrKSB7XG4gICAgICAgICAgICBIRUFQMzJbKGFyZ3YgPj4gMikgKyBpXSA9IGFsbG9jYXRlVVRGOE9uU3RhY2soYXJnc1tpIC0gMV0pXG4gICAgICAgIH1cbiAgICAgICAgSEVBUDMyWyhhcmd2ID4+IDIpICsgYXJnY10gPSAwO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmV0ID0gZW50cnlGdW5jdGlvbihhcmdjLCBhcmd2KTtcbiAgICAgICAgICAgIGV4aXQocmV0LCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybiByZXRcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZUV4Y2VwdGlvbihlKVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby11bnVzZWQtdmFyc1xuICAgICAgICAgICAgY2FsbGVkTWFpbiA9IHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJ1bihhcmdzKSB7XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IGFyZ3VtZW50c187XG4gICAgICAgIGlmIChydW5EZXBlbmRlbmNpZXMgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBwcmVSdW4oKTtcbiAgICAgICAgaWYgKHJ1bkRlcGVuZGVuY2llcyA+IDApIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZG9SdW4oKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGVkUnVuKSByZXR1cm47XG4gICAgICAgICAgICBjYWxsZWRSdW4gPSB0cnVlO1xuICAgICAgICAgICAgTW9kdWxlLmNhbGxlZFJ1biA9IHRydWU7XG4gICAgICAgICAgICBpZiAoQUJPUlQpIHJldHVybjtcbiAgICAgICAgICAgIGluaXRSdW50aW1lKCk7XG4gICAgICAgICAgICBwcmVNYWluKCk7XG4gICAgICAgICAgICBpZiAoTW9kdWxlLm9uUnVudGltZUluaXRpYWxpemVkKSBNb2R1bGUub25SdW50aW1lSW5pdGlhbGl6ZWQoKTtcbiAgICAgICAgICAgIGlmIChzaG91bGRSdW5Ob3cpIGNhbGxNYWluKGFyZ3MpO1xuICAgICAgICAgICAgcG9zdFJ1bigpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1vZHVsZS5zZXRTdGF0dXMpIHtcbiAgICAgICAgICAgIE1vZHVsZS5zZXRTdGF0dXMoXCJSdW5uaW5nLi4uXCIpO1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIE1vZHVsZS5zZXRTdGF0dXMoXCJcIilcbiAgICAgICAgICAgICAgICB9LCAxKTtcbiAgICAgICAgICAgICAgICBkb1J1bigpXG4gICAgICAgICAgICB9LCAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9SdW4oKVxuICAgICAgICB9XG4gICAgfVxuICAgIE1vZHVsZS5ydW4gPSBydW47XG5cbiAgICBmdW5jdGlvbiBleGl0KHN0YXR1cykge1xuICAgICAgICBFWElUU1RBVFVTID0gc3RhdHVzO1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHlcbiAgICAgICAgaWYgKGtlZXBSdW50aW1lQWxpdmUoKSkge30gZWxzZSB7XG4gICAgICAgICAgICBleGl0UnVudGltZSgpXG4gICAgICAgIH1cbiAgICAgICAgcHJvY0V4aXQoc3RhdHVzKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2NFeGl0KGNvZGUpIHtcbiAgICAgICAgRVhJVFNUQVRVUyA9IGNvZGU7XG4gICAgICAgIGlmICgha2VlcFJ1bnRpbWVBbGl2ZSgpKSB7XG4gICAgICAgICAgICBpZiAoTW9kdWxlLm9uRXhpdCkgTW9kdWxlLm9uRXhpdChjb2RlKTtcbiAgICAgICAgICAgIEFCT1JUID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIHF1aXRfKGNvZGUsIG5ldyBFeGl0U3RhdHVzKGNvZGUpKVxuICAgIH1cbiAgICBpZiAoTW9kdWxlLnByZUluaXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBNb2R1bGUucHJlSW5pdCA9PT0gXCJmdW5jdGlvblwiKSBNb2R1bGUucHJlSW5pdCA9IFtNb2R1bGUucHJlSW5pdF07XG4gICAgICAgIHdoaWxlIChNb2R1bGUucHJlSW5pdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBNb2R1bGUucHJlSW5pdC5wb3AoKSgpXG4gICAgICAgIH1cbiAgICB9XG4gICAgbGV0IHNob3VsZFJ1bk5vdyA9IHRydWU7XG4gICAgaWYgKE1vZHVsZS5ub0luaXRpYWxSdW4pIHNob3VsZFJ1bk5vdyA9IGZhbHNlO1xuICAgIHJ1bigpO1xuXG4gICAgcmV0dXJuIE1vZHVsZTtcbn1cbiIsbnVsbCxudWxsXSwibmFtZXMiOlsiVEVYVFVSRV9TSVpFIiwiUmVuZGVyZXIiLCJ3YXNtTWFuYWdlciIsInRleHR1cmVDYW52YXMiLCJpc1dvcmtlciIsInBpeGVsRGF0YSIsImNhbWVyYUJ1ZiIsInJlbmRlckN0eCIsImNvbnN0cnVjdG9yIiwid2luZG93IiwiT2Zmc2NyZWVuQ2FudmFzIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwid2lkdGgiLCJoZWlnaHQiLCJjcmVhdGVCb3VuZCIsIm1vZGVsIiwiY3JlYXRlQnVmZmVycyIsInRleHR1cmUiLCJtYXRlcmlhbCIsImlzVmFsaWQiLCJpZCIsImJ1ZmZlciIsImNhbGxGdW5jdGlvbiIsImNhbGxDcmVhdGVCb3VuZGluZyIsInBvc2l0aW9uQnVmZmVyIiwibGVuZ3RoIiwiaW5kaWNpZXNCdWZmZXIiLCJub3JtYWxCdWZmZXIiLCJ0ZXhjb29yZEJ1ZmZlciIsIm1hdHJpeEJ1ZmZlciIsInJlbmRlciIsImNhbnZhcyIsImNhbWVyYSIsImN0eCIsImdldENvbnRleHQiLCJjb25zb2xlIiwiZXJyb3IiLCJpbWFnZWRhdGEiLCJjcmVhdGVJbWFnZURhdGEiLCJwaXhlbHMiLCJkYXRhIiwicmVsZWFzZSIsImNyZWF0ZUJ1ZmZlciIsInNldEFycmF5IiwiZHVtcEFzQXJyYXkiLCJjYWxsU2V0Q2FtZXJhIiwicmVzdWx0IiwiY2FsbFBhdGhUcmFjZXIiLCJyZXN1bHQyIiwiY2FsbFJlYWRTdHJlYW0iLCJyZW5kZXJmdW5jIiwidGltZXIiLCJzZXRJbnRlcnZhbCIsImkiLCJnZXQiLCJwdXRJbWFnZURhdGEiLCJjbGVhckludGVydmFsIiwicHJlcGFyZVBhcnRpYWxSZW5kZXJpbmciLCJpbWFnZURhdGEiLCJwYXJ0aWFsUmVuZGVyaW5nIiwidXBkYXRlIiwiVmVjdG9yMyIsIngiLCJ5IiwieiIsIl94IiwiX3kiLCJfeiIsInNldCIsImxlbmd0aDIiLCJNYXRoIiwic3FydCIsImRpc3RhbmNlIiwiYSIsImFkZCIsInN1YnRyYWN0IiwibXVsdGlwbHkiLCJkaXZpZGUiLCJhc3NlcnQiLCJub3JtYWxpemUiLCJkb3QiLCJjcm9zcyIsImVxdWFsIiwiY29weSIsImdldEFycmF5IiwiRmxvYXQzMkFycmF5IiwiVmVjdG9yNCIsInciLCJfdyIsIk1hdHJpeDQiLCJtYXRyaXgiLCJudW1BcnJheSIsImV5ZSIsImVtcHR5IiwiZmlsbCIsInNjYWxlTWF0cml4Iiwic2NhbGUiLCJ0cmFuc2xhdGVNYXRyaXgiLCJtb3ZlIiwibSIsIm4iLCJzdWIiLCJtdWwiLCJ0cmFuc3Bvc2UiLCJpbnZlcnNlIiwibWF0IiwiYiIsImMiLCJkIiwiZSIsImYiLCJnIiwiaCIsImoiLCJrIiwibCIsIm8iLCJwIiwicSIsInIiLCJzIiwidCIsInUiLCJ2IiwiQSIsIkIiLCJpdmQiLCJFcnJvciIsImRlc3QiLCJnZXRTY2FsZVJvdGF0aW9uTWF0cml4IiwiZ2V0VHJhbnNsYXRlVmVjdG9yIiwiUXVhdGVybmlvbiIsImFuZ2xlQXhpcyIsImFuZ2xlIiwiX2F4aXMiLCJheGlzIiwic2luIiwiY29zIiwiZXVsYXJBbmdsZSIsInJvdCIsInhjIiwieHMiLCJ5YyIsInlzIiwiemMiLCJ6cyIsImZyb21NYXRyaXgiLCJtMDAiLCJtMTAiLCJtMjAiLCJtMDEiLCJtMTEiLCJtMjEiLCJtMDIiLCJtMTIiLCJtMjIiLCJlbGVtZW50IiwibWF4SW5kZXgiLCJsZW4iLCJUcmFuc2Zvcm0iLCJyb3RhdGlvbiIsInBvc2l0aW9uIiwidHJhbnNsYXRlIiwiTW9kZWwiLCJfcG9zaXRpb24iLCJfcG9zaXRpb25CdWZmZXIiLCJfbm9ybWFsIiwiX25vcm1hbEJ1ZmZlciIsIl90ZXhjb29yZCIsIl90ZXhjb29yZEJ1ZmZlciIsIl9pbmRpY2llcyIsIkludDMyQXJyYXkiLCJfaW5kaWNpZXNCdWZmZXIiLCJfYm91bmRpbmdCb3giLCJtaW4iLCJtYXgiLCJfbWF0cml4IiwiX21hdHJpeEJ1ZmZlciIsIl90cmFuc2Zvcm0iLCJfbWF0ZXJpYWwiLCJjcmVhdGVCb3VuZGluZ0JveCIsInBvcyIsInRyYW5zZm9ybSIsIm5vcm1hbCIsInRleGNvb3JkIiwiaW5kaWNpZXMiLCJtYW5hZ2VyIiwiY29uY2F0IiwiYm91bmRpbmdCb3giLCJHTFRGTG9hZGVyIiwicmF3SnNvbiIsImxvYWQiLCJ1cmwiLCJyZXNwb25zZSIsImZldGNoIiwiaGVhZGVycyIsImpzb24iLCJhbmFsaXplIiwibm9kZXMiLCJtZXNoZXMiLCJhY2Nlc3NvcnMiLCJidWZmZXJWaWV3cyIsImJ1ZmZlcnMiLCJBcnJheSIsImlzQXJyYXkiLCJub2RlIiwicHJpbWl0aXZlcyIsInByaW1pdGl2ZSIsImJ1ZlBvcyIsImF0dHJpYnV0ZXMiLCJQT1NJVElPTiIsImJ1Zk5vcm0iLCJOT1JNQUwiLCJidWZUZXgiLCJURVhDT09SRF8wIiwiYnVmSW5kIiwiaW5kaWNlcyIsInVyaSIsInRyYW5zbGF0aW9uIiwiYmxvYiIsImFycmF5QnVmZmVyIiwiYnl0ZU9mZnNldCIsImJ5dGVMZW5ndGgiLCJmcm9tIiwiSW50MTZBcnJheSIsIk1BVEVSSUFMX1VOSUZPUk1fTEVOR1RIIiwiTWF0ZXJpYWwiLCJfbWF0ZXJpYWxCdWZmZXIiLCJjcmVhdGVPcHRpb25BcnJheSIsIkdsYXNzIiwiX3JobyIsInJobyIsIkRpZmZ1c2UiLCJjb2xvciIsIkNhbWVyYSIsIl9wb3MiLCJfZm9yd2FyZCIsIl90b3AiLCJfcmlnaHQiLCJfZGlzdCIsInZpZXdBbmdsZSIsInRhbiIsImZvcndhcmQiLCJyaWdodCIsInRvcCIsImRpc3QiLCJhdGFuIiwibG9va0F0IiwidG8iLCJJTUFHRV9TSVpFIiwiVGV4dHVyZSIsImltYWdlIiwibmVlZHNVcGRhdGUiLCJpbWFnZUFycmF5IiwidmFsaWQiLCJfYnVmZmVyIiwiY3JlYXRlUGl4ZWxBcnJheSIsImRyYXdJbWFnZSIsImdldEltYWdlRGF0YSIsIndhc20iLCJsb2FkV29ya2VySW1hZ2UiLCJpbWFnZVJlc3BvbnNlIiwiaW1hZ2VCbG9iIiwiY3JlYXRlSW1hZ2VCaXRtYXAiLCJXYXNtQnVmZmVyIiwiX21vZHVsZSIsIl9iYXNlIiwiX3R5cGUiLCJfc3RyaWRlIiwiX2xlbmd0aCIsInR5cGUiLCJtb2R1bGUiLCJzaXplIiwiX21hbGxvYyIsImluZGV4IiwiZ2V0VmFsdWUiLCJ2YWx1ZSIsInNldFZhbHVlIiwiYXJyYXkiLCJmb3JFYWNoIiwiZ2V0UG9pbnRlciIsIl9mcmVlIiwiV2FzbU1vZHVsZUdlbmVyYXRvciIsIk1vZHVsZSIsImFyZ3VtZW50c18iLCJ0aGlzUHJvZ3JhbSIsInF1aXRfIiwic3RhdHVzIiwidG9UaHJvdyIsIkVOVklST05NRU5UX0lTX1dFQiIsIkVOVklST05NRU5UX0lTX1dPUktFUiIsImltcG9ydFNjcmlwdHMiLCJFTlZJUk9OTUVOVF9JU19OT0RFIiwicHJvY2VzcyIsInZlcnNpb25zIiwic2NyaXB0RGlyZWN0b3J5Iiwid29ya2VyR2xvYmFsU2NvcGUiLCJzZWxmIiwibG9jYXRlRmlsZSIsInBhdGgiLCJyZWFkXyIsInJlYWRBc3luYyIsInJlYWRCaW5hcnkiLCJsb2dFeGNlcHRpb25PbkV4aXQiLCJFeGl0U3RhdHVzIiwidG9Mb2ciLCJlcnIiLCJub2RlRlMiLCJub2RlUGF0aCIsInJlcXVpcmUiLCJkaXJuYW1lIiwiX19kaXJuYW1lIiwic2hlbGxfcmVhZCIsImZpbGVuYW1lIiwiYmluYXJ5IiwicmVhZEZpbGVTeW5jIiwicmV0IiwiVWludDhBcnJheSIsIm9ubG9hZCIsIm9uZXJyb3IiLCJyZWFkRmlsZSIsImFyZ3YiLCJyZXBsYWNlIiwic2xpY2UiLCJleHBvcnRzIiwib24iLCJleCIsInJlYXNvbiIsImtlZXBSdW50aW1lQWxpdmUiLCJleGl0Q29kZSIsImV4aXQiLCJpbnNwZWN0IiwibG9jYXRpb24iLCJocmVmIiwiY3VycmVudFNjcmlwdCIsInNyYyIsImluZGV4T2YiLCJzdWJzdHIiLCJsYXN0SW5kZXhPZiIsInhociIsIlhNTEh0dHBSZXF1ZXN0Iiwib3BlbiIsInNlbmQiLCJyZXNwb25zZVRleHQiLCJyZXNwb25zZVR5cGUiLCJvdXQiLCJwcmludCIsImxvZyIsImJpbmQiLCJwcmludEVyciIsIndhcm4iLCJhcmd1bWVudHMiLCJxdWl0IiwiYmFzZTY0VG9BcnJheUJ1ZmZlciIsImJhc2U2NCIsImJpbmFyeV9zdHJpbmciLCJCdWZmZXIiLCJ0b1N0cmluZyIsImF0b2IiLCJieXRlcyIsImNoYXJDb2RlQXQiLCJ3YXNtQmluYXJ5IiwibWFpbldhc20iLCJub0V4aXRSdW50aW1lIiwiV2ViQXNzZW1ibHkiLCJhYm9ydCIsInB0ciIsImNoYXJBdCIsIkhFQVA4IiwiSEVBUDE2IiwiSEVBUDMyIiwidGVtcEk2NCIsInRlbXBEb3VibGUiLCJhYnMiLCJmbG9vciIsImNlaWwiLCJIRUFQRjMyIiwiSEVBUEY2NCIsIk51bWJlciIsIndhc21NZW1vcnkiLCJBQk9SVCIsIkVYSVRTVEFUVVMiLCJjb25kaXRpb24iLCJ0ZXh0IiwiZ2V0Q0Z1bmMiLCJpZGVudCIsImZ1bmMiLCJjY2FsbCIsInJldHVyblR5cGUiLCJhcmdUeXBlcyIsImFyZ3MiLCJ0b0MiLCJzdHIiLCJ1bmRlZmluZWQiLCJzdGFja0FsbG9jIiwic3RyaW5nVG9VVEY4IiwiYXJyIiwid3JpdGVBcnJheVRvTWVtb3J5IiwiY29udmVydFJldHVyblZhbHVlIiwiVVRGOFRvU3RyaW5nIiwiQm9vbGVhbiIsImNBcmdzIiwic3RhY2siLCJjb252ZXJ0ZXIiLCJzdGFja1NhdmUiLCJvbkRvbmUiLCJzdGFja1Jlc3RvcmUiLCJVVEY4RGVjb2RlciIsIlRleHREZWNvZGVyIiwiVVRGOEFycmF5VG9TdHJpbmciLCJoZWFwIiwiaWR4IiwibWF4Qnl0ZXNUb1JlYWQiLCJlbmRJZHgiLCJlbmRQdHIiLCJzdWJhcnJheSIsImRlY29kZSIsInUwIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidTEiLCJ1MiIsImNoIiwiSEVBUFU4Iiwic3RyaW5nVG9VVEY4QXJyYXkiLCJvdXRJZHgiLCJtYXhCeXRlc1RvV3JpdGUiLCJzdGFydElkeCIsIm91dFB0ciIsImxlbmd0aEJ5dGVzVVRGOCIsImFsbG9jYXRlVVRGOE9uU3RhY2siLCJhbGlnblVwIiwibXVsdGlwbGUiLCJ1cGRhdGVHbG9iYWxCdWZmZXJBbmRWaWV3cyIsImJ1ZiIsIkludDhBcnJheSIsIkhFQVBVMTYiLCJVaW50MTZBcnJheSIsIkhFQVBVMzIiLCJVaW50MzJBcnJheSIsIkZsb2F0NjRBcnJheSIsIndhc21UYWJsZSIsIl9fQVRQUkVSVU5fXyIsIl9fQVRJTklUX18iLCJfX0FUTUFJTl9fIiwiX19BVFBPU1RSVU5fXyIsInJ1bnRpbWVLZWVwYWxpdmVDb3VudGVyIiwicHJlUnVuIiwiYWRkT25QcmVSdW4iLCJzaGlmdCIsImNhbGxSdW50aW1lQ2FsbGJhY2tzIiwiaW5pdFJ1bnRpbWUiLCJwcmVNYWluIiwicG9zdFJ1biIsImFkZE9uUG9zdFJ1biIsImNiIiwidW5zaGlmdCIsImFkZE9uSW5pdCIsInJ1bkRlcGVuZGVuY2llcyIsImRlcGVuZGVuY2llc0Z1bGZpbGxlZCIsImFkZFJ1bkRlcGVuZGVuY3kiLCJtb25pdG9yUnVuRGVwZW5kZW5jaWVzIiwicmVtb3ZlUnVuRGVwZW5kZW5jeSIsImNhbGxiYWNrIiwicHJlbG9hZGVkSW1hZ2VzIiwicHJlbG9hZGVkQXVkaW9zIiwid2hhdCIsIm9uQWJvcnQiLCJSdW50aW1lRXJyb3IiLCJkYXRhVVJJUHJlZml4IiwiaXNEYXRhVVJJIiwic3RhcnRzV2l0aCIsImlzRmlsZVVSSSIsIndhc21CaW5hcnlGaWxlIiwiZ2V0QmluYXJ5IiwiZmlsZSIsImdldEJpbmFyeVByb21pc2UiLCJjcmVkZW50aWFscyIsInRoZW4iLCJvayIsImNhdGNoIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjcmVhdGVXYXNtIiwiaW5mbyIsImFzbUxpYnJhcnlBcmciLCJyZWNlaXZlSW5zdGFuY2UiLCJpbnN0YW5jZSIsImFzbSIsIm1lbW9yeSIsIl9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUiLCJfX3dhc21fY2FsbF9jdG9ycyIsInJlY2VpdmVJbnN0YW50aWF0aW9uUmVzdWx0IiwiaW5zdGFudGlhdGVBcnJheUJ1ZmZlciIsInJlY2VpdmVyIiwiaW5zdGFudGlhdGUiLCJpbnN0YW50aWF0ZUFzeW5jIiwiaW5zdGFudGlhdGVTdHJlYW1pbmciLCJpbnN0YW50aWF0ZVdhc20iLCJjYWxsYmFja3MiLCJhcmciLCJnZXRXYXNtVGFibGVFbnRyeSIsIndhc21UYWJsZU1pcnJvciIsImZ1bmNQdHIiLCJoYW5kbGVFeGNlcHRpb24iLCJfX19hc3NlcnRfZmFpbCIsImxpbmUiLCJfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uIiwiX2F0ZXhpdCIsIl9fX2N4YV9hdGV4aXQiLCJhMCIsImExIiwiRXhjZXB0aW9uSW5mbyIsImV4Y1B0ciIsInNldF90eXBlIiwiZ2V0X3R5cGUiLCJzZXRfZGVzdHJ1Y3RvciIsImRlc3RydWN0b3IiLCJnZXRfZGVzdHJ1Y3RvciIsInNldF9yZWZjb3VudCIsInJlZmNvdW50Iiwic2V0X2NhdWdodCIsImNhdWdodCIsImdldF9jYXVnaHQiLCJzZXRfcmV0aHJvd24iLCJyZXRocm93biIsImdldF9yZXRocm93biIsImluaXQiLCJhZGRfcmVmIiwicmVsZWFzZV9yZWYiLCJwcmV2IiwiX19fY3hhX3Rocm93IiwiX2Fib3J0IiwiX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZyIsIm51bSIsImNvcHlXaXRoaW4iLCJlbXNjcmlwdGVuX3JlYWxsb2NfYnVmZmVyIiwiZ3JvdyIsIl9lbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwIiwicmVxdWVzdGVkU2l6ZSIsIm9sZFNpemUiLCJtYXhIZWFwU2l6ZSIsImN1dERvd24iLCJvdmVyR3Jvd25IZWFwU2l6ZSIsIm5ld1NpemUiLCJyZXBsYWNlbWVudCIsIlNZU0NBTExTIiwibWFwcGluZ3MiLCJwcmludENoYXIiLCJzdHJlYW0iLCJjdXJyIiwicHVzaCIsInZhcmFyZ3MiLCJnZXRTdHIiLCJnZXQ2NCIsImxvdyIsIl9mZF93cml0ZSIsImZkIiwiaW92IiwiaW92Y250IiwicG51bSIsIl9zZXRUZW1wUmV0MCIsInZhbCIsIl9fX3dhc21fY2FsbF9jdG9ycyIsImFwcGx5IiwiX21haW4iLCJtYWluIiwiX2NyZWF0ZVRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiX2NyZWF0ZUJvdW5kaW5nIiwiY3JlYXRlQm91bmRpbmciLCJfc2V0Q2FtZXJhIiwic2V0Q2FtZXJhIiwiX3JlYWRTdHJlYW0iLCJyZWFkU3RyZWFtIiwiX3BhdGhUcmFjZXIiLCJwYXRoVHJhY2VyIiwiX19fZXJybm9fbG9jYXRpb24iLCJfX2Vycm5vX2xvY2F0aW9uIiwibWFsbG9jIiwiZnJlZSIsImR5bkNhbGxfamlqaSIsImNhbGxlZFJ1biIsIm5hbWUiLCJtZXNzYWdlIiwicnVuQ2FsbGVyIiwicnVuIiwiY2FsbE1haW4iLCJlbnRyeUZ1bmN0aW9uIiwiYXJnYyIsImRvUnVuIiwib25SdW50aW1lSW5pdGlhbGl6ZWQiLCJzaG91bGRSdW5Ob3ciLCJzZXRTdGF0dXMiLCJzZXRUaW1lb3V0IiwicHJvY0V4aXQiLCJjb2RlIiwib25FeGl0IiwicHJlSW5pdCIsInBvcCIsIm5vSW5pdGlhbFJ1biIsIldhc21NYW5hZ2VyIiwiRXZlbnRUYXJnZXQiLCJkaXNwYXRjaEV2ZW50IiwiRXZlbnQiLCJmdW5jbmFtZSIsInJhd0FyZ3MiLCJtYXAiLCJWZWN0b3IyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0lBS0EsTUFBTUEsWUFBWSxHQUFHLElBQXJCO0lBRUE7Ozs7Ozs7VUFNYUM7SUFDSEMsRUFBQUEsV0FBVztJQUVYQyxFQUFBQSxhQUFhO0lBRWJDLEVBQUFBLFFBQVE7SUFFUkMsRUFBQUEsU0FBUyxHQUFzQixJQUF0QjtJQUVUQyxFQUFBQSxTQUFTLEdBQXNCLElBQXRCOztJQUdUQyxFQUFBQSxTQUFTLEdBTU4sSUFOTTtJ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LENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQUFyQyxHQUEyQ0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQUpuQyxFQUtqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBcEMsR0FBMENELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FMbEMsRUFNakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXBDLEdBQTBDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxDQUFELENBTmxDLEVBT2pCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQUFyQyxHQUEyQ0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsQ0FBRCxDQVBuQyxFQVFqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FBckMsR0FBMkNELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLENBQUQsQ0FSbkMsRUFTakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxFQUFELENBQXBDLEdBQTJDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxFQUFELENBVG5DLEVBVWpCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQVIsR0FBY0QsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUF0QixHQUE0QkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsRUFBRCxDQUFwQyxHQUEyQ0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsRUFBRCxDQVZuQyxFQVdqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFSLEdBQWNELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBdEIsR0FBNEJELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBckMsR0FBNENELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FYcEMsRUFZakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBUixHQUFjRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQXRCLEdBQTRCRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxFQUFELENBQXJDLEdBQTRDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxFQUFELENBWnBDLEVBYWpCRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxFQUFELENBQVIsR0FBZUQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsRUFBRCxDQUF2QixHQUE4QkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsRUFBRCxDQUF0QyxHQUE2Q0QsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRQyxDQUFDLENBQUMsRUFBRCxDQWJyQyxFQWNqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsRUFBRCxDQUFSLEdBQWVELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLEVBQUQsQ0FBdkIsR0FBOEJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLEVBQUQsQ0FBdEMsR0FBNkNELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FkckMsRUFlakJELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLEVBQUQsQ0FBUixHQUFlRCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxFQUFELENBQXZCLEdBQThCRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxFQUFELENBQXZDLEdBQThDRCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFDLENBQUMsQ0FBQyxFQUFELENBZnRDLEVBZ0JqQkQsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsRUFBRCxDQUFSLEdBQWVELENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLEVBQUQsQ0FBdkIsR0FBOEJELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBdkMsR0FBOENELENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FoQnRDLENBQVosQ0FBUDtJQWtCRDs7SUFDRCxRQUFJRSxHQUFHLFlBQVloQixPQUFuQixFQUE0QjtJQUMxQixhQUFPLElBQUlBLE9BQUosQ0FDTGEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQUFHLENBQUN4QyxDQUFYLEdBQWVxQyxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBQUcsQ0FBQ3ZDLENBQTFCLEdBQThCb0MsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQUFHLENBQUN0QyxDQUF6QyxHQUE2Q21DLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUcsR0FBRyxDQUFDZixDQURwRCxFQUVMWSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBQUcsQ0FBQ3hDLENBQVgsR0FBZXFDLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0csR0FBRyxDQUFDdkMsQ0FBMUIsR0FBOEJvQyxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBQUcsQ0FBQ3RDLENBQXpDLEdBQTZDbUMsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRRyxHQUFHLENBQUNmLENBRnBELEVBR0xZLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0csR0FBRyxDQUFDeEMsQ0FBWCxHQUFlcUMsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQUFHLENBQUN2QyxDQUExQixHQUE4Qm9DLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUcsR0FBRyxDQUFDdEMsQ0FBMUMsR0FBOENtQyxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFHLEdBQUcsQ0FBQ2YsQ0FIckQsRUFJTFksQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQUFHLENBQUN4QyxDQUFYLEdBQWVxQyxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBQUcsQ0FBQ3ZDLENBQTFCLEdBQThCb0MsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRRyxHQUFHLENBQUN0QyxDQUExQyxHQUE4Q21DLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUcsR0FBRyxDQUFDZixDQUpyRCxDQUFQO0lBTUQ7O0lBQ0QsV0FBTyxJQUFJRSxPQUFKLENBQVksQ0FDakJVLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0csR0FEVSxFQUVqQkgsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQUZVLEVBR2pCSCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBSFUsRUFJakJILENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0csR0FKVSxFQUtqQkgsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQUxVLEVBTWpCSCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBTlUsRUFPakJILENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0csR0FQVSxFQVFqQkgsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRyxHQVJVLEVBU2pCSCxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9HLEdBVFUsRUFVakJILENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0csR0FWVSxFQVdqQkgsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRRyxHQVhTLEVBWWpCSCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFHLEdBWlMsRUFhakJILENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUcsR0FiUyxFQWNqQkgsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRRyxHQWRTLEVBZWpCSCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFHLEdBZlMsRUFnQmpCSCxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFHLEdBaEJTLENBQVosQ0FBUDtJQWtCRDtJQUVEOzs7Ozs7OztJQU1BQyxFQUFBQSxTQUFTO0lBQ1AsVUFBTUosQ0FBQyxHQUFhLEtBQUtULE1BQXpCO0lBQ0EsV0FBTyxJQUFJRCxPQUFKLENBQVksQ0FDakJVLENBQUMsQ0FBQyxDQUFELENBRGdCLEVBRWpCQSxDQUFDLENBQUMsQ0FBRCxDQUZnQixFQUdqQkEsQ0FBQyxDQUFDLENBQUQsQ0FIZ0IsRUFJakJBLENBQUMsQ0FBQyxFQUFELENBSmdCLEVBS2pCQSxDQUFDLENBQUMsQ0FBRCxDQUxnQixFQU1qQkEsQ0FBQyxDQUFDLENBQUQsQ0FOZ0IsRUFPakJBLENBQUMsQ0FBQyxDQUFELENBUGdCLEVBUWpCQSxDQUFDLENBQUMsRUFBRCxDQVJnQixFQVNqQkEsQ0FBQyxDQUFDLENBQUQsQ0FUZ0IsRUFVakJBLENBQUMsQ0FBQyxDQUFELENBVmdCLEVBV2pCQSxDQUFDLENBQUMsRUFBRCxDQVhnQixFQVlqQkEsQ0FBQyxDQUFDLEVBQUQsQ0FaZ0IsRUFhakJBLENBQUMsQ0FBQyxDQUFELENBYmdCLEVBY2pCQSxDQUFDLENBQUMsQ0FBRCxDQWRnQixFQWVqQkEsQ0FBQyxDQUFDLEVBQUQsQ0FmZ0IsRUFnQmpCQSxDQUFDLENBQUMsRUFBRCxDQWhCZ0IsQ0FBWixDQUFQO0lBa0JEO0lBRUQ7Ozs7Ozs7O0lBTUFLLEVBQUFBLE9BQU87SUFDTCxVQUFNQyxHQUFHLEdBQWEsS0FBS2YsTUFBM0I7SUFDQSxVQUFNakIsQ0FBQyxHQUFHZ0MsR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1DLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1FLENBQUMsR0FBR0YsR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1HLENBQUMsR0FBR0gsR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1JLENBQUMsR0FBR0osR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1LLENBQUMsR0FBR0wsR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1NLENBQUMsR0FBR04sR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1PLENBQUMsR0FBR1AsR0FBRyxDQUFDLENBQUQsQ0FBYjtJQUNBLFVBQU1wRCxDQUFDLEdBQUdvRCxHQUFHLENBQUMsQ0FBRCxDQUFiO0lBQ0EsVUFBTVEsQ0FBQyxHQUFHUixHQUFHLENBQUMsQ0FBRCxDQUFiO0lBQ0EsVUFBTVMsQ0FBQyxHQUFHVCxHQUFHLENBQUMsRUFBRCxDQUFiO0lBQ0EsVUFBTVUsQ0FBQyxHQUFHVixHQUFHLENBQUMsRUFBRCxDQUFiO0lBQ0EsVUFBTU4sQ0FBQyxHQUFHTSxHQUFHLENBQUMsRUFBRCxDQUFiO0lBQ0EsVUFBTUwsQ0FBQyxHQUFHSyxHQUFHLENBQUMsRUFBRCxDQUFiO0lBQ0EsVUFBTVcsQ0FBQyxHQUFHWCxHQUFHLENBQUMsRUFBRCxDQUFiO0lBQ0EsVUFBTVksQ0FBQyxHQUFHWixHQUFHLENBQUMsRUFBRCxDQUFiO0lBQ0EsVUFBTWEsQ0FBQyxHQUFHN0MsQ0FBQyxHQUFHcUMsQ0FBSixHQUFRSixDQUFDLEdBQUdHLENBQXRCO0lBQ0EsVUFBTVUsQ0FBQyxHQUFHOUMsQ0FBQyxHQUFHc0MsQ0FBSixHQUFRSixDQUFDLEdBQUdFLENBQXRCO0lBQ0EsVUFBTVcsQ0FBQyxHQUFHL0MsQ0FBQyxHQUFHdUMsQ0FBSixHQUFRSixDQUFDLEdBQUdDLENBQXRCO0lBQ0EsVUFBTVksQ0FBQyxHQUFHZixDQUFDLEdBQUdLLENBQUosR0FBUUosQ0FBQyxHQUFHRyxDQUF0QjtJQUNBLFVBQU1ZLENBQUMsR0FBR2hCLENBQUMsR0FBR00sQ0FBSixHQUFRSixDQUFDLEdBQUdFLENBQXRCO0lBQ0EsVUFBTWEsQ0FBQyxHQUFHaEIsQ0FBQyxHQUFHSyxDQUFKLEdBQVFKLENBQUMsR0FBR0csQ0FBdEI7SUFDQSxVQUFNeEIsQ0FBQyxHQUFHbEMsQ0FBQyxHQUFHK0MsQ0FBSixHQUFRYSxDQUFDLEdBQUdkLENBQXRCO0lBQ0EsVUFBTXJDLENBQUMsR0FBR1QsQ0FBQyxHQUFHK0QsQ0FBSixHQUFRRixDQUFDLEdBQUdmLENBQXRCO0lBQ0EsVUFBTXBDLENBQUMsR0FBR1YsQ0FBQyxHQUFHZ0UsQ0FBSixHQUFRRixDQUFDLEdBQUdoQixDQUF0QjtJQUNBLFVBQU1uQyxDQUFDLEdBQUdpRCxDQUFDLEdBQUdHLENBQUosR0FBUUYsQ0FBQyxHQUFHZCxDQUF0QjtJQUNBLFVBQU13QixDQUFDLEdBQUdYLENBQUMsR0FBR0ksQ0FBSixHQUFRRixDQUFDLEdBQUdmLENBQXRCO0lBQ0EsVUFBTXlCLENBQUMsR0FBR1gsQ0FBQyxHQUFHRyxDQUFKLEdBQVFGLENBQUMsR0FBR0MsQ0FBdEI7SUFDQSxRQUFJVSxHQUFHLEdBQUdSLENBQUMsR0FBR08sQ0FBSixHQUFRTixDQUFDLEdBQUdLLENBQVosR0FBZ0JKLENBQUMsR0FBR3hELENBQXBCLEdBQXdCeUQsQ0FBQyxHQUFHMUQsQ0FBNUIsR0FBZ0MyRCxDQUFDLEdBQUc1RCxDQUFwQyxHQUF3QzZELENBQUMsR0FBR3BDLENBQXREO0lBQ0EsUUFBSXVDLEdBQUcsS0FBSyxDQUFaLEVBQWUsTUFBTSxJQUFJQyxLQUFKLENBQVUsV0FBVixDQUFOO0lBQ2ZELElBQUFBLEdBQUcsR0FBRyxJQUFJQSxHQUFWO0lBRUEsVUFBTUUsSUFBSSxHQUFhLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsRUFBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsRUFBeUIsQ0FBekIsRUFBNEIsQ0FBNUIsRUFBK0IsQ0FBL0IsRUFBa0MsQ0FBbEMsRUFBcUMsQ0FBckMsRUFBd0MsQ0FBeEMsRUFBMkMsQ0FBM0MsRUFBOEMsQ0FBOUMsQ0FBdkI7SUFDQUEsSUFBQUEsSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVLENBQUNsQixDQUFDLEdBQUdlLENBQUosR0FBUWQsQ0FBQyxHQUFHYSxDQUFaLEdBQWdCWixDQUFDLEdBQUdoRCxDQUFyQixJQUEwQjhELEdBQXBDO0lBQ0FFLElBQUFBLElBQUksQ0FBQyxDQUFELENBQUosR0FBVSxDQUFDLENBQUN0QixDQUFELEdBQUttQixDQUFMLEdBQVNsQixDQUFDLEdBQUdpQixDQUFiLEdBQWlCaEIsQ0FBQyxHQUFHNUMsQ0FBdEIsSUFBMkI4RCxHQUFyQztJQUNBRSxJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQzVCLENBQUMsR0FBR3VCLENBQUosR0FBUVAsQ0FBQyxHQUFHTSxDQUFaLEdBQWdCTCxDQUFDLEdBQUdJLENBQXJCLElBQTBCSyxHQUFwQztJQUNBRSxJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQyxDQUFDZixDQUFELEdBQUtVLENBQUwsR0FBU1QsQ0FBQyxHQUFHUSxDQUFiLEdBQWlCUCxDQUFDLEdBQUdNLENBQXRCLElBQTJCSyxHQUFyQztJQUNBRSxJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQyxDQUFDbkIsQ0FBRCxHQUFLZ0IsQ0FBTCxHQUFTZCxDQUFDLEdBQUdoRCxDQUFiLEdBQWlCaUQsQ0FBQyxHQUFHbEQsQ0FBdEIsSUFBMkJnRSxHQUFyQztJQUNBRSxJQUFBQSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsQ0FBQ3ZELENBQUMsR0FBR29ELENBQUosR0FBUWxCLENBQUMsR0FBRzVDLENBQVosR0FBZ0I2QyxDQUFDLEdBQUc5QyxDQUFyQixJQUEwQmdFLEdBQXBDO0lBQ0FFLElBQUFBLElBQUksQ0FBQyxDQUFELENBQUosR0FBVSxDQUFDLENBQUM3QixDQUFELEdBQUt3QixDQUFMLEdBQVNQLENBQUMsR0FBR0ksQ0FBYixHQUFpQkgsQ0FBQyxHQUFHRSxDQUF0QixJQUEyQk8sR0FBckM7SUFDQUUsSUFBQUEsSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVLENBQUMzRSxDQUFDLEdBQUdzRSxDQUFKLEdBQVFULENBQUMsR0FBR00sQ0FBWixHQUFnQkwsQ0FBQyxHQUFHSSxDQUFyQixJQUEwQk8sR0FBcEM7SUFDQUUsSUFBQUEsSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVLENBQUNuQixDQUFDLEdBQUdlLENBQUosR0FBUWQsQ0FBQyxHQUFHL0MsQ0FBWixHQUFnQmlELENBQUMsR0FBR3pCLENBQXJCLElBQTBCdUMsR0FBcEM7SUFDQUUsSUFBQUEsSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVLENBQUMsQ0FBQ3ZELENBQUQsR0FBS21ELENBQUwsR0FBU2xCLENBQUMsR0FBRzNDLENBQWIsR0FBaUI2QyxDQUFDLEdBQUdyQixDQUF0QixJQUEyQnVDLEdBQXJDO0lBQ0FFLElBQUFBLElBQUksQ0FBQyxFQUFELENBQUosR0FBVyxDQUFDN0IsQ0FBQyxHQUFHdUIsQ0FBSixHQUFRdEIsQ0FBQyxHQUFHb0IsQ0FBWixHQUFnQkgsQ0FBQyxHQUFHQyxDQUFyQixJQUEwQlEsR0FBckM7SUFDQUUsSUFBQUEsSUFBSSxDQUFDLEVBQUQsQ0FBSixHQUFXLENBQUMsQ0FBQzNFLENBQUQsR0FBS3FFLENBQUwsR0FBU1QsQ0FBQyxHQUFHTyxDQUFiLEdBQWlCTCxDQUFDLEdBQUdHLENBQXRCLElBQTJCUSxHQUF0QztJQUNBRSxJQUFBQSxJQUFJLENBQUMsRUFBRCxDQUFKLEdBQVcsQ0FBQyxDQUFDbkIsQ0FBRCxHQUFLN0MsQ0FBTCxHQUFTOEMsQ0FBQyxHQUFHaEQsQ0FBYixHQUFpQmlELENBQUMsR0FBR3hCLENBQXRCLElBQTJCdUMsR0FBdEM7SUFDQUUsSUFBQUEsSUFBSSxDQUFDLEVBQUQsQ0FBSixHQUFXLENBQUN2RCxDQUFDLEdBQUdULENBQUosR0FBUTBDLENBQUMsR0FBRzVDLENBQVosR0FBZ0I2QyxDQUFDLEdBQUdwQixDQUFyQixJQUEwQnVDLEdBQXJDO0lBQ0FFLElBQUFBLElBQUksQ0FBQyxFQUFELENBQUosR0FBVyxDQUFDLENBQUM3QixDQUFELEdBQUtzQixDQUFMLEdBQVNyQixDQUFDLEdBQUdtQixDQUFiLEdBQWlCSCxDQUFDLEdBQUdFLENBQXRCLElBQTJCUSxHQUF0QztJQUNBRSxJQUFBQSxJQUFJLENBQUMsRUFBRCxDQUFKLEdBQVcsQ0FBQzNFLENBQUMsR0FBR29FLENBQUosR0FBUVIsQ0FBQyxHQUFHTSxDQUFaLEdBQWdCTCxDQUFDLEdBQUdJLENBQXJCLElBQTBCUSxHQUFyQztJQUNBLFdBQU8sSUFBSXJDLE9BQUosQ0FBWXVDLElBQVosQ0FBUDtJQUNEO0lBRUQ7Ozs7Ozs7O0lBTUE1QyxFQUFBQSxRQUFRO0lBQ04sV0FBTyxJQUFJQyxZQUFKLENBQWlCLEtBQUtLLE1BQXRCLENBQVA7SUFDRDtJQUVEOzs7Ozs7OztJQU1BdUMsRUFBQUEsc0JBQXNCO0lBQ3BCLFVBQU05QixDQUFDLEdBQUcsS0FBS1QsTUFBZjtJQUNBLFdBQU8sSUFBSUQsT0FBSixDQUFZLENBQ2pCVSxDQUFDLENBQUMsQ0FBRCxDQURnQixFQUVqQkEsQ0FBQyxDQUFDLENBQUQsQ0FGZ0IsRUFHakJBLENBQUMsQ0FBQyxDQUFELENBSGdCLEVBSWpCLENBSmlCLEVBS2pCQSxDQUFDLENBQUMsQ0FBRCxDQUxnQixFQU1qQkEsQ0FBQyxDQUFDLENBQUQsQ0FOZ0IsRUFPakJBLENBQUMsQ0FBQyxDQUFELENBUGdCLEVBUWpCLENBUmlCLEVBU2pCQSxDQUFDLENBQUMsQ0FBRCxDQVRnQixFQVVqQkEsQ0FBQyxDQUFDLENBQUQsQ0FWZ0IsRUFXakJBLENBQUMsQ0FBQyxFQUFELENBWGdCLEVBWWpCLENBWmlCLEVBYWpCLENBYmlCLEVBY2pCLENBZGlCLEVBZWpCLENBZmlCLEVBZ0JqQixDQWhCaUIsQ0FBWixDQUFQO0lBa0JEO0lBRUQ7Ozs7Ozs7O0lBTUErQixFQUFBQSxrQkFBa0I7SUFDaEIsV0FBTyxJQUFJckUsT0FBSixDQUFZLEtBQUs2QixNQUFMLENBQVksRUFBWixDQUFaLEVBQTZCLEtBQUtBLE1BQUwsQ0FBWSxFQUFaLENBQTdCLEVBQThDLEtBQUtBLE1BQUwsQ0FBWSxFQUFaLENBQTlDLENBQVA7SUFDRDs7OztVQzNYVXlDO0lBQ1hSLEVBQUFBLENBQUM7SUFFRHBDLEVBQUFBLENBQUM7O0lBRURoRixFQUFBQSxZQUFZb0gsR0FBYXBDO0lBQ3ZCLFNBQUtvQyxDQUFMLEdBQVNBLENBQUMsSUFBSSxJQUFJOUQsT0FBSixDQUFZLENBQVosRUFBZSxDQUFmLEVBQWtCLENBQWxCLENBQWQ7SUFDQSxTQUFLMEIsQ0FBTCxHQUFTQSxDQUFDLElBQUksQ0FBZDtJQUNEOzs7SUFHRG5CLEVBQUFBLEdBQUcsQ0FBQ3VELENBQUQsRUFBYXBDLENBQWI7SUFDRCxTQUFLb0MsQ0FBTCxHQUFTQSxDQUFUO0lBQ0EsU0FBS3BDLENBQUwsR0FBU0EsQ0FBVDtJQUNBLFdBQU8sSUFBUDtJQUNEOztJQUVENkMsRUFBQUEsU0FBUyxDQUFDQyxLQUFELEVBQWdCQyxLQUFoQjtJQUNQLFVBQU1DLElBQUksR0FBWUQsS0FBSyxDQUFDdkQsU0FBTixFQUF0Qjs7SUFDQSxTQUFLNEMsQ0FBTCxHQUFTLElBQUk5RCxPQUFKLENBQ1AwRSxJQUFJLENBQUN6RSxDQUFMLEdBQVNRLElBQUksQ0FBQ2tFLEdBQUwsQ0FBU0gsS0FBSyxHQUFHLENBQWpCLENBREYsRUFFUEUsSUFBSSxDQUFDeEUsQ0FBTCxHQUFTTyxJQUFJLENBQUNrRSxHQUFMLENBQVNILEtBQUssR0FBRyxDQUFqQixDQUZGLEVBR1BFLElBQUksQ0FBQ3ZFLENBQUwsR0FBU00sSUFBSSxDQUFDa0UsR0FBTCxDQUFTSCxLQUFLLEdBQUcsQ0FBakIsQ0FIRixDQUFUO0lBS0EsU0FBSzlDLENBQUwsR0FBU2pCLElBQUksQ0FBQ21FLEdBQUwsQ0FBU0osS0FBSyxHQUFHLENBQWpCLENBQVQ7SUFDQSxXQUFPLElBQVA7SUFDRDs7SUFFREssRUFBQUEsVUFBVSxDQUFDQyxHQUFEO0lBQ1IsVUFBTTtJQUFFN0UsTUFBQUEsQ0FBRjtJQUFLQyxNQUFBQSxDQUFMO0lBQVFDLE1BQUFBO0lBQVIsUUFBYzJFLEdBQXBCO0lBQ0EsVUFBTUMsRUFBRSxHQUFHdEUsSUFBSSxDQUFDbUUsR0FBTCxDQUFTM0UsQ0FBVCxDQUFYO0lBQ0EsVUFBTStFLEVBQUUsR0FBR3ZFLElBQUksQ0FBQ2tFLEdBQUwsQ0FBUzFFLENBQVQsQ0FBWDtJQUNBLFVBQU1nRixFQUFFLEdBQUd4RSxJQUFJLENBQUNtRSxHQUFMLENBQVMxRSxDQUFULENBQVg7SUFDQSxVQUFNZ0YsRUFBRSxHQUFHekUsSUFBSSxDQUFDa0UsR0FBTCxDQUFTekUsQ0FBVCxDQUFYO0lBQ0EsVUFBTWlGLEVBQUUsR0FBRzFFLElBQUksQ0FBQ21FLEdBQUwsQ0FBU3pFLENBQVQsQ0FBWDtJQUNBLFVBQU1pRixFQUFFLEdBQUczRSxJQUFJLENBQUNrRSxHQUFMLENBQVN4RSxDQUFULENBQVg7SUFDQSxTQUFLMkQsQ0FBTCxHQUFTLElBQUk5RCxPQUFKLENBQ1ArRSxFQUFFLEdBQUdFLEVBQUwsR0FBVUUsRUFBVixHQUFlSCxFQUFFLEdBQUdFLEVBQUwsR0FBVUUsRUFEbEIsRUFFUEosRUFBRSxHQUFHQyxFQUFMLEdBQVVFLEVBQVYsR0FBZUosRUFBRSxHQUFHRyxFQUFMLEdBQVVFLEVBRmxCLEVBR1BMLEVBQUUsR0FBR0csRUFBTCxHQUFVQyxFQUFWLEdBQWVILEVBQUUsR0FBR0MsRUFBTCxHQUFVRyxFQUhsQixDQUFUO0lBS0EsU0FBSzFELENBQUwsR0FBU3FELEVBQUUsR0FBR0UsRUFBTCxHQUFVRyxFQUFWLEdBQWVKLEVBQUUsR0FBR0UsRUFBTCxHQUFVQyxFQUFsQztJQUNBLFdBQU8sSUFBUDtJQUNEOztJQUVEdEQsRUFBQUEsTUFBTTtJQUNKLFVBQU07SUFBRTVCLE1BQUFBLENBQUY7SUFBS0MsTUFBQUEsQ0FBTDtJQUFRQyxNQUFBQTtJQUFSLFFBQWMsS0FBSzJELENBQXpCO0lBQ0EsVUFBTTtJQUFFcEMsTUFBQUE7SUFBRixRQUFRLElBQWQ7SUFDQSxXQUFPLElBQUlFLE9BQUosQ0FBWSxDQUNqQjNCLENBQUMsSUFBSSxDQUFMLEdBQVNDLENBQUMsSUFBSSxDQUFkLEdBQWtCQyxDQUFDLElBQUksQ0FBdkIsR0FBMkJ1QixDQUFDLElBQUksQ0FEZixFQUVqQixLQUFLekIsQ0FBQyxHQUFHQyxDQUFKLEdBQVFDLENBQUMsR0FBR3VCLENBQWpCLENBRmlCLEVBR2pCLEtBQUt6QixDQUFDLEdBQUdFLENBQUosR0FBUUQsQ0FBQyxHQUFHd0IsQ0FBakIsQ0FIaUIsRUFJakIsQ0FKaUIsRUFLakIsS0FBS3pCLENBQUMsR0FBR0MsQ0FBSixHQUFRQyxDQUFDLEdBQUd1QixDQUFqQixDQUxpQixFQU1qQnhCLENBQUMsSUFBSSxDQUFMLEdBQVNELENBQUMsSUFBSSxDQUFkLEdBQWtCRSxDQUFDLElBQUksQ0FBdkIsR0FBMkJ1QixDQUFDLElBQUksQ0FOZixFQU9qQixLQUFLeEIsQ0FBQyxHQUFHQyxDQUFKLEdBQVFGLENBQUMsR0FBR3lCLENBQWpCLENBUGlCLEVBUWpCLENBUmlCLEVBU2pCLEtBQUt6QixDQUFDLEdBQUdFLENBQUosR0FBUUQsQ0FBQyxHQUFHd0IsQ0FBakIsQ0FUaUIsRUFVakIsS0FBS3hCLENBQUMsR0FBR0MsQ0FBSixHQUFRRixDQUFDLEdBQUd5QixDQUFqQixDQVZpQixFQVdqQnZCLENBQUMsSUFBSSxDQUFMLEdBQVN1QixDQUFDLElBQUksQ0FBZCxHQUFrQnpCLENBQUMsSUFBSSxDQUF2QixHQUEyQkMsQ0FBQyxJQUFJLENBWGYsRUFZakIsQ0FaaUIsRUFhakIsQ0FiaUIsRUFjakIsQ0FkaUIsRUFlakIsQ0FmaUIsRUFnQmpCLENBaEJpQixDQUFaLENBQVA7SUFrQkQ7O0lBRURtRixFQUFBQSxVQUFVLENBQUN6QyxHQUFEO0lBQ1IsVUFBTTBDLEdBQUcsR0FBVzFDLEdBQUcsQ0FBQ2YsTUFBSixDQUFXLENBQVgsQ0FBcEI7SUFDQSxVQUFNMEQsR0FBRyxHQUFXM0MsR0FBRyxDQUFDZixNQUFKLENBQVcsQ0FBWCxDQUFwQjtJQUNBLFVBQU0yRCxHQUFHLEdBQVc1QyxHQUFHLENBQUNmLE1BQUosQ0FBVyxDQUFYLENBQXBCO0lBQ0EsVUFBTTRELEdBQUcsR0FBVzdDLEdBQUcsQ0FBQ2YsTUFBSixDQUFXLENBQVgsQ0FBcEI7SUFDQSxVQUFNNkQsR0FBRyxHQUFXOUMsR0FBRyxDQUFDZixNQUFKLENBQVcsQ0FBWCxDQUFwQjtJQUNBLFVBQU04RCxHQUFHLEdBQVcvQyxHQUFHLENBQUNmLE1BQUosQ0FBVyxDQUFYLENBQXBCO0lBQ0EsVUFBTStELEdBQUcsR0FBV2hELEdBQUcsQ0FBQ2YsTUFBSixDQUFXLENBQVgsQ0FBcEI7SUFDQSxVQUFNZ0UsR0FBRyxHQUFXakQsR0FBRyxDQUFDZixNQUFKLENBQVcsQ0FBWCxDQUFwQjtJQUNBLFVBQU1pRSxHQUFHLEdBQVdsRCxHQUFHLENBQUNmLE1BQUosQ0FBVyxFQUFYLENBQXBCO0lBQ0EsVUFBTWtFLE9BQU8sR0FBRyxDQUNkVCxHQUFHLEdBQUdJLEdBQU4sR0FBWUksR0FBWixHQUFrQixDQURKLEVBRWQsQ0FBQ1IsR0FBRCxHQUFPSSxHQUFQLEdBQWFJLEdBQWIsR0FBbUIsQ0FGTCxFQUdkLENBQUNSLEdBQUQsR0FBT0ksR0FBUCxHQUFhSSxHQUFiLEdBQW1CLENBSEwsRUFJZFIsR0FBRyxHQUFHSSxHQUFOLEdBQVlJLEdBQVosR0FBa0IsQ0FKSixDQUFoQjtJQU9BLFFBQUlFLFFBQVEsR0FBVyxDQUF2QjtJQUNBQSxJQUFBQSxRQUFRLEdBQUdELE9BQU8sQ0FBQ0MsUUFBRCxDQUFQLEdBQW9CRCxPQUFPLENBQUMsQ0FBRCxDQUEzQixHQUFpQyxDQUFqQyxHQUFxQ0MsUUFBaEQ7SUFDQUEsSUFBQUEsUUFBUSxHQUFHRCxPQUFPLENBQUNDLFFBQUQsQ0FBUCxHQUFvQkQsT0FBTyxDQUFDLENBQUQsQ0FBM0IsR0FBaUMsQ0FBakMsR0FBcUNDLFFBQWhEO0lBQ0FBLElBQUFBLFFBQVEsR0FBR0QsT0FBTyxDQUFDQyxRQUFELENBQVAsR0FBb0JELE9BQU8sQ0FBQyxDQUFELENBQTNCLEdBQWlDLENBQWpDLEdBQXFDQyxRQUFoRDs7SUFFQSxRQUFJRCxPQUFPLENBQUNDLFFBQUQsQ0FBUCxHQUFvQixDQUF4QixFQUEyQjtJQUN6QixXQUFLbEMsQ0FBTCxHQUFTLElBQUk5RCxPQUFKLENBQVksQ0FBWixFQUFlLENBQWYsRUFBa0IsQ0FBbEIsQ0FBVDtJQUNBLFdBQUswQixDQUFMLEdBQVMsQ0FBVDtJQUNBcEQsTUFBQUEsT0FBTyxDQUFDQyxLQUFSLENBQWMsY0FBZDtJQUNBLGFBQU8sSUFBUDtJQUNEOztJQUVELFVBQU1rRixDQUFDLEdBQWEsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLENBQXBCO0lBQ0EsUUFBSUssQ0FBQyxHQUFXckQsSUFBSSxDQUFDQyxJQUFMLENBQVVxRixPQUFPLENBQUNDLFFBQUQsQ0FBakIsSUFBK0IsR0FBL0IsR0FBcUMsT0FBckQ7SUFDQXZDLElBQUFBLENBQUMsQ0FBQ3VDLFFBQUQsQ0FBRCxHQUFjbEMsQ0FBZDtJQUNBQSxJQUFBQSxDQUFDLEdBQUcsT0FBT0EsQ0FBWDs7SUFFQSxZQUFRa0MsUUFBUjtJQUNFLFdBQUssQ0FBTDtJQUFRO0lBQ052QyxVQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBQzhCLEdBQUcsR0FBR0UsR0FBUCxJQUFjM0IsQ0FBckI7SUFDQUwsVUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQUNtQyxHQUFHLEdBQUdKLEdBQVAsSUFBYzFCLENBQXJCO0lBQ0FMLFVBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFDa0MsR0FBRyxHQUFHRSxHQUFQLElBQWMvQixDQUFyQjtJQUNBO0lBQ0Q7O0lBQ0QsV0FBSyxDQUFMO0lBQVE7SUFDTkwsVUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQUM4QixHQUFHLEdBQUdFLEdBQVAsSUFBYzNCLENBQXJCO0lBQ0FMLFVBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFDa0MsR0FBRyxHQUFHRSxHQUFQLElBQWMvQixDQUFyQjtJQUNBTCxVQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBQ21DLEdBQUcsR0FBR0osR0FBUCxJQUFjMUIsQ0FBckI7SUFDQTtJQUNEOztJQUNELFdBQUssQ0FBTDtJQUFRO0lBQ05MLFVBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFDbUMsR0FBRyxHQUFHSixHQUFQLElBQWMxQixDQUFyQjtJQUNBTCxVQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBQ2tDLEdBQUcsR0FBR0UsR0FBUCxJQUFjL0IsQ0FBckI7SUFDQUwsVUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQUM4QixHQUFHLEdBQUdFLEdBQVAsSUFBYzNCLENBQXJCO0lBQ0E7SUFDRDs7SUFDRCxXQUFLLENBQUw7SUFBUTtJQUNOTCxVQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBQ2tDLEdBQUcsR0FBR0UsR0FBUCxJQUFjL0IsQ0FBckI7SUFDQUwsVUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQUNtQyxHQUFHLEdBQUdKLEdBQVAsSUFBYzFCLENBQXJCO0lBQ0FMLFVBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFDOEIsR0FBRyxHQUFHRSxHQUFQLElBQWMzQixDQUFyQjtJQUNBO0lBQ0Q7SUF4Qkg7O0lBOEJBLFdBQU8sSUFBSVEsVUFBSixDQUFlLElBQUl0RSxPQUFKLENBQVl5RCxDQUFDLENBQUMsQ0FBRCxDQUFiLEVBQWtCQSxDQUFDLENBQUMsQ0FBRCxDQUFuQixFQUF3QkEsQ0FBQyxDQUFDLENBQUQsQ0FBekIsQ0FBZixFQUE4Q0EsQ0FBQyxDQUFDLENBQUQsQ0FBL0MsRUFBb0R2QyxTQUFwRCxFQUFQO0lBQ0Q7O0lBRURBLEVBQUFBLFNBQVM7SUFDUCxVQUFNK0UsR0FBRyxHQUFHeEYsSUFBSSxDQUFDQyxJQUFMLENBQVUsS0FBS29ELENBQUwsQ0FBTzdELENBQVAsSUFBWSxDQUFaLEdBQWdCLEtBQUs2RCxDQUFMLENBQU81RCxDQUFQLElBQVksQ0FBNUIsR0FBZ0MsS0FBSzRELENBQUwsQ0FBTzNELENBQVAsSUFBWSxDQUE1QyxHQUFnRCxLQUFLdUIsQ0FBTCxJQUFVLENBQXBFLENBQVo7SUFDQSxXQUFPLElBQUk0QyxVQUFKLENBQ0wsSUFBSXRFLE9BQUosQ0FBWSxLQUFLOEQsQ0FBTCxDQUFPN0QsQ0FBUCxHQUFXZ0csR0FBdkIsRUFBNEIsS0FBS25DLENBQUwsQ0FBTzVELENBQVAsR0FBVytGLEdBQXZDLEVBQTRDLEtBQUtuQyxDQUFMLENBQU8zRCxDQUFQLEdBQVc4RixHQUF2RCxDQURLLEVBRUwsS0FBS3ZFLENBQUwsR0FBU3VFLEdBRkosQ0FBUDtJQUlEOzs7SUFHRGxGLEVBQUFBLFFBQVEsQ0FBQ0gsQ0FBRDtJQUNOLFFBQUlBLENBQUMsWUFBWTBELFVBQWpCLEVBQTZCO0lBQzNCLGFBQU8sSUFBSUEsVUFBSixDQUNMLEtBQUtSLENBQUwsQ0FBTzFDLEtBQVAsQ0FBYVIsQ0FBQyxDQUFDa0QsQ0FBZixFQUFrQmpELEdBQWxCLENBQXNCLEtBQUtpRCxDQUFMLENBQU8vQyxRQUFQLENBQWdCSCxDQUFDLENBQUNjLENBQWxCLENBQXRCLEVBQTRDYixHQUE1QyxDQUFnREQsQ0FBQyxDQUFDa0QsQ0FBRixDQUFJL0MsUUFBSixDQUFhLEtBQUtXLENBQWxCLENBQWhELENBREssRUFFTCxLQUFLQSxDQUFMLEdBQVNkLENBQUMsQ0FBQ2MsQ0FBWCxHQUFlLEtBQUtvQyxDQUFMLENBQU8zQyxHQUFQLENBQVdQLENBQUMsQ0FBQ2tELENBQWIsQ0FGVixDQUFQO0lBSUQ7O0lBQ0QsV0FBZ0IsS0FBS2pDLE1BQUwsR0FBY2QsUUFBZCxDQUF1QkgsQ0FBdkIsQ0FBaEI7SUFDRDs7SUFFTVMsRUFBQUEsS0FBSyxDQUFDVCxDQUFEO0lBQ1YsV0FBTyxLQUFLa0QsQ0FBTCxDQUFPekMsS0FBUCxDQUFhVCxDQUFDLENBQUNrRCxDQUFmLEtBQXFCLEtBQUtwQyxDQUFMLEtBQVdkLENBQUMsQ0FBQ2MsQ0FBekM7SUFDRDs7SUFFTUosRUFBQUEsSUFBSTtJQUNULFdBQU8sSUFBSWdELFVBQUosQ0FBZSxLQUFLUixDQUFMLENBQU94QyxJQUFQLEVBQWYsRUFBOEIsS0FBS0ksQ0FBbkMsQ0FBUDtJQUNEOzs7O0lDaEtIOzs7Ozs7O1VBTWF3RTtJQUNKQyxFQUFBQSxRQUFRO0lBRVJDLEVBQUFBLFFBQVE7SUFFUmpFLEVBQUFBLEtBQUs7SUFFWjs7Ozs7SUFJQXpGLEVBQUFBO0lBQ0UsU0FBS3lKLFFBQUwsR0FBZ0IsSUFBSTdCLFVBQUosRUFBaEI7SUFDQSxTQUFLOEIsUUFBTCxHQUFnQixJQUFJcEcsT0FBSixFQUFoQjtJQUNBLFNBQUttQyxLQUFMLEdBQWEsSUFBSW5DLE9BQUosQ0FBWSxDQUFaLEVBQWUsQ0FBZixFQUFrQixDQUFsQixDQUFiO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNVSxNQUFONkIsTUFBTTtJQUNSLFVBQU13RSxTQUFTLEdBQUcsSUFBSXpFLE9BQUosR0FBY1EsZUFBZCxDQUE4QixLQUFLZ0UsUUFBbkMsQ0FBbEI7SUFDQSxVQUFNakUsS0FBSyxHQUFHLElBQUlQLE9BQUosR0FBY00sV0FBZCxDQUEwQixLQUFLQyxLQUEvQixDQUFkO0lBQ0EsVUFBTWdFLFFBQVEsR0FBRyxLQUFLQSxRQUFMLENBQWN0RSxNQUFkLEVBQWpCO0lBRUEsV0FBT3dFLFNBQVMsQ0FBQ3RGLFFBQVYsQ0FBbUJvRixRQUFRLENBQUNwRixRQUFULENBQWtCb0IsS0FBbEIsQ0FBbkIsQ0FBUDtJQUNEOzs7O0lDREg7Ozs7Ozs7VUFNc0JtRTtJQUNWQyxFQUFBQSxTQUFTLEdBQWlCLElBQUkvRSxZQUFKLEVBQWpCO0lBRVRnRixFQUFBQSxlQUFlLEdBQXNCLElBQXRCO0lBRWZDLEVBQUFBLE9BQU8sR0FBaUIsSUFBSWpGLFlBQUosRUFBakI7SUFFUGtGLEVBQUFBLGFBQWEsR0FBc0IsSUFBdEI7SUFFYkMsRUFBQUEsU0FBUyxHQUFpQixJQUFJbkYsWUFBSixFQUFqQjtJQUVUb0YsRUFBQUEsZUFBZSxHQUFzQixJQUF0QjtJQUVmQyxFQUFBQSxTQUFTLEdBQWUsSUFBSUMsVUFBSixFQUFmO0lBRVRDLEVBQUFBLGVBQWUsR0FBc0IsSUFBdEI7SUFFZkMsRUFBQUEsWUFBWSxHQUFnQjtJQUFFQyxJQUFBQSxHQUFHLEVBQUUsSUFBSWpILE9BQUosRUFBUDtJQUFzQmtILElBQUFBLEdBQUcsRUFBRSxJQUFJbEgsT0FBSjtJQUEzQixHQUFoQjtJQUVabUgsRUFBQUEsT0FBTyxHQUFZLElBQUl2RixPQUFKLEVBQVo7SUFFUHdGLEVBQUFBLGFBQWEsR0FBc0IsSUFBdEI7SUFFYkMsRUFBQUEsVUFBVSxHQUFjLElBQUluQixTQUFKLEVBQWQ7SUFFVm9CLEVBQUFBLFNBQVM7O0lBRW5CNUssRUFBQUEsWUFBWVc7SUFDVixTQUFLaUssU0FBTCxHQUFpQmpLLFFBQWpCO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNVWtLLEVBQUFBLGlCQUFpQjtJQUN6QixVQUFNTCxHQUFHLEdBQUcsSUFBSWxILE9BQUosRUFBWjtJQUNBLFVBQU1pSCxHQUFHLEdBQUcsSUFBSWpILE9BQUosRUFBWjs7SUFDQSxTQUFLLElBQUlSLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsS0FBSytHLFNBQUwsQ0FBZTNJLE1BQW5DLEVBQTJDNEIsQ0FBQyxJQUFJLENBQWhELEVBQW1EO0lBQ2pELFlBQU1nSSxHQUFHLEdBQUcsSUFBSS9GLE9BQUosQ0FDVixLQUFLOEUsU0FBTCxDQUFlL0csQ0FBQyxHQUFHLENBQW5CLENBRFUsRUFFVixLQUFLK0csU0FBTCxDQUFlL0csQ0FBQyxHQUFHLENBQW5CLENBRlUsRUFHVixLQUFLK0csU0FBTCxDQUFlL0csQ0FBQyxHQUFHLENBQW5CLENBSFUsRUFJVixHQUpVLENBQVo7SUFPQTBILE1BQUFBLEdBQUcsQ0FBQzNHLEdBQUosQ0FBUUUsSUFBSSxDQUFDeUcsR0FBTCxDQUFTQSxHQUFHLENBQUNqSCxDQUFiLEVBQWdCdUgsR0FBRyxDQUFDdkgsQ0FBcEIsQ0FBUixFQUFnQ1EsSUFBSSxDQUFDeUcsR0FBTCxDQUFTQSxHQUFHLENBQUNoSCxDQUFiLEVBQWdCc0gsR0FBRyxDQUFDdEgsQ0FBcEIsQ0FBaEMsRUFBd0RPLElBQUksQ0FBQ3lHLEdBQUwsQ0FBU0EsR0FBRyxDQUFDL0csQ0FBYixFQUFnQnFILEdBQUcsQ0FBQ3JILENBQXBCLENBQXhEO0lBQ0E4RyxNQUFBQSxHQUFHLENBQUMxRyxHQUFKLENBQVFFLElBQUksQ0FBQ3dHLEdBQUwsQ0FBU0EsR0FBRyxDQUFDaEgsQ0FBYixFQUFnQnVILEdBQUcsQ0FBQ3ZILENBQXBCLENBQVIsRUFBZ0NRLElBQUksQ0FBQ3dHLEdBQUwsQ0FBU0EsR0FBRyxDQUFDL0csQ0FBYixFQUFnQnNILEdBQUcsQ0FBQ3RILENBQXBCLENBQWhDLEVBQXdETyxJQUFJLENBQUN3RyxHQUFMLENBQVNBLEdBQUcsQ0FBQzlHLENBQWIsRUFBZ0JxSCxHQUFHLENBQUNySCxDQUFwQixDQUF4RDtJQUNEOztJQUNELFNBQUs2RyxZQUFMLENBQWtCQyxHQUFsQixHQUF3QkEsR0FBeEI7SUFDQSxTQUFLRCxZQUFMLENBQWtCRSxHQUFsQixHQUF3QkEsR0FBeEI7SUFDRDtJQUVEOzs7Ozs7OztJQU1hLE1BQVRPLFNBQVM7SUFDWCxXQUFPLEtBQUtKLFVBQVo7SUFDRDtJQUVEOzs7Ozs7Ozs7SUFPWSxNQUFSakIsUUFBUTtJQUNWLFdBQU8sS0FBS0csU0FBWjtJQUNEO0lBRUQ7Ozs7Ozs7OztJQU9VLE1BQU5tQixNQUFNO0lBQ1IsV0FBTyxLQUFLakIsT0FBWjtJQUNEO0lBRUQ7Ozs7Ozs7OztJQU9ZLE1BQVJrQixRQUFRO0lBQ1YsV0FBTyxLQUFLaEIsU0FBWjtJQUNEO0lBRUQ7Ozs7Ozs7OztJQU9ZLE1BQVJpQixRQUFRO0lBQ1YsV0FBTyxLQUFLZixTQUFaO0lBQ0Q7SUFFRDs7Ozs7Ozs7O0lBT1UsTUFBTmhGLE1BQU07SUFDUixXQUFPLEtBQUt3RixVQUFMLENBQWdCeEYsTUFBaEIsQ0FBdUJkLFFBQXZCLENBQWdDLEtBQUtvRyxPQUFyQyxDQUFQO0lBQ0Q7O0lBRVcsTUFBUjlKLFFBQVE7SUFDVixXQUFPLEtBQUtpSyxTQUFaO0lBQ0Q7OztJQUdpQixNQUFkM0osY0FBYztJQUFLLFdBQU8sS0FBSzZJLGVBQVo7SUFBNkI7O0lBRXBDLE1BQVoxSSxZQUFZO0lBQUssV0FBTyxLQUFLNEksYUFBWjtJQUEyQjs7SUFFOUIsTUFBZDNJLGNBQWM7SUFBSyxXQUFPLEtBQUs2SSxlQUFaO0lBQTZCOztJQUVsQyxNQUFkL0ksY0FBYztJQUFLLFdBQU8sS0FBS2tKLGVBQVo7SUFBNkI7O0lBRXBDLE1BQVovSSxZQUFZO0lBQUssV0FBTyxLQUFLb0osYUFBWjtJQUEyQjs7SUFFaERqSyxFQUFBQSxhQUFhLENBQUMwSyxPQUFELEVBQXVCM0osTUFBdkI7SUFDWCxRQUFHLENBQUMsS0FBS3NJLGVBQVQsRUFBMEIsS0FBS0EsZUFBTCxHQUF1QnFCLE9BQU8sQ0FBQ2hKLFlBQVIsQ0FBcUIsT0FBckIsRUFBOEIsS0FBSzBILFNBQUwsQ0FBZTNJLE1BQTdDLENBQXZCO0lBQzFCLFFBQUcsQ0FBQyxLQUFLOEksYUFBVCxFQUF3QixLQUFLQSxhQUFMLEdBQXFCbUIsT0FBTyxDQUFDaEosWUFBUixDQUFxQixPQUFyQixFQUE4QixLQUFLNEgsT0FBTCxDQUFhN0ksTUFBM0MsQ0FBckI7SUFDeEIsUUFBRyxDQUFDLEtBQUtnSixlQUFULEVBQTBCLEtBQUtBLGVBQUwsR0FBdUJpQixPQUFPLENBQUNoSixZQUFSLENBQXFCLE9BQXJCLEVBQThCLEtBQUs4SCxTQUFMLENBQWUvSSxNQUE3QyxDQUF2QjtJQUMxQixRQUFHLENBQUMsS0FBS21KLGVBQVQsRUFBMEIsS0FBS0EsZUFBTCxHQUF1QmMsT0FBTyxDQUFDaEosWUFBUixDQUFxQixLQUFyQixFQUE0QixLQUFLZ0ksU0FBTCxDQUFlakosTUFBM0MsQ0FBdkI7SUFDMUIsUUFBRyxDQUFDLEtBQUt3SixhQUFULEVBQXdCLEtBQUtBLGFBQUwsR0FBcUJTLE9BQU8sQ0FBQ2hKLFlBQVIsQ0FBcUIsT0FBckIsRUFBOEIsS0FBS3NJLE9BQUwsQ0FBYXRGLE1BQWIsQ0FBb0JqRSxNQUFwQixHQUE2QixDQUEzRCxDQUFyQjs7SUFFeEIsU0FBSzRJLGVBQUwsQ0FBcUIxSCxRQUFyQixDQUE4QixLQUFLeUgsU0FBbkM7O0lBQ0EsU0FBS0csYUFBTCxDQUFtQjVILFFBQW5CLENBQTRCLEtBQUsySCxPQUFqQzs7SUFDQSxTQUFLRyxlQUFMLENBQXFCOUgsUUFBckIsQ0FBOEIsS0FBSzZILFNBQW5DOztJQUNBLFNBQUtJLGVBQUwsQ0FBcUJqSSxRQUFyQixDQUE4QixLQUFLK0gsU0FBbkM7O0lBRUEsVUFBTTtJQUFDaEYsTUFBQUE7SUFBRCxRQUFXLElBQWpCOztJQUNBLFNBQUt1RixhQUFMLENBQW1CdEksUUFBbkIsQ0FBNEIrQyxNQUFNLENBQUNBLE1BQVAsQ0FBY2lHLE1BQWQsQ0FBcUJqRyxNQUFNLENBQUNjLE9BQVAsR0FBaUJkLE1BQXRDLENBQTVCOztJQUVBLFNBQUt5RixTQUFMLENBQWVuSyxhQUFmLENBQTZCMEssT0FBN0IsRUFBc0MzSixNQUF0QztJQUNEOztJQUVEVSxFQUFBQSxPQUFPO0lBQ0wsUUFBRyxLQUFLNEgsZUFBUixFQUF5QjtJQUN2QixXQUFLQSxlQUFMLENBQXFCNUgsT0FBckI7O0lBQ0EsV0FBSzRILGVBQUwsR0FBdUIsSUFBdkI7SUFDRDs7SUFDRCxRQUFHLEtBQUtFLGFBQVIsRUFBd0I7SUFDdEIsV0FBS0EsYUFBTCxDQUFtQjlILE9BQW5COztJQUNBLFdBQUs4SCxhQUFMLEdBQXFCLElBQXJCO0lBQ0Q7O0lBQ0QsUUFBRyxLQUFLRSxlQUFSLEVBQTBCO0lBQ3hCLFdBQUtBLGVBQUwsQ0FBcUJoSSxPQUFyQjs7SUFDQSxXQUFLZ0ksZUFBTCxHQUF1QixJQUF2QjtJQUNEOztJQUNELFFBQUcsS0FBS0csZUFBUixFQUEwQjtJQUN4QixXQUFLQSxlQUFMLENBQXFCbkksT0FBckI7O0lBQ0EsV0FBS21JLGVBQUwsR0FBdUIsSUFBdkI7SUFDRDs7SUFFRCxTQUFLTyxTQUFMLENBQWUxSSxPQUFmO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNZSxNQUFYbUosV0FBVztJQUNiLFdBQU8sS0FBS2YsWUFBWjtJQUNEOzs7O0lDNU5IOzs7Ozs7O1VBTWFnQixtQkFBbUIxQjtJQUN0QjJCLEVBQUFBLE9BQU8sR0FBb0IsSUFBcEI7SUFFZjs7Ozs7OztJQU1pQixRQUFKQyxJQUFJLENBQUNDLEdBQUQ7SUFDZixVQUFNQyxRQUFRLEdBQUcsTUFBTUMsS0FBSyxDQUFDRixHQUFELENBQTVCO0lBQ0EsUUFBSUMsUUFBUSxDQUFDRSxPQUFULENBQWlCN0ksR0FBakIsQ0FBcUIsY0FBckIsTUFBeUMsaUJBQTdDLEVBQ0UsTUFBTXlFLEtBQUssaUJBQWlCa0UsUUFBUSxDQUFDRSxPQUFULENBQWlCN0ksR0FBakIsQ0FBcUIsY0FBckIseUJBQWpCLENBQVg7SUFDRixTQUFLd0ksT0FBTCxHQUFlLE1BQU1HLFFBQVEsQ0FBQ0csSUFBVCxFQUFyQjtJQUNBLFVBQU0sS0FBS0MsT0FBTCxFQUFOO0lBQ0Q7SUFFRDs7Ozs7Ozs7O0lBT3FCLFFBQVBBLE9BQU87SUFDbkIsUUFBSSxDQUFDLEtBQUtQLE9BQVYsRUFBbUI7O0lBRW5CLFVBQU07SUFBRVEsTUFBQUEsS0FBRjtJQUFTQyxNQUFBQSxNQUFUO0lBQWlCQyxNQUFBQSxTQUFqQjtJQUE0QkMsTUFBQUEsV0FBNUI7SUFBeUNDLE1BQUFBO0lBQXpDLFFBQXFELEtBQUtaLE9BQWhFO0lBRUEsUUFDRSxDQUFDYSxLQUFLLENBQUNDLE9BQU4sQ0FBY04sS0FBZCxDQUFELElBQ0EsQ0FBQ0ssS0FBSyxDQUFDQyxPQUFOLENBQWNMLE1BQWQsQ0FERCxJQUVBLENBQUNJLEtBQUssQ0FBQ0MsT0FBTixDQUFjSixTQUFkLENBRkQsSUFHQSxDQUFDRyxLQUFLLENBQUNDLE9BQU4sQ0FBY0gsV0FBZCxDQUhELElBSUEsQ0FBQ0UsS0FBSyxDQUFDQyxPQUFOLENBQWNGLE9BQWQsQ0FMSCxFQU9FLE1BQU0sSUFBSTNFLEtBQUosQ0FBVSxnQ0FBVixDQUFOO0lBRUYsVUFBTSxDQUFDOEUsSUFBRCxJQUFTUCxLQUFmO0lBQ0EsVUFBTTtJQUFDUSxNQUFBQSxVQUFVLEVBQUUsQ0FBQ0MsU0FBRDtJQUFiLFFBQTRCUixNQUFNLENBQUMsQ0FBRCxDQUF4QztJQUNBLFVBQU1TLE1BQU0sR0FBR1AsV0FBVyxDQUFDTSxTQUFTLENBQUNFLFVBQVYsQ0FBcUJDLFFBQXRCLENBQTFCO0lBQ0EsVUFBTUMsT0FBTyxHQUFHVixXQUFXLENBQUNNLFNBQVMsQ0FBQ0UsVUFBVixDQUFxQkcsTUFBdEIsQ0FBM0I7SUFDQSxVQUFNQyxNQUFNLEdBQUdaLFdBQVcsQ0FBQ00sU0FBUyxDQUFDRSxVQUFWLENBQXFCSyxVQUF0QixDQUExQjtJQUNBLFVBQU1DLE1BQU0sR0FBR2QsV0FBVyxDQUFDTSxTQUFTLENBQUNTLE9BQVgsQ0FBMUI7O0lBR0EsVUFBTSxDQUFDO0lBQUVDLE1BQUFBO0lBQUYsS0FBRCxJQUFZZixPQUFsQjs7SUFHQUcsSUFBQUEsSUFBSSxDQUFDYSxXQUFMLEdBQW1CYixJQUFJLENBQUNhLFdBQUwsSUFBb0IsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FBdkM7SUFDQWIsSUFBQUEsSUFBSSxDQUFDN0MsUUFBTCxHQUFnQjZDLElBQUksQ0FBQzdDLFFBQUwsSUFBaUIsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLENBQWpDO0lBQ0E2QyxJQUFBQSxJQUFJLENBQUM3RyxLQUFMLEdBQWE2RyxJQUFJLENBQUM3RyxLQUFMLElBQWMsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsQ0FBM0I7SUFFQSxVQUFNa0UsU0FBUyxHQUFHLElBQUl6RSxPQUFKLEdBQWNRLGVBQWQsQ0FDaEIsSUFBSXBDLE9BQUosQ0FBWWdKLElBQUksQ0FBQ2EsV0FBTCxDQUFpQixDQUFqQixDQUFaLEVBQWlDYixJQUFJLENBQUNhLFdBQUwsQ0FBaUIsQ0FBakIsQ0FBakMsRUFBc0RiLElBQUksQ0FBQ2EsV0FBTCxDQUFpQixDQUFqQixDQUF0RCxDQURnQixDQUFsQjtJQUdBLFVBQU0xSCxLQUFLLEdBQUcsSUFBSVAsT0FBSixHQUFjTSxXQUFkLENBQ1osSUFBSWxDLE9BQUosQ0FBWWdKLElBQUksQ0FBQzdHLEtBQUwsQ0FBVyxDQUFYLENBQVosRUFBMkI2RyxJQUFJLENBQUM3RyxLQUFMLENBQVcsQ0FBWCxDQUEzQixFQUEwQzZHLElBQUksQ0FBQzdHLEtBQUwsQ0FBVyxDQUFYLENBQTFDLENBRFksQ0FBZDtJQUdBLFVBQU1nRSxRQUFRLEdBQUcsSUFBSTdCLFVBQUosQ0FDZixJQUFJdEUsT0FBSixDQUFZZ0osSUFBSSxDQUFDN0MsUUFBTCxDQUFjLENBQWQsQ0FBWixFQUE4QjZDLElBQUksQ0FBQzdDLFFBQUwsQ0FBYyxDQUFkLENBQTlCLEVBQWdENkMsSUFBSSxDQUFDN0MsUUFBTCxDQUFjLENBQWQsQ0FBaEQsQ0FEZSxFQUVmNkMsSUFBSSxDQUFDN0MsUUFBTCxDQUFjLENBQWQsQ0FGZSxFQUdmdEUsTUFIZSxFQUFqQjtJQUtBLFNBQUtzRixPQUFMLEdBQWVkLFNBQVMsQ0FBQ3RGLFFBQVYsQ0FBbUJvRixRQUFRLENBQUNwRixRQUFULENBQWtCb0IsS0FBbEIsQ0FBbkIsQ0FBZjs7SUFHQSxVQUFNaUcsUUFBUSxHQUFHLE1BQU1DLEtBQUssQ0FBQ3VCLEdBQUQsQ0FBNUI7SUFDQSxVQUFNcE0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNNEssUUFBUSxDQUFDMEIsSUFBVCxFQUFQLEVBQXdCQyxXQUF4QixFQUFyQjs7SUFHQSxTQUFLeEQsU0FBTCxHQUFpQixJQUFJL0UsWUFBSixDQUFpQmhFLE1BQWpCLEVBQXlCMkwsTUFBTSxDQUFDYSxVQUFoQyxFQUE0Q2IsTUFBTSxDQUFDYyxVQUFQLEdBQW9CLENBQWhFLENBQWpCO0lBQ0EsU0FBSzFDLGlCQUFMO0lBRUEsU0FBS2QsT0FBTCxHQUFlLElBQUlqRixZQUFKLENBQWlCaEUsTUFBakIsRUFBeUI4TCxPQUFPLENBQUNVLFVBQWpDLEVBQTZDVixPQUFPLENBQUNXLFVBQVIsR0FBcUIsQ0FBbEUsQ0FBZjtJQUVBLFNBQUt0RCxTQUFMLEdBQWlCLElBQUluRixZQUFKLENBQWlCaEUsTUFBakIsRUFBeUJnTSxNQUFNLENBQUNRLFVBQWhDLEVBQTRDUixNQUFNLENBQUNTLFVBQVAsR0FBb0IsQ0FBaEUsQ0FBakI7SUFFQSxTQUFLcEQsU0FBTCxHQUFpQkMsVUFBVSxDQUFDb0QsSUFBWCxDQUNmLElBQUlDLFVBQUosQ0FBZTNNLE1BQWYsRUFBdUJrTSxNQUFNLENBQUNNLFVBQTlCLEVBQXlDTixNQUFNLENBQUNPLFVBQVAsR0FBb0IsQ0FBN0QsQ0FEZSxDQUFqQjtJQUdEOzs7O1VDekZVRyx1QkFBdUIsR0FBRztVQUVqQkM7SUFFWkMsRUFBQUEsZUFBZSxHQUFzQixJQUF0QjtJQUVoQmxOLEVBQUFBLE9BQU8sR0FBbUIsSUFBbkI7O0lBRUosTUFBTkksTUFBTTtJQUNSLFdBQU8sS0FBSzhNLGVBQVo7SUFDRDs7O0lBS0RuTixFQUFBQSxhQUFhLENBQUMwSyxPQUFELEVBQXVCM0osTUFBdkI7OztJQUNYLFFBQUcsQ0FBQyxLQUFLb00sZUFBVCxFQUEwQixLQUFLQSxlQUFMLEdBQXVCekMsT0FBTyxDQUFDaEosWUFBUixDQUFxQixPQUFyQixFQUE4QnVMLHVCQUE5QixDQUF2QjtJQUUxQixrQ0FBS0UsZUFBTCxnRkFBc0J4TCxRQUF0QixDQUNFLEtBQUt5TCxpQkFBTCxFQURGO0lBR0Q7O0lBRUQzTCxFQUFBQSxPQUFPOzs7SUFDTCxtQ0FBSzBMLGVBQUwsa0ZBQXNCMUwsT0FBdEI7SUFDQSxTQUFLMEwsZUFBTCxHQUF1QixJQUF2QjtJQUNEOzs7O1VDdEJVRSxjQUFjSDtJQUNqQkksRUFBQUEsSUFBSTs7SUFFWi9OLEVBQUFBLFlBQVlnTztJQUNWO0lBQ0EsU0FBS0QsSUFBTCxHQUFZQyxHQUFaO0lBQ0Q7O0lBRURILEVBQUFBLGlCQUFpQjtJQUNmLFdBQU8sQ0FDTCxDQURLLEVBRUwsS0FBS0UsSUFGQSxDQUFQO0lBSUQ7Ozs7VUNSVUUsZ0JBQWdCTjtJQUNuQk8sRUFBQUEsS0FBSzs7SUFFYmxPLEVBQUFBLFlBQVlrTyxRQUFpQixJQUFJNUssT0FBSixDQUFZLEdBQVosR0FBa0I1QyxVQUEwQjtJQUN2RTtJQUNBLFNBQUt3TixLQUFMLEdBQWFBLEtBQWI7SUFDQSxTQUFLeE4sT0FBTCxHQUFlQSxPQUFmO0lBQ0Q7O0lBRURtTixFQUFBQSxpQkFBaUI7SUFDZixXQUFPLENBQ0wsQ0FESyxFQUVMLEtBQUtuTixPQUFMLEdBQWUsS0FBS0EsT0FBTCxDQUFhRyxFQUE1QixHQUFpQyxDQUFDLENBRjdCLEVBR0wsS0FBS3FOLEtBQUwsQ0FBVzNLLENBSE4sRUFJTCxLQUFLMkssS0FBTCxDQUFXMUssQ0FKTixFQUtMLEtBQUswSyxLQUFMLENBQVd6SyxDQUxOLENBQVA7SUFPRDs7SUFFRGhELEVBQUFBLGFBQWEsQ0FBQzBLLE9BQUQsRUFBdUIzSixNQUF2Qjs7O0lBQ1gsMEJBQUtkLE9BQUwsZ0VBQWN5QixZQUFkLENBQTJCZ0osT0FBM0IsRUFBb0MzSixNQUFwQztJQUNBLFVBQU1mLGFBQU4sQ0FBb0IwSyxPQUFwQixFQUE2QjNKLE1BQTdCO0lBQ0Q7Ozs7VUNqQ1UyTTtJQUNIQyxFQUFBQSxJQUFJO0lBRUpDLEVBQUFBLFFBQVE7SUFFUkMsRUFBQUEsSUFBSTtJQUVKQyxFQUFBQSxNQUFNO0lBRU5DLEVBQUFBLEtBQUs7O0lBRWJ4TyxFQUFBQSxZQUFZeU87SUFDVixTQUFLTCxJQUFMLEdBQVksSUFBSTlLLE9BQUosQ0FBWSxHQUFaLEVBQWlCLEdBQWpCLEVBQXNCLEdBQXRCLENBQVo7SUFDQSxTQUFLK0ssUUFBTCxHQUFnQixJQUFJL0ssT0FBSixDQUFZLEdBQVosRUFBaUIsR0FBakIsRUFBc0IsR0FBdEIsQ0FBaEI7SUFDQSxTQUFLZ0wsSUFBTCxHQUFZLElBQUloTCxPQUFKLENBQVksR0FBWixFQUFpQixHQUFqQixFQUFzQixHQUF0QixDQUFaO0lBQ0EsU0FBS2lMLE1BQUwsR0FBYyxJQUFJakwsT0FBSixDQUFZLEdBQVosRUFBaUIsR0FBakIsRUFBc0IsR0FBdEIsQ0FBZDtJQUNBLFNBQUtrTCxLQUFMLEdBQWEsTUFBTXpLLElBQUksQ0FBQzJLLEdBQUwsQ0FBU0QsU0FBUyxHQUFHLENBQXJCLENBQW5CO0lBQ0Q7O0lBRU0sTUFBSDNELEdBQUc7SUFDTCxXQUFPLEtBQUtzRCxJQUFaO0lBQ0Q7O0lBRU0sTUFBSHRELEdBQUcsQ0FBQ0EsR0FBRDtJQUNMLFNBQUtzRCxJQUFMLEdBQVl0RCxHQUFaO0lBQ0Q7O0lBRVUsTUFBUDZELE9BQU87SUFDVCxXQUFPLEtBQUtOLFFBQVo7SUFDRDs7SUFFVSxNQUFQTSxPQUFPLENBQUNBLE9BQUQ7SUFDVCxTQUFLTixRQUFMLEdBQWdCTSxPQUFPLENBQUNuSyxTQUFSLEVBQWhCOztJQUNBLFVBQU1vSyxLQUFLLEdBQUcsS0FBS1AsUUFBTCxDQUFjM0osS0FBZCxDQUFvQixLQUFLNEosSUFBekIsQ0FBZDs7SUFDQSxTQUFLQSxJQUFMLEdBQVlNLEtBQUssQ0FBQ2xLLEtBQU4sQ0FBWSxLQUFLMkosUUFBakIsRUFBMkI3SixTQUEzQixFQUFaO0lBQ0Q7O0lBRU0sTUFBSHFLLEdBQUc7SUFDTCxXQUFPLEtBQUtQLElBQVo7SUFDRDs7SUFFTSxNQUFITyxHQUFHLENBQUNBLEdBQUQ7SUFDTCxTQUFLUCxJQUFMLEdBQVlPLEdBQUcsQ0FBQ3JLLFNBQUosRUFBWjs7SUFDQSxVQUFNb0ssS0FBSyxHQUFHLEtBQUtQLFFBQUwsQ0FBYzNKLEtBQWQsQ0FBb0IsS0FBSzRKLElBQXpCLENBQWQ7O0lBQ0EsU0FBS0QsUUFBTCxHQUFnQixLQUFLQyxJQUFMLENBQVU1SixLQUFWLENBQWdCa0ssS0FBaEIsRUFBdUJwSyxTQUF2QixFQUFoQjtJQUNEOztJQUVPLE1BQUpzSyxJQUFJO0lBQ04sV0FBTyxLQUFLTixLQUFaO0lBQ0Q7O0lBRU8sTUFBSk0sSUFBSSxDQUFDQSxJQUFEO0lBQ04sU0FBS04sS0FBTCxHQUFhTSxJQUFiO0lBQ0Q7O0lBRVksTUFBVEwsU0FBUztJQUNYLFdBQU8sSUFBSTFLLElBQUksQ0FBQ2dMLElBQUwsQ0FBVSxNQUFNLEtBQUtQLEtBQXJCLENBQVg7SUFDRDs7SUFFWSxNQUFUQyxTQUFTLENBQUNBLFNBQUQ7SUFDWCxTQUFLRCxLQUFMLEdBQWEsTUFBTXpLLElBQUksQ0FBQzJLLEdBQUwsQ0FBU0QsU0FBUyxHQUFHLENBQXJCLENBQW5CO0lBQ0Q7O0lBRU1PLEVBQUFBLE1BQU0sQ0FBQ0MsRUFBRDtJQUNYLFFBQUlBLEVBQUUsQ0FBQ3RLLEtBQUgsQ0FBUyxLQUFLeUosSUFBZCxDQUFKLEVBQXlCO0lBQ3ZCLFdBQUtDLFFBQUwsR0FBZ0IsSUFBSS9LLE9BQUosQ0FBWSxDQUFaLEVBQWUsQ0FBZixFQUFrQixDQUFsQixDQUFoQjtJQUNELEtBRkQsTUFFTztJQUNMLFdBQUsrSyxRQUFMLEdBQWdCWSxFQUFFLENBQUM3SyxRQUFILENBQVksS0FBS2dLLElBQWpCLEVBQXVCNUosU0FBdkIsRUFBaEI7SUFDRDs7SUFDRCxTQUFLK0osTUFBTCxHQUFjLEtBQUtGLFFBQUwsQ0FBYzNKLEtBQWQsQ0FBb0IsSUFBSXBCLE9BQUosQ0FBWSxDQUFaLEVBQWUsQ0FBZixFQUFrQixDQUFsQixDQUFwQixFQUEwQ2tCLFNBQTFDLEVBQWQ7O0lBQ0EsUUFBSSxLQUFLK0osTUFBTCxDQUFZck4sTUFBWixPQUF5QixDQUE3QixFQUFnQztJQUM5QixXQUFLcU4sTUFBTCxHQUFjLElBQUlqTCxPQUFKLENBQVksQ0FBWixFQUFlLENBQWYsRUFBa0IsQ0FBbEIsQ0FBZDtJQUNEOztJQUNELFNBQUtnTCxJQUFMLEdBQVksS0FBS0MsTUFBTCxDQUFZN0osS0FBWixDQUFrQixLQUFLMkosUUFBdkIsRUFBaUM3SixTQUFqQyxFQUFaO0lBQ0Q7O0lBRU1uQyxFQUFBQSxXQUFXO0lBQ2hCLFdBQU8sQ0FDTCxLQUFLK0wsSUFBTCxDQUFVN0ssQ0FETCxFQUVMLEtBQUs2SyxJQUFMLENBQVU1SyxDQUZMLEVBR0wsS0FBSzRLLElBQUwsQ0FBVTNLLENBSEwsRUFJTCxLQUFLNEssUUFBTCxDQUFjOUssQ0FKVCxFQUtMLEtBQUs4SyxRQUFMLENBQWM3SyxDQUxULEVBTUwsS0FBSzZLLFFBQUwsQ0FBYzVLLENBTlQsRUFPTCxLQUFLNkssSUFBTCxDQUFVL0ssQ0FQTCxFQVFMLEtBQUsrSyxJQUFMLENBQVU5SyxDQVJMLEVBU0wsS0FBSzhLLElBQUwsQ0FBVTdLLENBVEwsRUFVTCxLQUFLOEssTUFBTCxDQUFZaEwsQ0FWUCxFQVdMLEtBQUtnTCxNQUFMLENBQVkvSyxDQVhQLEVBWUwsS0FBSytLLE1BQUwsQ0FBWTlLLENBWlAsRUFhTCxLQUFLK0ssS0FiQSxDQUFQO0lBZUQ7Ozs7SUMzRkgsTUFBTVUsVUFBVSxHQUFHLElBQW5CO1VBRWFDO0lBQ0hDLEVBQUFBLEtBQUs7SUFFTEMsRUFBQUEsV0FBVztJQUVYQyxFQUFBQSxVQUFVLEdBQTZCLElBQTdCO0lBRVZDLEVBQUFBLEtBQUssR0FBWSxLQUFaO0lBRUxDLEVBQUFBLE9BQU8sR0FBc0IsSUFBdEI7SUFFUjNPLEVBQUFBLEVBQUUsR0FBVyxDQUFDLENBQVo7O0lBRUMsTUFBTkMsTUFBTTtJQUNSLFdBQU8sS0FBSzBPLE9BQVo7SUFDRDs7SUFFRHhQLEVBQUFBLFlBQVlvUDtJQUNWLFNBQUtBLEtBQUwsR0FBYUEsS0FBSyxJQUFJLElBQXRCO0lBQ0EsU0FBS0MsV0FBTCxHQUFtQixJQUFuQjtJQUNEOztJQUVPSSxFQUFBQSxnQkFBZ0IsQ0FBQ2pPLE1BQUQ7SUFDdEIsVUFBTUUsR0FBRyxHQUFHRixNQUFNLENBQUNHLFVBQVAsQ0FBa0IsSUFBbEIsQ0FBWjs7SUFDQSxRQUFHLENBQUNELEdBQUosRUFBUztJQUNQRSxNQUFBQSxPQUFPLENBQUNDLEtBQVIsQ0FBYyx3QkFBZDtJQUNBO0lBQ0Q7O0lBRUQsUUFBRyxLQUFLdU4sS0FBUixFQUFlMU4sR0FBRyxDQUFDZ08sU0FBSixDQUFjLEtBQUtOLEtBQW5CLEVBQTBCLENBQTFCLEVBQTZCLENBQTdCLEVBQWdDRixVQUFoQyxFQUE0Q0EsVUFBNUM7SUFDZixTQUFLSSxVQUFMLEdBQWtCNU4sR0FBRyxDQUFDaU8sWUFBSixDQUFpQixDQUFqQixFQUFvQixDQUFwQixFQUF1QlQsVUFBdkIsRUFBbUNBLFVBQW5DLEVBQStDak4sSUFBakU7SUFDQSxTQUFLc04sS0FBTCxHQUFhLElBQWI7SUFDRDs7SUFFRHBOLEVBQUFBLFlBQVksQ0FBQ3lOLElBQUQsRUFBb0JwTyxNQUFwQjtJQUNWLFFBQUcsS0FBSzZOLFdBQVIsRUFBcUIsS0FBS0ksZ0JBQUwsQ0FBc0JqTyxNQUF0QjtJQUNyQixRQUFJLEtBQUtnTyxPQUFULEVBQWtCO0lBQ2xCLFNBQUtBLE9BQUwsR0FBZUksSUFBSSxDQUFDek4sWUFBTCxDQUFrQixLQUFsQixFQUF5QitNLFVBQVUsR0FBR0EsVUFBYixHQUEwQixDQUFuRCxDQUFmOztJQUVBLFNBQUtNLE9BQUwsQ0FBYXBOLFFBQWIsQ0FBc0IsS0FBS2tOLFVBQTNCO0lBQ0Q7O0lBRUQxTyxFQUFBQSxPQUFPO0lBQ0wsV0FBTyxLQUFLMk8sS0FBWjtJQUNEOztJQUVEck4sRUFBQUEsT0FBTzs7O0lBQ0wsMEJBQUtzTixPQUFMLGdFQUFjdE4sT0FBZDtJQUNEOzs7O1VDckRVMk4sZUFBZSxHQUFHLE1BQU9wRSxHQUFQO0lBQzdCLFFBQU1xRSxhQUFhLEdBQUcsTUFBTW5FLEtBQUssQ0FBQ0YsR0FBRCxDQUFqQztJQUNBLFFBQU1zRSxTQUFTLEdBQUcsTUFBTUQsYUFBYSxDQUFDMUMsSUFBZCxFQUF4QjtJQUNBLFNBQU80QyxpQkFBaUIsQ0FBQ0QsU0FBRCxDQUF4QjtJQUNEOztJQ0REOzs7Ozs7VUFNYUU7SUFDREMsRUFBQUEsT0FBTztJQUVQQyxFQUFBQSxLQUFLO0lBRUxDLEVBQUFBLEtBQUssR0FBeUIsSUFBekI7SUFFTEMsRUFBQUEsT0FBTyxHQUFXLENBQUMsQ0FBWjtJQUVQQyxFQUFBQSxPQUFPLEdBQVcsQ0FBWDs7SUFFUCxNQUFOcFAsTUFBTTtJQUNSLFdBQU8sS0FBS29QLE9BQVo7SUFDRDs7SUFFTyxNQUFKQyxJQUFJO0lBQ04sV0FBTyxLQUFLSCxLQUFaO0lBQ0Q7SUFFRDs7Ozs7Ozs7O0lBT0FwUSxFQUFBQSxZQUFZd1EsUUFBb0JELE1BQXFCRTtJQUNuRCxRQUFJRixJQUFJLEtBQUssS0FBYixFQUFvQixLQUFLRixPQUFMLEdBQWUsQ0FBZixDQUFwQixLQUNLLElBQUlFLElBQUksS0FBSyxLQUFiLEVBQW9CLEtBQUtGLE9BQUwsR0FBZSxDQUFmLENBQXBCLEtBQ0EsSUFBSUUsSUFBSSxLQUFLLE9BQWIsRUFBc0IsS0FBS0YsT0FBTCxHQUFlLENBQWYsQ0FBdEIsS0FDQSxJQUFJRSxJQUFJLEtBQUssUUFBYixFQUF1QixLQUFLRixPQUFMLEdBQWUsQ0FBZixDQUF2QixLQUNBLE1BQU03SSxLQUFLLENBQUMscUJBQUQsQ0FBWDtJQUVMLFNBQUs0SSxLQUFMLEdBQWFHLElBQWI7SUFFQSxTQUFLTCxPQUFMLEdBQWVNLE1BQWY7SUFFQSxTQUFLRixPQUFMLEdBQWVHLElBQWY7SUFFQSxTQUFLTixLQUFMLEdBQWEsS0FBS0QsT0FBTCxDQUFhUSxPQUFiLENBQXFCLEtBQUtMLE9BQUwsR0FBZUksSUFBcEMsQ0FBYjtJQUNEO0lBRUQ7Ozs7Ozs7OztJQU9PMU4sRUFBQUEsR0FBRyxDQUFDNE4sS0FBRDtJQUNSLFFBQUksQ0FBQyxLQUFLSixJQUFWLEVBQWdCLE9BQU8sQ0FBQyxDQUFSO0lBQ2hCLFdBQU8sS0FBS0wsT0FBTCxDQUFhVSxRQUFiLENBQXNCLEtBQUtULEtBQUwsR0FBYSxLQUFLRSxPQUFMLEdBQWVNLEtBQWxELEVBQXlELEtBQUtKLElBQTlELENBQVA7SUFDRDtJQUVEOzs7Ozs7Ozs7O0lBUU8xTSxFQUFBQSxHQUFHLENBQUM4TSxLQUFELEVBQWdCRSxLQUFoQjtJQUNSLFFBQUksQ0FBQyxLQUFLTixJQUFWLEVBQWdCOztJQUNoQixTQUFLTCxPQUFMLENBQWFZLFFBQWIsQ0FBc0IsS0FBS1gsS0FBTCxHQUFhLEtBQUtFLE9BQUwsR0FBZU0sS0FBbEQsRUFBeURFLEtBQXpELEVBQTBFLEtBQUtOLElBQS9FO0lBQ0Q7SUFFRDs7Ozs7Ozs7SUFNT25PLEVBQUFBLFFBQVEsQ0FBQzJPLEtBQUQ7SUFDYkEsSUFBQUEsS0FBSyxDQUFDQyxPQUFOLENBQWMsQ0FBQ0gsS0FBRCxFQUFRRixLQUFSLEtBQWtCLEtBQUs5TSxHQUFMLENBQVM4TSxLQUFULEVBQWdCRSxLQUFoQixDQUFoQztJQUNEO0lBRUQ7Ozs7Ozs7O0lBTU9JLEVBQUFBLFVBQVU7SUFDZixXQUFPLEtBQUtkLEtBQVo7SUFDRDtJQUVEOzs7Ozs7O0lBS09qTyxFQUFBQSxPQUFPO0lBQ1osU0FBS2dPLE9BQUwsQ0FBYWdCLEtBQWIsQ0FBbUIsS0FBS2YsS0FBeEI7SUFDRDs7Ozs7O0lDdkdIO0lBeUJBLE1BQU1nQixtQkFBbUIsR0FBRyxNQUFNO0lBQzlCLFFBQU1DLE1BQU0sR0FBRyxFQUFmO0lBQ0EsTUFBSUMsVUFBVSxHQUFHLEVBQWpCO0lBQ0EsTUFBSUMsV0FBVyxHQUFHLGdCQUFsQjs7SUFDQSxNQUFJQyxLQUFLLEdBQUcsVUFBU0MsTUFBVCxFQUFpQkMsT0FBakIsRUFBMEI7SUFDbEMsVUFBTUEsT0FBTjtJQUNILEdBRkQ7O0lBR0EsUUFBTUMsa0JBQWtCLEdBQUcsT0FBT3pSLE1BQVAsS0FBa0IsUUFBN0M7SUFDQSxRQUFNMFIscUJBQXFCLEdBQUcsT0FBT0MsYUFBUCxLQUF5QixVQUF2RDtJQUNBLFFBQU1DLG1CQUFtQixHQUFHLE9BQU9DLE9BQVAsS0FBbUIsUUFBbkIsSUFBK0IsT0FBT0EsT0FBTyxDQUFDQyxRQUFmLEtBQTRCLFFBQTNELElBQXVFLE9BQU9ELE9BQU8sQ0FBQ0MsUUFBUixDQUFpQnpGLElBQXhCLEtBQWlDLFFBQXBJO0lBQ0EsTUFBSTBGLGVBQWUsR0FBRyxFQUF0QixDQVY4Qjs7SUFhOUIsUUFBTUMsaUJBQWlCLEdBQUdOLHFCQUFxQixHQUFHTyxJQUFILEdBQVUsSUFBekQ7O0lBRUEsV0FBU0MsVUFBVCxDQUFvQkMsSUFBcEIsRUFBMEI7SUFDdEIsUUFBSWhCLE1BQU0sQ0FBQ2UsVUFBWCxFQUF1QjtJQUNuQixhQUFPZixNQUFNLENBQUNlLFVBQVAsQ0FBa0JDLElBQWxCLEVBQXdCSixlQUF4QixDQUFQO0lBQ0g7O0lBQ0QsV0FBT0EsZUFBZSxHQUFHSSxJQUF6QjtJQUNIOztJQUNELE1BQUlDLEtBQUo7SUFBVyxNQUFJQyxTQUFKO0lBQWUsTUFBSUMsVUFBSjs7SUFFMUIsV0FBU0Msa0JBQVQsQ0FBNEJsTSxDQUE1QixFQUErQjtJQUMzQixRQUFJQSxDQUFDLFlBQVltTSxVQUFqQixFQUE2QjtJQUM3QixVQUFNQyxLQUFLLEdBQUdwTSxDQUFkO0lBQ0FxTSxJQUFBQSxHQUFHLENBQUUsNkJBQThCRCxLQUFNLEVBQXRDLENBQUg7SUFDSDs7SUFDRCxNQUFJRSxNQUFKO0lBQ0EsTUFBSUMsUUFBSjs7SUFDQSxNQUFJaEIsbUJBQUosRUFBeUI7SUFDckIsUUFBSUYscUJBQUosRUFBMkI7SUFDdkJLLE1BQUFBLGVBQWUsR0FBSSxHQUFFYyxPQUFPLENBQUMsTUFBRCxDQUFQLENBQWdCQyxPQUFoQixDQUF3QmYsZUFBeEIsQ0FBMkMsR0FBaEU7SUFDSCxLQUZELE1BRU87SUFDSEEsTUFBQUEsZUFBZSxHQUFJLEdBQUVnQixTQUFZLEdBQWpDO0lBQ0g7O0lBQ0RYLElBQUFBLEtBQUssR0FBRyxTQUFTWSxVQUFULENBQW9CQyxRQUFwQixFQUE4QkMsTUFBOUIsRUFBc0M7SUFDMUMsVUFBSSxDQUFDUCxNQUFMLEVBQWFBLE1BQU0sR0FBR0UsT0FBTyxDQUFDLElBQUQsQ0FBaEI7SUFDYixVQUFJLENBQUNELFFBQUwsRUFBZUEsUUFBUSxHQUFHQyxPQUFPLENBQUMsTUFBRCxDQUFsQjtJQUNmSSxNQUFBQSxRQUFRLEdBQUdMLFFBQVEsQ0FBQ3JPLFNBQVQsQ0FBbUIwTyxRQUFuQixDQUFYO0lBQ0EsYUFBT04sTUFBTSxDQUFDUSxZQUFQLENBQW9CRixRQUFwQixFQUE4QkMsTUFBTSxHQUFHLElBQUgsR0FBVSxNQUE5QyxDQUFQO0lBQ0gsS0FMRDs7SUFNQVosSUFBQUEsVUFBVSxHQUFHLFNBQVNBLFVBQVQsQ0FBb0JXLFFBQXBCLEVBQThCO0lBQ3ZDLFVBQUlHLEdBQUcsR0FBR2hCLEtBQUssQ0FBQ2EsUUFBRCxFQUFXLElBQVgsQ0FBZjs7SUFDQSxVQUFJLENBQUNHLEdBQUcsQ0FBQ3ZTLE1BQVQsRUFBaUI7SUFDYnVTLFFBQUFBLEdBQUcsR0FBRyxJQUFJQyxVQUFKLENBQWVELEdBQWYsQ0FBTjtJQUNIOztJQUNEOU8sTUFBQUEsTUFBTSxDQUFDOE8sR0FBRyxDQUFDdlMsTUFBTCxDQUFOO0lBQ0EsYUFBT3VTLEdBQVA7SUFDSCxLQVBEOztJQVFBZixJQUFBQSxTQUFTLEdBQUcsU0FBU0EsU0FBVCxDQUFtQlksUUFBbkIsRUFBNkJLLE1BQTdCLEVBQXFDQyxPQUFyQyxFQUE4QztJQUN0RCxVQUFJLENBQUNaLE1BQUwsRUFBYUEsTUFBTSxHQUFHRSxPQUFPLENBQUMsSUFBRCxDQUFoQjtJQUNiLFVBQUksQ0FBQ0QsUUFBTCxFQUFlQSxRQUFRLEdBQUdDLE9BQU8sQ0FBQyxNQUFELENBQWxCO0lBQ2ZJLE1BQUFBLFFBQVEsR0FBR0wsUUFBUSxDQUFDck8sU0FBVCxDQUFtQjBPLFFBQW5CLENBQVg7SUFDQU4sTUFBQUEsTUFBTSxDQUFDYSxRQUFQLENBQWdCUCxRQUFoQixFQUEwQixDQUFDUCxHQUFELEVBQU0xUSxJQUFOLEtBQWU7SUFDckMsWUFBSTBRLEdBQUosRUFBU2EsT0FBTyxDQUFDYixHQUFELENBQVAsQ0FBVCxLQUNLWSxNQUFNLENBQUN0UixJQUFJLENBQUNuQixNQUFOLENBQU47SUFDUixPQUhEO0lBSUgsS0FSRDs7SUFTQSxRQUFJZ1IsT0FBTyxDQUFDNEIsSUFBUixDQUFheFMsTUFBYixHQUFzQixDQUExQixFQUE2QjtJQUN6Qm9RLE1BQUFBLFdBQVcsR0FBR1EsT0FBTyxDQUFDNEIsSUFBUixDQUFhLENBQWIsRUFBZ0JDLE9BQWhCLENBQXdCLEtBQXhCLEVBQStCLEdBQS9CLENBQWQ7SUFDSDs7SUFDRHRDLElBQUFBLFVBQVUsR0FBR1MsT0FBTyxDQUFDNEIsSUFBUixDQUFhRSxLQUFiLENBQW1CLENBQW5CLENBQWI7O0lBQ0EsUUFBSSxPQUFPcEQsTUFBUCxLQUFrQixXQUF0QixFQUFtQztJQUMvQkEsTUFBQUEsTUFBTSxDQUFDcUQsT0FBUCxHQUFpQnpDLE1BQWpCO0lBQ0g7O0lBQ0RVLElBQUFBLE9BQU8sQ0FBQ2dDLEVBQVIsQ0FBVyxtQkFBWCxFQUFpQ0MsRUFBRCxJQUFRO0lBQ3BDLFVBQUksRUFBRUEsRUFBRSxZQUFZdEIsVUFBaEIsQ0FBSixFQUFpQztJQUM3QixjQUFNc0IsRUFBTjtJQUNIO0lBQ0osS0FKRDtJQUtBakMsSUFBQUEsT0FBTyxDQUFDZ0MsRUFBUixDQUFXLG9CQUFYLEVBQWtDRSxNQUFELElBQVk7SUFDekMsWUFBTUEsTUFBTjtJQUNILEtBRkQ7O0lBR0F6QyxJQUFBQSxLQUFLLEdBQUcsVUFBU0MsTUFBVCxFQUFpQkMsT0FBakIsRUFBMEI7SUFDOUIsVUFBSXdDLGdCQUFnQixFQUFwQixFQUF3QjtJQUNwQm5DLFFBQUFBLE9BQU8sQ0FBQ29DLFFBQVIsR0FBbUIxQyxNQUFuQjtJQUNBLGNBQU1DLE9BQU47SUFDSDs7SUFDRGUsTUFBQUEsa0JBQWtCLENBQUNmLE9BQUQsQ0FBbEI7SUFDQUssTUFBQUEsT0FBTyxDQUFDcUMsSUFBUixDQUFhM0MsTUFBYjtJQUNILEtBUEQ7O0lBUUFKLElBQUFBLE1BQU0sQ0FBQ2dELE9BQVAsR0FBaUIsWUFBVztJQUN4QixhQUFPLDRCQUFQO0lBQ0gsS0FGRDtJQUdILEdBdkRELE1BdURPLElBQUkxQyxrQkFBa0IsSUFBSUMscUJBQTFCLEVBQWlEO0lBQ3BELFFBQUlBLHFCQUFKLEVBQTJCO0lBQ3ZCO0lBQ0FLLE1BQUFBLGVBQWUsR0FBR0UsSUFBSSxDQUFDbUMsUUFBTCxDQUFjQyxJQUFoQztJQUNILEtBSEQsTUFHTyxJQUFJLE9BQU9uVSxRQUFQLEtBQW9CLFdBQXBCLElBQW1DQSxRQUFRLENBQUNvVSxhQUFoRCxFQUErRDtJQUNsRXZDLE1BQUFBLGVBQWUsR0FBRzdSLFFBQVEsQ0FBQ29VLGFBQVQsQ0FBdUJDLEdBQXpDO0lBQ0g7O0lBQ0QsUUFBSXhDLGVBQWUsQ0FBQ3lDLE9BQWhCLENBQXdCLE9BQXhCLE1BQXFDLENBQXpDLEVBQTRDO0lBQ3hDekMsTUFBQUEsZUFBZSxHQUFHQSxlQUFlLENBQUMwQyxNQUFoQixDQUF1QixDQUF2QixFQUEwQjFDLGVBQWUsQ0FBQzJCLE9BQWhCLENBQXdCLFFBQXhCLEVBQWtDLEVBQWxDLEVBQXNDZ0IsV0FBdEMsQ0FBa0QsR0FBbEQsSUFBeUQsQ0FBbkYsQ0FBbEI7SUFDSCxLQUZELE1BRU87SUFDSDNDLE1BQUFBLGVBQWUsR0FBRyxFQUFsQjtJQUNIOztJQUNESyxJQUFBQSxLQUFLLEdBQUcsVUFBUzVHLEdBQVQsRUFBYztJQUNsQixZQUFNbUosR0FBRyxHQUFHLElBQUlDLGNBQUosRUFBWjtJQUNBRCxNQUFBQSxHQUFHLENBQUNFLElBQUosQ0FBUyxLQUFULEVBQWdCckosR0FBaEIsRUFBcUIsS0FBckI7SUFDQW1KLE1BQUFBLEdBQUcsQ0FBQ0csSUFBSixDQUFTLElBQVQ7SUFDQSxhQUFPSCxHQUFHLENBQUNJLFlBQVg7SUFDSCxLQUxEOztJQU1BLFFBQUlyRCxxQkFBSixFQUEyQjtJQUN2QlksTUFBQUEsVUFBVSxHQUFHLFVBQVM5RyxHQUFULEVBQWM7SUFDdkIsY0FBTW1KLEdBQUcsR0FBRyxJQUFJQyxjQUFKLEVBQVo7SUFDQUQsUUFBQUEsR0FBRyxDQUFDRSxJQUFKLENBQVMsS0FBVCxFQUFnQnJKLEdBQWhCLEVBQXFCLEtBQXJCO0lBQ0FtSixRQUFBQSxHQUFHLENBQUNLLFlBQUosR0FBbUIsYUFBbkI7SUFDQUwsUUFBQUEsR0FBRyxDQUFDRyxJQUFKLENBQVMsSUFBVDtJQUNBLGVBQU8sSUFBSXpCLFVBQUosQ0FBZXNCLEdBQUcsQ0FBQ2xKLFFBQW5CLENBQVA7SUFDSCxPQU5EO0lBT0g7O0lBQ0Q0RyxJQUFBQSxTQUFTLEdBQUcsVUFBUzdHLEdBQVQsRUFBYzhILE1BQWQsRUFBc0JDLE9BQXRCLEVBQStCO0lBQ3ZDLFlBQU1vQixHQUFHLEdBQUcsSUFBSUMsY0FBSixFQUFaO0lBQ0FELE1BQUFBLEdBQUcsQ0FBQ0UsSUFBSixDQUFTLEtBQVQsRUFBZ0JySixHQUFoQixFQUFxQixJQUFyQjtJQUNBbUosTUFBQUEsR0FBRyxDQUFDSyxZQUFKLEdBQW1CLGFBQW5COztJQUNBTCxNQUFBQSxHQUFHLENBQUNyQixNQUFKLEdBQWEsWUFBVztJQUNwQixZQUFJcUIsR0FBRyxDQUFDcEQsTUFBSixLQUFlLEdBQWYsSUFBc0JvRCxHQUFHLENBQUNwRCxNQUFKLEtBQWUsQ0FBZixJQUFvQm9ELEdBQUcsQ0FBQ2xKLFFBQWxELEVBQTREO0lBQ3hENkgsVUFBQUEsTUFBTSxDQUFDcUIsR0FBRyxDQUFDbEosUUFBTCxDQUFOO0lBQ0E7SUFDSDs7SUFDRDhILFFBQUFBLE9BQU87SUFDVixPQU5EOztJQU9Bb0IsTUFBQUEsR0FBRyxDQUFDcEIsT0FBSixHQUFjQSxPQUFkO0lBQ0FvQixNQUFBQSxHQUFHLENBQUNHLElBQUosQ0FBUyxJQUFUO0lBQ0gsS0FiRDtJQWNIOztJQUNELFFBQU1HLEdBQUcsR0FBRzlELE1BQU0sQ0FBQytELEtBQVAsSUFBZ0J2VCxPQUFPLENBQUN3VCxHQUFSLENBQVlDLElBQVosQ0FBaUJ6VCxPQUFqQixDQUE1QjtJQUNBLFFBQU0rUSxHQUFHLEdBQUd2QixNQUFNLENBQUNrRSxRQUFQLElBQW1CMVQsT0FBTyxDQUFDMlQsSUFBUixDQUFhRixJQUFiLENBQWtCelQsT0FBbEIsQ0FBL0I7SUFFQSxNQUFJd1AsTUFBTSxDQUFDb0UsU0FBWCxFQUFzQm5FLFVBQVUsR0FBR0QsTUFBTSxDQUFDb0UsU0FBcEI7SUFDdEIsTUFBSXBFLE1BQU0sQ0FBQ0UsV0FBWCxFQUF3QkEsV0FBVyxHQUFHRixNQUFNLENBQUNFLFdBQXJCO0lBQ3hCLE1BQUlGLE1BQU0sQ0FBQ3FFLElBQVgsRUFBaUJsRSxLQUFLLEdBQUdILE1BQU0sQ0FBQ3FFLElBQWY7O0lBRWpCLFdBQVNDLG1CQUFULENBQTZCQyxNQUE3QixFQUFxQztJQUNqQyxRQUFJQyxhQUFhLEdBQUcsRUFBcEI7O0lBQ0EsUUFBSS9ELG1CQUFKLEVBQXlCO0lBQ3JCK0QsTUFBQUEsYUFBYSxHQUFHQyxNQUFNLENBQUNySSxJQUFQLENBQVltSSxNQUFaLEVBQW9CLFFBQXBCLEVBQThCRyxRQUE5QixDQUF1QyxPQUF2QyxDQUFoQjtJQUNILEtBRkQsTUFFTyxJQUFJbkUscUJBQUosRUFBMkI7SUFDMUJpRSxNQUFBQSxhQUFhLEdBQUczRCxpQkFBaUIsQ0FBQzhELElBQWxCLENBQXVCSixNQUF2QixDQUFoQjtJQUNILEtBRkUsTUFFSTtJQUNIQyxNQUFBQSxhQUFhLEdBQUczVixNQUFNLENBQUM4VixJQUFQLENBQVlKLE1BQVosQ0FBaEI7SUFDSDs7SUFDTCxVQUFNcE0sR0FBRyxHQUFHcU0sYUFBYSxDQUFDMVUsTUFBMUI7SUFDQSxVQUFNOFUsS0FBSyxHQUFHLElBQUkxQyxVQUFKLENBQWUvSixHQUFmLENBQWQ7O0lBQ0EsU0FBSyxJQUFJekcsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR3lHLEdBQXBCLEVBQXlCekcsQ0FBQyxFQUExQixFQUE4QjtJQUM5QmtULE1BQUFBLEtBQUssQ0FBQ2xULENBQUQsQ0FBTCxHQUFXOFMsYUFBYSxDQUFDSyxVQUFkLENBQXlCblQsQ0FBekIsQ0FBWDtJQUNDOztJQUNELFdBQU9rVCxLQUFLLENBQUNsVixNQUFiO0lBQ0g7O0lBRUQsUUFBTW9WLFVBQVUsR0FBR1IsbUJBQW1CLENBQUNTLFFBQUQsQ0FBdEM7SUFDQSxRQUFNQyxhQUFhLEdBQUdoRixNQUFNLENBQUNnRixhQUFQLElBQXdCLElBQTlDOztJQUNBLE1BQUksT0FBT0MsV0FBUCxLQUF1QixRQUEzQixFQUFxQztJQUNqQ0MsSUFBQUEsS0FBSyxDQUFDLGlDQUFELENBQUw7SUFDSDs7SUFFRCxXQUFTeEYsUUFBVCxDQUFrQnlGLEdBQWxCLEVBQXVCMUYsS0FBdkIsRUFBOEJOLElBQTlCLEVBQW9DO0lBQ2hDQSxJQUFBQSxJQUFJLEdBQUdBLElBQUksSUFBSSxJQUFmO0lBQ0EsUUFBSUEsSUFBSSxDQUFDaUcsTUFBTCxDQUFZakcsSUFBSSxDQUFDclAsTUFBTCxHQUFjLENBQTFCLE1BQWlDLEdBQXJDLEVBQTBDcVAsSUFBSSxHQUFHLEtBQVA7O0lBQzFDLFlBQVFBLElBQVI7SUFDSSxXQUFLLElBQUw7SUFDSWtHLFFBQUFBLEtBQUssQ0FBQ0YsR0FBRyxJQUFJLENBQVIsQ0FBTCxHQUFrQjFGLEtBQWxCO0lBQ0E7O0lBQ0osV0FBSyxJQUFMO0lBQ0k0RixRQUFBQSxLQUFLLENBQUNGLEdBQUcsSUFBSSxDQUFSLENBQUwsR0FBa0IxRixLQUFsQjtJQUNBOztJQUNKLFdBQUssS0FBTDtJQUNJNkYsUUFBQUEsTUFBTSxDQUFDSCxHQUFHLElBQUksQ0FBUixDQUFOLEdBQW1CMUYsS0FBbkI7SUFDQTs7SUFDSixXQUFLLEtBQUw7SUFDSThGLFFBQUFBLE1BQU0sQ0FBQ0osR0FBRyxJQUFJLENBQVIsQ0FBTixHQUFtQjFGLEtBQW5CO0lBQ0E7O0lBQ0osV0FBSyxLQUFMO0lBQ0krRixRQUFBQSxPQUFPLEdBQUcsQ0FDTi9GLEtBQUssS0FBSyxDQURKLEdBRUxnRyxVQUFVLEdBQUdoRyxLQUFiLEVBQW9CLENBQUM5TSxJQUFJLENBQUMrUyxHQUFMLENBQVNELFVBQVQsQ0FBRCxJQUF5QixDQUF6QixHQUE2QkEsVUFBVSxHQUFHLENBQWIsR0FBaUIsQ0FBQzlTLElBQUksQ0FBQ3dHLEdBQUwsQ0FBUyxDQUFDeEcsSUFBSSxDQUFDZ1QsS0FBTCxDQUFXRixVQUFVLEdBQUcsVUFBeEIsQ0FBVixFQUErQyxVQUEvQyxJQUE2RCxDQUE5RCxNQUFxRSxDQUF0RixHQUEwRixDQUFDLENBQUMsQ0FBQzlTLElBQUksQ0FBQ2lULElBQUwsQ0FBVSxDQUFDSCxVQUFVLEdBQUcsRUFBRSxDQUFDLENBQUNBLFVBQUYsS0FBaUIsQ0FBbkIsQ0FBZCxJQUF1QyxVQUFqRCxDQUFILEtBQW9FLENBQTNMLEdBQStMLENBRjlNLEVBQVY7SUFHQUYsUUFBQUEsTUFBTSxDQUFDSixHQUFHLElBQUksQ0FBUixDQUFOLEdBQW1CSyxPQUFPLENBQUMsQ0FBRCxDQUExQjtJQUNBRCxRQUFBQSxNQUFNLENBQUNKLEdBQUcsR0FBRyxDQUFOLElBQVcsQ0FBWixDQUFOLEdBQXVCSyxPQUFPLENBQUMsQ0FBRCxDQUE5QjtJQUNBOztJQUNKLFdBQUssT0FBTDtJQUNJSyxRQUFBQSxPQUFPLENBQUNWLEdBQUcsSUFBSSxDQUFSLENBQVAsR0FBb0IxRixLQUFwQjtJQUNBOztJQUNKLFdBQUssUUFBTDtJQUNJcUcsUUFBQUEsT0FBTyxDQUFDWCxHQUFHLElBQUksQ0FBUixDQUFQLEdBQW9CMUYsS0FBcEI7SUFDQTs7SUFDSjtJQUNJeUYsUUFBQUEsS0FBSyxDQUFFLDhCQUErQi9GLElBQUssRUFBdEMsQ0FBTDtJQTNCUjtJQTZCSDs7SUFFRCxXQUFTSyxRQUFULENBQWtCMkYsR0FBbEIsRUFBdUJoRyxJQUF2QixFQUE2QjtJQUN6QkEsSUFBQUEsSUFBSSxHQUFHQSxJQUFJLElBQUksSUFBZjtJQUNBLFFBQUlBLElBQUksQ0FBQ2lHLE1BQUwsQ0FBWWpHLElBQUksQ0FBQ3JQLE1BQUwsR0FBYyxDQUExQixNQUFpQyxHQUFyQyxFQUEwQ3FQLElBQUksR0FBRyxLQUFQOztJQUMxQyxZQUFRQSxJQUFSO0lBQ0ksV0FBSyxJQUFMO0lBQ0ksZUFBT2tHLEtBQUssQ0FBQ0YsR0FBRyxJQUFJLENBQVIsQ0FBWjs7SUFDSixXQUFLLElBQUw7SUFDSSxlQUFPRSxLQUFLLENBQUNGLEdBQUcsSUFBSSxDQUFSLENBQVo7O0lBQ0osV0FBSyxLQUFMO0lBQ0ksZUFBT0csTUFBTSxDQUFDSCxHQUFHLElBQUksQ0FBUixDQUFiOztJQUNKLFdBQUssS0FBTDtJQUNJLGVBQU9JLE1BQU0sQ0FBQ0osR0FBRyxJQUFJLENBQVIsQ0FBYjs7SUFDSixXQUFLLEtBQUw7SUFDSSxlQUFPSSxNQUFNLENBQUNKLEdBQUcsSUFBSSxDQUFSLENBQWI7O0lBQ0osV0FBSyxPQUFMO0lBQ0ksZUFBT1UsT0FBTyxDQUFDVixHQUFHLElBQUksQ0FBUixDQUFkOztJQUNKLFdBQUssUUFBTDtJQUNJLGVBQU9ZLE1BQU0sQ0FBQ0QsT0FBTyxDQUFDWCxHQUFHLElBQUksQ0FBUixDQUFSLENBQWI7O0lBQ0o7SUFDSUQsUUFBQUEsS0FBSyxDQUFFLDhCQUErQi9GLElBQUssRUFBdEMsQ0FBTDtJQWhCUjs7SUFrQkEsV0FBTyxJQUFQO0lBQ0g7O0lBQ0QsTUFBSTZHLFVBQUo7SUFDQSxNQUFJQyxLQUFLLEdBQUcsS0FBWjtJQUNBLE1BQUlDLFVBQUo7O0lBRUEsV0FBUy9TLE1BQVQsQ0FBZ0JnVCxTQUFoQixFQUEyQkMsSUFBM0IsRUFBaUM7SUFDN0IsUUFBSSxDQUFDRCxTQUFMLEVBQWdCO0lBQ1pqQixNQUFBQSxLQUFLLENBQUUscUJBQXNCa0IsSUFBSyxFQUE3QixDQUFMO0lBQ0g7SUFDSjs7SUFFRCxXQUFTQyxRQUFULENBQWtCQyxLQUFsQixFQUF5QjtJQUNyQixVQUFNQyxJQUFJLEdBQUd2RyxNQUFNLENBQUUsSUFBS3NHLEtBQU0sRUFBYixDQUFuQjtJQUNBblQsSUFBQUEsTUFBTSxDQUFDb1QsSUFBRCxFQUFRLGdDQUFpQ0QsS0FBUSw0QkFBakQsQ0FBTjtJQUNBLFdBQU9DLElBQVA7SUFDSDs7SUFFRCxXQUFTQyxLQUFULENBQWVGLEtBQWYsRUFBc0JHLFVBQXRCLEVBQWtDQyxRQUFsQyxFQUE0Q0MsSUFBNUMsRUFBa0Q7SUFDOUMsVUFBTUMsR0FBRyxHQUFHO0lBQ1IsZ0JBQVUsVUFBU0MsR0FBVCxFQUFjO0lBQ3BCLFlBQUk1RSxHQUFHLEdBQUcsQ0FBVjs7SUFDQSxZQUFJNEUsR0FBRyxLQUFLLElBQVIsSUFBZ0JBLEdBQUcsS0FBS0MsU0FBeEIsSUFBcUNELEdBQUcsS0FBSyxDQUFqRCxFQUFvRDtJQUNoRCxnQkFBTTFPLEdBQUcsR0FBRyxDQUFDME8sR0FBRyxDQUFDL1csTUFBSixJQUFjLENBQWYsSUFBb0IsQ0FBaEM7SUFDQW1TLFVBQUFBLEdBQUcsR0FBRzhFLFVBQVUsQ0FBQzVPLEdBQUQsQ0FBaEI7SUFDQTZPLFVBQUFBLFlBQVksQ0FBQ0gsR0FBRCxFQUFNNUUsR0FBTixFQUFXOUosR0FBWCxDQUFaO0lBQ0g7O0lBQ0QsZUFBTzhKLEdBQVA7SUFDSCxPQVRPO0lBVVIsZUFBUyxVQUFTZ0YsR0FBVCxFQUFjO0lBQ25CLGNBQU1oRixHQUFHLEdBQUc4RSxVQUFVLENBQUNFLEdBQUcsQ0FBQ25YLE1BQUwsQ0FBdEI7SUFDQW9YLFFBQUFBLGtCQUFrQixDQUFDRCxHQUFELEVBQU1oRixHQUFOLENBQWxCO0lBQ0EsZUFBT0EsR0FBUDtJQUNIO0lBZE8sS0FBWjs7SUFpQkEsYUFBU2tGLGtCQUFULENBQTRCbEYsR0FBNUIsRUFBaUM7SUFDN0IsVUFBSXdFLFVBQVUsS0FBSyxRQUFuQixFQUE2QixPQUFPVyxZQUFZLENBQUNuRixHQUFELENBQW5CO0lBQzdCLFVBQUl3RSxVQUFVLEtBQUssU0FBbkIsRUFBOEIsT0FBT1ksT0FBTyxDQUFDcEYsR0FBRCxDQUFkO0lBQzlCLGFBQU9BLEdBQVA7SUFDSDs7SUFDRCxVQUFNc0UsSUFBSSxHQUFHRixRQUFRLENBQUNDLEtBQUQsQ0FBckI7SUFDQSxVQUFNZ0IsS0FBSyxHQUFHLEVBQWQ7SUFDQSxRQUFJQyxLQUFLLEdBQUcsQ0FBWjs7SUFDQSxRQUFJWixJQUFKLEVBQVU7SUFDTixXQUFLLElBQUlqVixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHaVYsSUFBSSxDQUFDN1csTUFBekIsRUFBaUM0QixDQUFDLEVBQWxDLEVBQXNDO0lBQ2xDLGNBQU04VixTQUFTLEdBQUdaLEdBQUcsQ0FBQ0YsUUFBUSxDQUFDaFYsQ0FBRCxDQUFULENBQXJCOztJQUNBLFlBQUk4VixTQUFKLEVBQWU7SUFDWCxjQUFJRCxLQUFLLEtBQUssQ0FBZCxFQUFpQkEsS0FBSyxHQUFHRSxTQUFTLEVBQWpCO0lBQ2pCSCxVQUFBQSxLQUFLLENBQUM1VixDQUFELENBQUwsR0FBVzhWLFNBQVMsQ0FBQ2IsSUFBSSxDQUFDalYsQ0FBRCxDQUFMLENBQXBCO0lBQ0gsU0FIRCxNQUdPO0lBQ0g0VixVQUFBQSxLQUFLLENBQUM1VixDQUFELENBQUwsR0FBV2lWLElBQUksQ0FBQ2pWLENBQUQsQ0FBZjtJQUNIO0lBQ0o7SUFDSjs7SUFDRCxRQUFJdVEsR0FBRyxHQUFHc0UsSUFBSSxDQUFDLEdBQUdlLEtBQUosQ0FBZDs7SUFFQSxhQUFTSSxNQUFULENBQWdCekYsR0FBaEIsRUFBcUI7SUFDakIsVUFBSXNGLEtBQUssS0FBSyxDQUFkLEVBQWlCSSxZQUFZLENBQUNKLEtBQUQsQ0FBWjtJQUNqQixhQUFPSixrQkFBa0IsQ0FBQ2xGLEdBQUQsQ0FBekI7SUFDSDs7SUFDREEsSUFBQUEsR0FBRyxHQUFHeUYsTUFBTSxDQUFDekYsR0FBRCxDQUFaO0lBQ0EsV0FBT0EsR0FBUDtJQUNIOztJQUNELFFBQU0yRixXQUFXLEdBQUcsT0FBT0MsV0FBUCxLQUF1QixXQUF2QixHQUFxQyxJQUFJQSxXQUFKLENBQWdCLE1BQWhCLENBQXJDLEdBQStEZixTQUFuRjs7SUFFQSxXQUFTZ0IsaUJBQVQsQ0FBMkJDLElBQTNCLEVBQWlDQyxHQUFqQyxFQUFzQ0MsY0FBdEMsRUFBc0Q7SUFDbEQsVUFBTUMsTUFBTSxHQUFHRixHQUFHLEdBQUdDLGNBQXJCO0lBQ0EsUUFBSUUsTUFBTSxHQUFHSCxHQUFiOztJQUNBLFdBQU9ELElBQUksQ0FBQ0ksTUFBRCxDQUFKLElBQWdCLEVBQUVBLE1BQU0sSUFBSUQsTUFBWixDQUF2QixFQUE0QyxFQUFFQyxNQUFGOztJQUM1QyxRQUFJQSxNQUFNLEdBQUdILEdBQVQsR0FBZSxFQUFmLElBQXFCRCxJQUFJLENBQUNLLFFBQTFCLElBQXNDUixXQUExQyxFQUF1RDtJQUNuRCxhQUFPQSxXQUFXLENBQUNTLE1BQVosQ0FBbUJOLElBQUksQ0FBQ0ssUUFBTCxDQUFjSixHQUFkLEVBQW1CRyxNQUFuQixDQUFuQixDQUFQO0lBQ0g7O0lBQ0csUUFBSXRCLEdBQUcsR0FBRyxFQUFWOztJQUNBLFdBQU9tQixHQUFHLEdBQUdHLE1BQWIsRUFBcUI7SUFDakIsVUFBSUcsRUFBRSxHQUFHUCxJQUFJLENBQUNDLEdBQUcsRUFBSixDQUFiOztJQUNBLFVBQUksRUFBRU0sRUFBRSxHQUFHLEdBQVAsQ0FBSixFQUFpQjtJQUNiekIsUUFBQUEsR0FBRyxJQUFJMEIsTUFBTSxDQUFDQyxZQUFQLENBQW9CRixFQUFwQixDQUFQO0lBQ0E7SUFDSDs7SUFDRCxZQUFNRyxFQUFFLEdBQUdWLElBQUksQ0FBQ0MsR0FBRyxFQUFKLENBQUosR0FBYyxFQUF6Qjs7SUFDQSxVQUFJLENBQUNNLEVBQUUsR0FBRyxHQUFOLE1BQWUsR0FBbkIsRUFBd0I7SUFDcEJ6QixRQUFBQSxHQUFHLElBQUkwQixNQUFNLENBQUNDLFlBQVAsQ0FBb0IsQ0FBQ0YsRUFBRSxHQUFHLEVBQU4sS0FBYSxDQUFiLEdBQWlCRyxFQUFyQyxDQUFQO0lBQ0E7SUFDSDs7SUFDRCxZQUFNQyxFQUFFLEdBQUdYLElBQUksQ0FBQ0MsR0FBRyxFQUFKLENBQUosR0FBYyxFQUF6Qjs7SUFDQSxVQUFJLENBQUNNLEVBQUUsR0FBRyxHQUFOLE1BQWUsR0FBbkIsRUFBd0I7SUFDcEJBLFFBQUFBLEVBQUUsR0FBRyxDQUFDQSxFQUFFLEdBQUcsRUFBTixLQUFhLEVBQWIsR0FBa0JHLEVBQUUsSUFBSSxDQUF4QixHQUE0QkMsRUFBakM7SUFDSCxPQUZELE1BRU87SUFDSEosUUFBQUEsRUFBRSxHQUFHLENBQUNBLEVBQUUsR0FBRyxDQUFOLEtBQVksRUFBWixHQUFpQkcsRUFBRSxJQUFJLEVBQXZCLEdBQTRCQyxFQUFFLElBQUksQ0FBbEMsR0FBc0NYLElBQUksQ0FBQ0MsR0FBRyxFQUFKLENBQUosR0FBYyxFQUF6RDtJQUNIOztJQUNELFVBQUlNLEVBQUUsR0FBRyxLQUFULEVBQWdCO0lBQ1p6QixRQUFBQSxHQUFHLElBQUkwQixNQUFNLENBQUNDLFlBQVAsQ0FBb0JGLEVBQXBCLENBQVA7SUFDSCxPQUZELE1BRU87SUFDSCxjQUFNSyxFQUFFLEdBQUdMLEVBQUUsR0FBRyxLQUFoQjtJQUNBekIsUUFBQUEsR0FBRyxJQUFJMEIsTUFBTSxDQUFDQyxZQUFQLENBQW9CLFFBQVFHLEVBQUUsSUFBSSxFQUFsQyxFQUFzQyxRQUFRQSxFQUFFLEdBQUcsSUFBbkQsQ0FBUDtJQUNIO0lBQ0o7O0lBRUwsV0FBTzlCLEdBQVA7SUFDSDs7SUFFRCxXQUFTTyxZQUFULENBQXNCakMsR0FBdEIsRUFBMkI4QyxjQUEzQixFQUEyQztJQUN2QyxXQUFPOUMsR0FBRyxHQUFHMkMsaUJBQWlCLENBQUNjLE1BQUQsRUFBU3pELEdBQVQsRUFBYzhDLGNBQWQsQ0FBcEIsR0FBb0QsRUFBOUQ7SUFDSDs7SUFFRCxXQUFTWSxpQkFBVCxDQUEyQmhDLEdBQTNCLEVBQWdDa0IsSUFBaEMsRUFBc0NlLE1BQXRDLEVBQThDQyxlQUE5QyxFQUErRDtJQUMzRCxRQUFJLEVBQUVBLGVBQWUsR0FBRyxDQUFwQixDQUFKLEVBQTRCLE9BQU8sQ0FBUDtJQUM1QixVQUFNQyxRQUFRLEdBQUdGLE1BQWpCO0lBQ0EsVUFBTVosTUFBTSxHQUFHWSxNQUFNLEdBQUdDLGVBQVQsR0FBMkIsQ0FBMUM7O0lBQ0EsU0FBSyxJQUFJclgsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR21WLEdBQUcsQ0FBQy9XLE1BQXhCLEVBQWdDLEVBQUU0QixDQUFsQyxFQUFxQztJQUNqQyxVQUFJcUUsQ0FBQyxHQUFHOFEsR0FBRyxDQUFDaEMsVUFBSixDQUFlblQsQ0FBZixDQUFSOztJQUNBLFVBQUlxRSxDQUFDLElBQUksS0FBTCxJQUFjQSxDQUFDLElBQUksS0FBdkIsRUFBOEI7SUFDMUIsY0FBTTBTLEVBQUUsR0FBRzVCLEdBQUcsQ0FBQ2hDLFVBQUosQ0FBZSxFQUFFblQsQ0FBakIsQ0FBWDtJQUNBcUUsUUFBQUEsQ0FBQyxHQUFHLFNBQVMsQ0FBQ0EsQ0FBQyxHQUFHLElBQUwsS0FBYyxFQUF2QixJQUE2QjBTLEVBQUUsR0FBRyxJQUF0QztJQUNIOztJQUNELFVBQUkxUyxDQUFDLElBQUksR0FBVCxFQUFjO0lBQ1YsWUFBSStTLE1BQU0sSUFBSVosTUFBZCxFQUFzQjtJQUN0QkgsUUFBQUEsSUFBSSxDQUFDZSxNQUFNLEVBQVAsQ0FBSixHQUFpQi9TLENBQWpCO0lBQ0gsT0FIRCxNQUdPLElBQUlBLENBQUMsSUFBSSxJQUFULEVBQWU7SUFDbEIsWUFBSStTLE1BQU0sR0FBRyxDQUFULElBQWNaLE1BQWxCLEVBQTBCO0lBQzFCSCxRQUFBQSxJQUFJLENBQUNlLE1BQU0sRUFBUCxDQUFKLEdBQWlCLE1BQU0vUyxDQUFDLElBQUksQ0FBNUI7SUFDQWdTLFFBQUFBLElBQUksQ0FBQ2UsTUFBTSxFQUFQLENBQUosR0FBaUIsTUFBTS9TLENBQUMsR0FBRyxFQUEzQjtJQUNILE9BSk0sTUFJQSxJQUFJQSxDQUFDLElBQUksS0FBVCxFQUFnQjtJQUNuQixZQUFJK1MsTUFBTSxHQUFHLENBQVQsSUFBY1osTUFBbEIsRUFBMEI7SUFDMUJILFFBQUFBLElBQUksQ0FBQ2UsTUFBTSxFQUFQLENBQUosR0FBaUIsTUFBTS9TLENBQUMsSUFBSSxFQUE1QjtJQUNBZ1MsUUFBQUEsSUFBSSxDQUFDZSxNQUFNLEVBQVAsQ0FBSixHQUFpQixNQUFNL1MsQ0FBQyxJQUFJLENBQUwsR0FBUyxFQUFoQztJQUNBZ1MsUUFBQUEsSUFBSSxDQUFDZSxNQUFNLEVBQVAsQ0FBSixHQUFpQixNQUFNL1MsQ0FBQyxHQUFHLEVBQTNCO0lBQ0gsT0FMTSxNQUtBO0lBQ0gsWUFBSStTLE1BQU0sR0FBRyxDQUFULElBQWNaLE1BQWxCLEVBQTBCO0lBQzFCSCxRQUFBQSxJQUFJLENBQUNlLE1BQU0sRUFBUCxDQUFKLEdBQWlCLE1BQU0vUyxDQUFDLElBQUksRUFBNUI7SUFDQWdTLFFBQUFBLElBQUksQ0FBQ2UsTUFBTSxFQUFQLENBQUosR0FBaUIsTUFBTS9TLENBQUMsSUFBSSxFQUFMLEdBQVUsRUFBakM7SUFDQWdTLFFBQUFBLElBQUksQ0FBQ2UsTUFBTSxFQUFQLENBQUosR0FBaUIsTUFBTS9TLENBQUMsSUFBSSxDQUFMLEdBQVMsRUFBaEM7SUFDQWdTLFFBQUFBLElBQUksQ0FBQ2UsTUFBTSxFQUFQLENBQUosR0FBaUIsTUFBTS9TLENBQUMsR0FBRyxFQUEzQjtJQUNIO0lBQ0o7O0lBQ0RnUyxJQUFBQSxJQUFJLENBQUNlLE1BQUQsQ0FBSixHQUFlLENBQWY7SUFDQSxXQUFPQSxNQUFNLEdBQUdFLFFBQWhCO0lBQ0g7O0lBRUQsV0FBU2hDLFlBQVQsQ0FBc0JILEdBQXRCLEVBQTJCb0MsTUFBM0IsRUFBbUNGLGVBQW5DLEVBQW9EO0lBQ2hELFdBQU9GLGlCQUFpQixDQUFDaEMsR0FBRCxFQUFNK0IsTUFBTixFQUFjSyxNQUFkLEVBQXNCRixlQUF0QixDQUF4QjtJQUNIOztJQUVELFdBQVNHLGVBQVQsQ0FBeUJyQyxHQUF6QixFQUE4QjtJQUMxQixRQUFJMU8sR0FBRyxHQUFHLENBQVY7O0lBQ0EsU0FBSyxJQUFJekcsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR21WLEdBQUcsQ0FBQy9XLE1BQXhCLEVBQWdDLEVBQUU0QixDQUFsQyxFQUFxQztJQUNqQyxVQUFJcUUsQ0FBQyxHQUFHOFEsR0FBRyxDQUFDaEMsVUFBSixDQUFlblQsQ0FBZixDQUFSO0lBQ0EsVUFBSXFFLENBQUMsSUFBSSxLQUFMLElBQWNBLENBQUMsSUFBSSxLQUF2QixFQUE4QkEsQ0FBQyxHQUFHLFNBQVMsQ0FBQ0EsQ0FBQyxHQUFHLElBQUwsS0FBYyxFQUF2QixJQUE2QjhRLEdBQUcsQ0FBQ2hDLFVBQUosQ0FBZSxFQUFFblQsQ0FBakIsSUFBc0IsSUFBdkQ7SUFDOUIsVUFBSXFFLENBQUMsSUFBSSxHQUFULEVBQWMsRUFBRW9DLEdBQUYsQ0FBZCxLQUNLLElBQUlwQyxDQUFDLElBQUksSUFBVCxFQUFlb0MsR0FBRyxJQUFJLENBQVAsQ0FBZixLQUNBLElBQUlwQyxDQUFDLElBQUksS0FBVCxFQUFnQm9DLEdBQUcsSUFBSSxDQUFQLENBQWhCLEtBQ0FBLEdBQUcsSUFBSSxDQUFQO0lBQ1I7O0lBQ0QsV0FBT0EsR0FBUDtJQUNIOztJQUVELFdBQVNnUixtQkFBVCxDQUE2QnRDLEdBQTdCLEVBQWtDO0lBQzlCLFVBQU14SCxJQUFJLEdBQUc2SixlQUFlLENBQUNyQyxHQUFELENBQWYsR0FBdUIsQ0FBcEM7SUFDQSxVQUFNNUUsR0FBRyxHQUFHOEUsVUFBVSxDQUFDMUgsSUFBRCxDQUF0QjtJQUNBd0osSUFBQUEsaUJBQWlCLENBQUNoQyxHQUFELEVBQU14QixLQUFOLEVBQWFwRCxHQUFiLEVBQWtCNUMsSUFBbEIsQ0FBakI7SUFDQSxXQUFPNEMsR0FBUDtJQUNIOztJQUVELFdBQVNpRixrQkFBVCxDQUE0QnZILEtBQTVCLEVBQW1DalEsTUFBbkMsRUFBMkM7SUFDdkMyVixJQUFBQSxLQUFLLENBQUM1UyxHQUFOLENBQVVrTixLQUFWLEVBQWlCalEsTUFBakI7SUFDSDs7SUFFRCxXQUFTMFosT0FBVCxDQUFpQmpYLENBQWpCLEVBQW9Ca1gsUUFBcEIsRUFBOEI7SUFDMUIsUUFBSWxYLENBQUMsR0FBR2tYLFFBQUosR0FBZSxDQUFuQixFQUFzQjtJQUNsQmxYLE1BQUFBLENBQUMsSUFBSWtYLFFBQVEsR0FBR2xYLENBQUMsR0FBR2tYLFFBQXBCO0lBQ0g7O0lBQ0QsV0FBT2xYLENBQVA7SUFDSDs7SUFDRCxNQUFJekMsTUFBSjtJQUFZLE1BQUkyVixLQUFKO0lBQVcsTUFBSXVELE1BQUo7SUFBWSxNQUFJdEQsTUFBSjtJQUF5QixNQUFJQyxNQUFKO0lBQXlCLE1BQUlNLE9BQUo7SUFBYSxNQUFJQyxPQUFKOztJQUVsRyxXQUFTd0QsMEJBQVQsQ0FBb0NDLEdBQXBDLEVBQXlDO0lBQ3JDN1osSUFBQUEsTUFBTSxHQUFHNlosR0FBVDtJQUNBdkosSUFBQUEsTUFBTSxDQUFDcUYsS0FBUCxHQUFlQSxLQUFLLEdBQUcsSUFBSW1FLFNBQUosQ0FBY0QsR0FBZCxDQUF2QjtJQUNBdkosSUFBQUEsTUFBTSxDQUFDc0YsTUFBUCxHQUFnQkEsTUFBTSxHQUFHLElBQUlqSixVQUFKLENBQWVrTixHQUFmLENBQXpCO0lBQ0F2SixJQUFBQSxNQUFNLENBQUN1RixNQUFQLEdBQWdCQSxNQUFNLEdBQUcsSUFBSXZNLFVBQUosQ0FBZXVRLEdBQWYsQ0FBekI7SUFDQXZKLElBQUFBLE1BQU0sQ0FBQzRJLE1BQVAsR0FBZ0JBLE1BQU0sR0FBRyxJQUFJMUcsVUFBSixDQUFlcUgsR0FBZixDQUF6QixDQUxxQzs7SUFPckN2SixJQUFBQSxNQUFNLENBQUN5SixPQUFQLEdBQTJCLElBQUlDLFdBQUosQ0FBZ0JILEdBQWhCLENBQTNCLENBUHFDOztJQVNyQ3ZKLElBQUFBLE1BQU0sQ0FBQzJKLE9BQVAsR0FBMkIsSUFBSUMsV0FBSixDQUFnQkwsR0FBaEIsQ0FBM0I7SUFDQXZKLElBQUFBLE1BQU0sQ0FBQzZGLE9BQVAsR0FBaUJBLE9BQU8sR0FBRyxJQUFJblMsWUFBSixDQUFpQjZWLEdBQWpCLENBQTNCO0lBQ0F2SixJQUFBQSxNQUFNLENBQUM4RixPQUFQLEdBQWlCQSxPQUFPLEdBQUcsSUFBSStELFlBQUosQ0FBaUJOLEdBQWpCLENBQTNCO0lBQ0g7O0lBQ0QsTUFBSU8sU0FBSjtJQUNBLFFBQU1DLFlBQVksR0FBRyxFQUFyQjtJQUNBLFFBQU1DLFVBQVUsR0FBRyxFQUFuQjtJQUNBLFFBQU1DLFVBQVUsR0FBRyxFQUFuQjtJQUNBLFFBQU1DLGFBQWEsR0FBRyxFQUF0QjtJQUNBLFFBQU1DLHVCQUF1QixHQUFHLENBQWhDOztJQUVBLFdBQVN0SCxnQkFBVCxHQUE0QjtJQUN4QixXQUFPbUMsYUFBYSxJQUFJbUYsdUJBQXVCLEdBQUcsQ0FBbEQ7SUFDSDs7SUFFRCxXQUFTQyxNQUFULEdBQWtCO0lBQ2QsUUFBSXBLLE1BQU0sQ0FBQ29LLE1BQVgsRUFBbUI7SUFDZixVQUFJLE9BQU9wSyxNQUFNLENBQUNvSyxNQUFkLEtBQXlCLFVBQTdCLEVBQXlDcEssTUFBTSxDQUFDb0ssTUFBUCxHQUFnQixDQUFDcEssTUFBTSxDQUFDb0ssTUFBUixDQUFoQjs7SUFDekMsYUFBT3BLLE1BQU0sQ0FBQ29LLE1BQVAsQ0FBY3RhLE1BQXJCLEVBQTZCO0lBQ3pCdWEsUUFBQUEsV0FBVyxDQUFDckssTUFBTSxDQUFDb0ssTUFBUCxDQUFjRSxLQUFkLEVBQUQsQ0FBWDtJQUNIO0lBQ0o7O0lBQ0RDLElBQUFBLG9CQUFvQixDQUFDUixZQUFELENBQXBCO0lBQ0g7O0lBRUQsV0FBU1MsV0FBVCxHQUF1QjtJQUNuQkQsSUFBQUEsb0JBQW9CLENBQUNQLFVBQUQsQ0FBcEI7SUFDSDs7SUFFRCxXQUFTUyxPQUFULEdBQW1CO0lBQ2ZGLElBQUFBLG9CQUFvQixDQUFDTixVQUFELENBQXBCO0lBQ0g7O0lBS0QsV0FBU1MsT0FBVCxHQUFtQjtJQUNmLFFBQUkxSyxNQUFNLENBQUMwSyxPQUFYLEVBQW9CO0lBQ2hCLFVBQUksT0FBTzFLLE1BQU0sQ0FBQzBLLE9BQWQsS0FBMEIsVUFBOUIsRUFBMEMxSyxNQUFNLENBQUMwSyxPQUFQLEdBQWlCLENBQUMxSyxNQUFNLENBQUMwSyxPQUFSLENBQWpCOztJQUMxQyxhQUFPMUssTUFBTSxDQUFDMEssT0FBUCxDQUFlNWEsTUFBdEIsRUFBOEI7SUFDMUI2YSxRQUFBQSxZQUFZLENBQUMzSyxNQUFNLENBQUMwSyxPQUFQLENBQWVKLEtBQWYsRUFBRCxDQUFaO0lBQ0g7SUFDSjs7SUFDREMsSUFBQUEsb0JBQW9CLENBQUNMLGFBQUQsQ0FBcEI7SUFDSDs7SUFFRCxXQUFTRyxXQUFULENBQXFCTyxFQUFyQixFQUF5QjtJQUNyQmIsSUFBQUEsWUFBWSxDQUFDYyxPQUFiLENBQXFCRCxFQUFyQjtJQUNIOztJQUVELFdBQVNFLFNBQVQsQ0FBbUJGLEVBQW5CLEVBQXVCO0lBQ25CWixJQUFBQSxVQUFVLENBQUNhLE9BQVgsQ0FBbUJELEVBQW5CO0lBQ0g7O0lBRUQsV0FBU0QsWUFBVCxDQUFzQkMsRUFBdEIsRUFBMEI7SUFDdEJWLElBQUFBLGFBQWEsQ0FBQ1csT0FBZCxDQUFzQkQsRUFBdEI7SUFDSDs7SUFDRCxNQUFJRyxlQUFlLEdBQUcsQ0FBdEI7SUFFQSxNQUFJQyxxQkFBcUIsR0FBRyxJQUE1Qjs7SUFFQSxXQUFTQyxnQkFBVCxHQUE0QjtJQUN4QkYsSUFBQUEsZUFBZTs7SUFDZixRQUFJL0ssTUFBTSxDQUFDa0wsc0JBQVgsRUFBbUM7SUFDL0JsTCxNQUFBQSxNQUFNLENBQUNrTCxzQkFBUCxDQUE4QkgsZUFBOUI7SUFDSDtJQUNKOztJQUVELFdBQVNJLG1CQUFULEdBQStCO0lBQzNCSixJQUFBQSxlQUFlOztJQUNmLFFBQUkvSyxNQUFNLENBQUNrTCxzQkFBWCxFQUFtQztJQUMvQmxMLE1BQUFBLE1BQU0sQ0FBQ2tMLHNCQUFQLENBQThCSCxlQUE5QjtJQUNIOztJQUNELFFBQUlBLGVBQWUsS0FBSyxDQUF4QixFQUEyQjs7SUFLdkIsVUFBSUMscUJBQUosRUFBMkI7SUFDdkIsY0FBTUksUUFBUSxHQUFHSixxQkFBakI7SUFDQUEsUUFBQUEscUJBQXFCLEdBQUcsSUFBeEI7SUFDQUksUUFBQUEsUUFBUTtJQUNYO0lBQ0o7SUFDSjs7SUFDRHBMLEVBQUFBLE1BQU0sQ0FBQ3FMLGVBQVAsR0FBeUIsRUFBekI7SUFDQXJMLEVBQUFBLE1BQU0sQ0FBQ3NMLGVBQVAsR0FBeUIsRUFBekI7O0lBRUEsV0FBU3BHLEtBQVQsQ0FBZXFHLElBQWYsRUFBcUI7SUFDakIsUUFBSXZMLE1BQU0sQ0FBQ3dMLE9BQVgsRUFBb0I7SUFDaEJ4TCxNQUFBQSxNQUFNLENBQUN3TCxPQUFQLENBQWVELElBQWY7SUFDSDs7SUFDREEsSUFBQUEsSUFBSSxHQUFJLFdBQVlBLElBQU8sR0FBM0I7SUFDQWhLLElBQUFBLEdBQUcsQ0FBQ2dLLElBQUQsQ0FBSDtJQUNBdEYsSUFBQUEsS0FBSyxHQUFHLElBQVI7SUFDQUMsSUFBQUEsVUFBVSxHQUFHLENBQWI7SUFDQXFGLElBQUFBLElBQUksSUFBSSw2Q0FBUjtJQUNBLFVBQU1yVyxDQUFDLEdBQUcsSUFBSStQLFdBQVcsQ0FBQ3dHLFlBQWhCLENBQTZCRixJQUE3QixDQUFWO0lBQ0EsVUFBTXJXLENBQU47SUFDSDs7SUFDRCxRQUFNd1csYUFBYSxHQUFHLHVDQUF0Qjs7SUFFQSxXQUFTQyxTQUFULENBQW1CN0osUUFBbkIsRUFBNkI7SUFDekIsV0FBT0EsUUFBUSxDQUFDOEosVUFBVCxDQUFvQkYsYUFBcEIsQ0FBUDtJQUNIOztJQUVELFdBQVNHLFNBQVQsQ0FBbUIvSixRQUFuQixFQUE2QjtJQUN6QixXQUFPQSxRQUFRLENBQUM4SixVQUFULENBQW9CLFNBQXBCLENBQVA7SUFDSDs7SUFDRCxNQUFJRSxjQUFKO0lBQ0FBLEVBQUFBLGNBQWMsR0FBRy9HLFFBQWpCOztJQUNBLE1BQUksQ0FBQzRHLFNBQVMsQ0FBQ0csY0FBRCxDQUFkLEVBQWdDO0lBQzVCQSxJQUFBQSxjQUFjLEdBQUcvSyxVQUFVLENBQUMrSyxjQUFELENBQTNCO0lBQ0g7O0lBRUQsV0FBU0MsU0FBVCxDQUFtQkMsSUFBbkIsRUFBeUI7SUFDckIsUUFBSTtJQUNBLFVBQUlBLElBQUksS0FBS0YsY0FBVCxJQUEyQmhILFVBQS9CLEVBQTJDO0lBQ3ZDLGVBQU8sSUFBSTVDLFVBQUosQ0FBZTRDLFVBQWYsQ0FBUDtJQUNIOztJQUNELFVBQUkzRCxVQUFKLEVBQWdCO0lBQ1osZUFBT0EsVUFBVSxDQUFDNkssSUFBRCxDQUFqQjtJQUNIOztJQUNHLFlBQU0sSUFBSTVWLEtBQUosQ0FBVSxpREFBVixDQUFOO0lBRVAsS0FURCxDQVNFLE9BQU9tTCxHQUFQLEVBQVk7SUFDVjJELE1BQUFBLEtBQUssQ0FBQzNELEdBQUQsQ0FBTDtJQUNBLGFBQU8sSUFBUDtJQUNIO0lBQ0o7O0lBRUQsV0FBUzBLLGdCQUFULEdBQTRCO0lBQ3hCLFFBQUksQ0FBQ25ILFVBQUQsS0FBZ0J4RSxrQkFBa0IsSUFBSUMscUJBQXRDLENBQUosRUFBa0U7SUFDOUQsVUFBSSxPQUFPaEcsS0FBUCxLQUFpQixVQUFqQixJQUErQixDQUFDc1IsU0FBUyxDQUFDQyxjQUFELENBQTdDLEVBQStEO0lBQzNELGVBQU92UixLQUFLLENBQUN1UixjQUFELEVBQWlCO0lBQ3pCSSxVQUFBQSxXQUFXLEVBQUU7SUFEWSxTQUFqQixDQUFMLENBRUpDLElBRkksQ0FFRTdSLFFBQUQsSUFBYztJQUNsQixjQUFJLENBQUNBLFFBQVEsQ0FBQzhSLEVBQWQsRUFBa0I7SUFDZCxrQkFBTSxJQUFJaFcsS0FBSixDQUFXLHVDQUF3QzBWLGNBQWlCLEdBQXBFLENBQU47SUFDSDs7SUFDRCxpQkFBT3hSLFFBQVEsQ0FBQzJCLFdBQVQsRUFBUDtJQUNILFNBUE0sRUFPSm9RLEtBUEksQ0FPRSxNQUFNTixTQUFTLENBQUNELGNBQUQsQ0FQakIsQ0FBUDtJQVFIOztJQUNHLFVBQUk1SyxTQUFKLEVBQWU7SUFDWCxlQUFPLElBQUlvTCxPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVQyxNQUFWLEtBQXFCO0lBQ3BDdEwsVUFBQUEsU0FBUyxDQUFDNEssY0FBRCxFQUFrQnhSLFFBQUQsSUFBYztJQUNwQ2lTLFlBQUFBLE9BQU8sQ0FBQyxJQUFJckssVUFBSixDQUFlNUgsUUFBZixDQUFELENBQVA7SUFDSCxXQUZRLEVBRU5rUyxNQUZNLENBQVQ7SUFHSCxTQUpNLENBQVA7SUFLSDtJQUVSOztJQUNELFdBQU9GLE9BQU8sQ0FBQ0MsT0FBUixHQUFrQkosSUFBbEIsQ0FBdUIsTUFBTUosU0FBUyxDQUFDRCxjQUFELENBQXRDLENBQVA7SUFDSDs7SUFFRCxXQUFTVyxVQUFULEdBQXNCO0lBQ2xCLFVBQU1DLElBQUksR0FBRztJQUNULGFBQU9DLGFBREU7SUFFVCxnQ0FBMEJBO0lBRmpCLEtBQWI7O0lBS0EsYUFBU0MsZUFBVCxDQUF5QkMsUUFBekIsRUFBbUM7SUFDL0IsWUFBTTtJQUFDcEssUUFBQUE7SUFBRCxVQUFZb0ssUUFBbEI7SUFDQTdNLE1BQUFBLE1BQU0sQ0FBQzhNLEdBQVAsR0FBYXJLLE9BQWI7SUFDQXVELE1BQUFBLFVBQVUsR0FBR2hHLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV0MsTUFBeEI7SUFDQXpELE1BQUFBLDBCQUEwQixDQUFDdEQsVUFBVSxDQUFDdFcsTUFBWixDQUExQjtJQUNBb2EsTUFBQUEsU0FBUyxHQUFHOUosTUFBTSxDQUFDOE0sR0FBUCxDQUFXRSx5QkFBdkI7SUFDQWxDLE1BQUFBLFNBQVMsQ0FBQzlLLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV0csaUJBQVosQ0FBVDtJQUNBOUIsTUFBQUEsbUJBQW1CLENBQUEsQ0FBbkI7SUFDSDs7SUFDREYsSUFBQUEsZ0JBQWdCLENBQUEsQ0FBaEI7O0lBRUEsYUFBU2lDLDBCQUFULENBQW9DL2IsTUFBcEMsRUFBNEM7SUFDeEN5YixNQUFBQSxlQUFlLENBQUN6YixNQUFNLENBQUMwYixRQUFSLENBQWY7SUFDSDs7SUFFRCxhQUFTTSxzQkFBVCxDQUFnQ0MsUUFBaEMsRUFBMEM7SUFDdEMsYUFBT25CLGdCQUFnQixHQUFHRSxJQUFuQixDQUF5QnBLLE1BQUQsSUFBWWtELFdBQVcsQ0FBQ29JLFdBQVosQ0FBd0J0TCxNQUF4QixFQUFnQzJLLElBQWhDLENBQXBDLEVBQTJFUCxJQUEzRSxDQUFpRlUsUUFBRCxJQUFjQSxRQUE5RixFQUF3R1YsSUFBeEcsQ0FBNkdpQixRQUE3RyxFQUF3SHhLLE1BQUQsSUFBWTtJQUN0SXJCLFFBQUFBLEdBQUcsQ0FBRSwwQ0FBMkNxQixNQUFPLEVBQXBELENBQUg7SUFDQXNDLFFBQUFBLEtBQUssQ0FBQ3RDLE1BQUQsQ0FBTDtJQUNILE9BSE0sQ0FBUDtJQUlIOztJQUVELGFBQVMwSyxnQkFBVCxHQUE0QjtJQUN4QixVQUFJLENBQUN4SSxVQUFELElBQWUsT0FBT0csV0FBVyxDQUFDc0ksb0JBQW5CLEtBQTRDLFVBQTNELElBQXlFLENBQUM1QixTQUFTLENBQUNHLGNBQUQsQ0FBbkYsSUFBdUcsQ0FBQ0QsU0FBUyxDQUFDQyxjQUFELENBQWpILElBQXFJLE9BQU92UixLQUFQLEtBQWlCLFVBQTFKLEVBQXNLO0lBQ2xLLGVBQU9BLEtBQUssQ0FBQ3VSLGNBQUQsRUFBaUI7SUFDekJJLFVBQUFBLFdBQVcsRUFBRTtJQURZLFNBQWpCLENBQUwsQ0FFSkMsSUFGSSxDQUVFN1IsUUFBRCxJQUFjO0lBQ2xCLGdCQUFNbkosTUFBTSxHQUFHOFQsV0FBVyxDQUFDc0ksb0JBQVosQ0FBaUNqVCxRQUFqQyxFQUEyQ29TLElBQTNDLENBQWY7SUFDQSxpQkFBT3ZiLE1BQU0sQ0FBQ2diLElBQVAsQ0FBWWUsMEJBQVosRUFBeUN0SyxNQUFELElBQVk7SUFDdkRyQixZQUFBQSxHQUFHLENBQUUsa0NBQW1DcUIsTUFBTyxFQUE1QyxDQUFIO0lBQ0FyQixZQUFBQSxHQUFHLENBQUMsMkNBQUQsQ0FBSDtJQUNBLG1CQUFPNEwsc0JBQXNCLENBQUNELDBCQUFELENBQTdCO0lBQ0gsV0FKTSxDQUFQO0lBS0gsU0FUTSxDQUFQO0lBVUg7O0lBQ0csYUFBT0Msc0JBQXNCLENBQUNELDBCQUFELENBQTdCO0lBRVA7O0lBQ0QsUUFBSWxOLE1BQU0sQ0FBQ3dOLGVBQVgsRUFBNEI7SUFDeEIsVUFBSTtJQUNBLGNBQU0vSyxPQUFPLEdBQUd6QyxNQUFNLENBQUN3TixlQUFQLENBQXVCZCxJQUF2QixFQUE2QkUsZUFBN0IsQ0FBaEI7SUFDQSxlQUFPbkssT0FBUDtJQUNILE9BSEQsQ0FHRSxPQUFPdk4sQ0FBUCxFQUFVO0lBQ1JxTSxRQUFBQSxHQUFHLENBQUUsc0RBQXVEck0sQ0FBRSxFQUEzRCxDQUFIO0lBQ0EsZUFBTyxLQUFQO0lBQ0g7SUFDSjs7SUFDRG9ZLElBQUFBLGdCQUFnQjtJQUNoQixXQUFPLEVBQVA7SUFDSDs7SUFDRCxNQUFJN0gsVUFBSjtJQUNBLE1BQUlELE9BQUo7O0lBRUEsV0FBUytFLG9CQUFULENBQThCa0QsU0FBOUIsRUFBeUM7SUFDckMsV0FBT0EsU0FBUyxDQUFDM2QsTUFBVixHQUFtQixDQUExQixFQUE2QjtJQUN6QixZQUFNc2IsUUFBUSxHQUFHcUMsU0FBUyxDQUFDbkQsS0FBVixFQUFqQjs7SUFDQSxVQUFJLE9BQU9jLFFBQVAsS0FBb0IsVUFBeEIsRUFBb0M7SUFDaENBLFFBQUFBLFFBQVEsQ0FBQ3BMLE1BQUQsQ0FBUjtJQUNBO0lBQ0g7O0lBQ0QsWUFBTTtJQUFDdUcsUUFBQUE7SUFBRCxVQUFTNkUsUUFBZjs7SUFDQSxVQUFJLE9BQU83RSxJQUFQLEtBQWdCLFFBQXBCLEVBQThCO0lBQzFCLFlBQUk2RSxRQUFRLENBQUNzQyxHQUFULEtBQWlCNUcsU0FBckIsRUFBZ0M7SUFDNUI2RyxVQUFBQSxpQkFBaUIsQ0FBQ3BILElBQUQsQ0FBakI7SUFDSCxTQUZELE1BRU87SUFDSG9ILFVBQUFBLGlCQUFpQixDQUFDcEgsSUFBRCxDQUFqQixDQUF3QjZFLFFBQVEsQ0FBQ3NDLEdBQWpDO0lBQ0g7SUFDSixPQU5ELE1BTU87SUFDSG5ILFFBQUFBLElBQUksQ0FBQzZFLFFBQVEsQ0FBQ3NDLEdBQVQsS0FBaUI1RyxTQUFqQixHQUE2QixJQUE3QixHQUFvQ3NFLFFBQVEsQ0FBQ3NDLEdBQTlDLENBQUo7SUFDSDtJQUNKO0lBQ0o7O0lBRUQsUUFBTUUsZUFBZSxHQUFHLEVBQXhCOztJQUVBLFdBQVNELGlCQUFULENBQTJCRSxPQUEzQixFQUFvQztJQUNoQyxRQUFJdEgsSUFBSSxHQUFHcUgsZUFBZSxDQUFDQyxPQUFELENBQTFCOztJQUNBLFFBQUksQ0FBQ3RILElBQUwsRUFBVztJQUNQLFVBQUlzSCxPQUFPLElBQUlELGVBQWUsQ0FBQzlkLE1BQS9CLEVBQXVDOGQsZUFBZSxDQUFDOWQsTUFBaEIsR0FBeUIrZCxPQUFPLEdBQUcsQ0FBbkM7SUFDdkNELE1BQUFBLGVBQWUsQ0FBQ0MsT0FBRCxDQUFmLEdBQTJCdEgsSUFBSSxHQUFHdUQsU0FBUyxDQUFDblksR0FBVixDQUFja2MsT0FBZCxDQUFsQztJQUNIOztJQUNELFdBQU90SCxJQUFQO0lBQ0g7O0lBRUQsV0FBU3VILGVBQVQsQ0FBeUI1WSxDQUF6QixFQUE0QjtJQUN4QixRQUFJQSxDQUFDLFlBQVltTSxVQUFiLElBQTJCbk0sQ0FBQyxLQUFLLFFBQXJDLEVBQStDO0lBQzNDLGFBQU9nUixVQUFQO0lBQ0g7O0lBQ0QvRixJQUFBQSxLQUFLLENBQUMsQ0FBRCxFQUFJakwsQ0FBSixDQUFMO0lBQ0g7O0lBRUQsV0FBUzZZLGNBQVQsQ0FBd0I1SCxTQUF4QixFQUFtQ3JFLFFBQW5DLEVBQTZDa00sSUFBN0MsRUFBbUR6SCxJQUFuRCxFQUF5RDtJQUNyRHJCLElBQUFBLEtBQUssQ0FBRSxxQkFBc0JrQyxZQUFZLENBQUNqQixTQUFELENBQWMsU0FBVSxDQUFDckUsUUFBUSxHQUFHc0YsWUFBWSxDQUFDdEYsUUFBRCxDQUFmLEdBQTRCLGtCQUFyQyxFQUF5RGtNLElBQXpELEVBQStEekgsSUFBSSxHQUFHYSxZQUFZLENBQUNiLElBQUQsQ0FBZixHQUF3QixrQkFBM0YsQ0FBK0csRUFBM0ssQ0FBTDtJQUNIOztJQUVELFdBQVMwSCx5QkFBVCxDQUFtQzVPLElBQW5DLEVBQXlDO0lBQ3JDLFdBQU9DLE9BQU8sQ0FBQ0QsSUFBSSxHQUFHLEVBQVIsQ0FBUCxHQUFxQixFQUE1QjtJQUNIOztJQUVELFdBQVM2TyxPQUFULEdBQW1COztJQUVuQixXQUFTQyxhQUFULENBQXVCQyxFQUF2QixFQUEyQkMsRUFBM0IsRUFBK0I7SUFDM0IsV0FBT0gsT0FBTyxDQUFBLENBQWQ7SUFDSDs7SUFFRCxXQUFTSSxhQUFULENBQXVCQyxNQUF2QixFQUErQjtJQUMzQixTQUFLQSxNQUFMLEdBQWNBLE1BQWQ7SUFDQSxTQUFLcEosR0FBTCxHQUFXb0osTUFBTSxHQUFHLEVBQXBCOztJQUNBLFNBQUtDLFFBQUwsR0FBZ0IsVUFBU3JQLElBQVQsRUFBZTtJQUMzQm9HLE1BQUFBLE1BQU0sQ0FBQyxLQUFLSixHQUFMLEdBQVcsQ0FBWCxJQUFnQixDQUFqQixDQUFOLEdBQTRCaEcsSUFBNUI7SUFDSCxLQUZEOztJQUdBLFNBQUtzUCxRQUFMLEdBQWdCLFlBQVc7SUFDdkIsYUFBT2xKLE1BQU0sQ0FBQyxLQUFLSixHQUFMLEdBQVcsQ0FBWCxJQUFnQixDQUFqQixDQUFiO0lBQ0gsS0FGRDs7SUFHQSxTQUFLdUosY0FBTCxHQUFzQixVQUFTQyxVQUFULEVBQXFCO0lBQ3ZDcEosTUFBQUEsTUFBTSxDQUFDLEtBQUtKLEdBQUwsR0FBVyxDQUFYLElBQWdCLENBQWpCLENBQU4sR0FBNEJ3SixVQUE1QjtJQUNILEtBRkQ7O0lBR0EsU0FBS0MsY0FBTCxHQUFzQixZQUFXO0lBQzdCLGFBQU9ySixNQUFNLENBQUMsS0FBS0osR0FBTCxHQUFXLENBQVgsSUFBZ0IsQ0FBakIsQ0FBYjtJQUNILEtBRkQ7O0lBR0EsU0FBSzBKLFlBQUwsR0FBb0IsVUFBU0MsUUFBVCxFQUFtQjtJQUNuQ3ZKLE1BQUFBLE1BQU0sQ0FBQyxLQUFLSixHQUFMLElBQVksQ0FBYixDQUFOLEdBQXdCMkosUUFBeEI7SUFDSCxLQUZEOztJQUdBLFNBQUtDLFVBQUwsR0FBa0IsVUFBU0MsTUFBVCxFQUFpQjtJQUMvQkEsTUFBQUEsTUFBTSxHQUFHQSxNQUFNLEdBQUcsQ0FBSCxHQUFPLENBQXRCO0lBQ0EzSixNQUFBQSxLQUFLLENBQUMsS0FBS0YsR0FBTCxHQUFXLEVBQVgsSUFBaUIsQ0FBbEIsQ0FBTCxHQUE0QjZKLE1BQTVCO0lBQ0gsS0FIRDs7SUFJQSxTQUFLQyxVQUFMLEdBQWtCLFlBQVc7SUFDekIsYUFBTzVKLEtBQUssQ0FBQyxLQUFLRixHQUFMLEdBQVcsRUFBWCxJQUFpQixDQUFsQixDQUFMLEtBQThCLENBQXJDO0lBQ0gsS0FGRDs7SUFHQSxTQUFLK0osWUFBTCxHQUFvQixVQUFTQyxRQUFULEVBQW1CO0lBQ25DQSxNQUFBQSxRQUFRLEdBQUdBLFFBQVEsR0FBRyxDQUFILEdBQU8sQ0FBMUI7SUFDQTlKLE1BQUFBLEtBQUssQ0FBQyxLQUFLRixHQUFMLEdBQVcsRUFBWCxJQUFpQixDQUFsQixDQUFMLEdBQTRCZ0ssUUFBNUI7SUFDSCxLQUhEOztJQUlBLFNBQUtDLFlBQUwsR0FBb0IsWUFBVztJQUMzQixhQUFPL0osS0FBSyxDQUFDLEtBQUtGLEdBQUwsR0FBVyxFQUFYLElBQWlCLENBQWxCLENBQUwsS0FBOEIsQ0FBckM7SUFDSCxLQUZEOztJQUdBLFNBQUtrSyxJQUFMLEdBQVksVUFBU2xRLElBQVQsRUFBZXdQLFVBQWYsRUFBMkI7SUFDbkMsV0FBS0gsUUFBTCxDQUFjclAsSUFBZDtJQUNBLFdBQUt1UCxjQUFMLENBQW9CQyxVQUFwQjtJQUNBLFdBQUtFLFlBQUwsQ0FBa0IsQ0FBbEI7SUFDQSxXQUFLRSxVQUFMLENBQWdCLEtBQWhCO0lBQ0EsV0FBS0csWUFBTCxDQUFrQixLQUFsQjtJQUNILEtBTkQ7O0lBT0EsU0FBS0ksT0FBTCxHQUFlLFlBQVc7SUFDdEIsWUFBTTdQLEtBQUssR0FBRzhGLE1BQU0sQ0FBQyxLQUFLSixHQUFMLElBQVksQ0FBYixDQUFwQjtJQUNBSSxNQUFBQSxNQUFNLENBQUMsS0FBS0osR0FBTCxJQUFZLENBQWIsQ0FBTixHQUF3QjFGLEtBQUssR0FBRyxDQUFoQztJQUNILEtBSEQ7O0lBSUEsU0FBSzhQLFdBQUwsR0FBbUIsWUFBVztJQUMxQixZQUFNQyxJQUFJLEdBQUdqSyxNQUFNLENBQUMsS0FBS0osR0FBTCxJQUFZLENBQWIsQ0FBbkI7SUFDQUksTUFBQUEsTUFBTSxDQUFDLEtBQUtKLEdBQUwsSUFBWSxDQUFiLENBQU4sR0FBd0JxSyxJQUFJLEdBQUcsQ0FBL0I7SUFDQSxhQUFPQSxJQUFJLEtBQUssQ0FBaEI7SUFDSCxLQUpEO0lBS0g7O0lBRUQsV0FBU0MsWUFBVCxDQUFzQnRLLEdBQXRCLEVBQTJCaEcsSUFBM0IsRUFBaUN3UCxVQUFqQyxFQUE2QztJQUN6QyxVQUFNakMsSUFBSSxHQUFHLElBQUk0QixhQUFKLENBQWtCbkosR0FBbEIsQ0FBYjtJQUNBdUgsSUFBQUEsSUFBSSxDQUFDMkMsSUFBTCxDQUFVbFEsSUFBVixFQUFnQndQLFVBQWhCO0lBQ0EsVUFBTXhKLEdBQU47SUFDSDs7SUFFRCxXQUFTdUssTUFBVCxHQUFrQjtJQUNkeEssSUFBQUEsS0FBSyxDQUFDLEVBQUQsQ0FBTDtJQUNIOztJQUVELFdBQVN5SyxzQkFBVCxDQUFnQ3RaLElBQWhDLEVBQXNDK00sR0FBdEMsRUFBMkN3TSxHQUEzQyxFQUFnRDtJQUM1Q2hILElBQUFBLE1BQU0sQ0FBQ2lILFVBQVAsQ0FBa0J4WixJQUFsQixFQUF3QitNLEdBQXhCLEVBQTZCQSxHQUFHLEdBQUd3TSxHQUFuQztJQUNIOztJQUVELFdBQVNFLHlCQUFULENBQW1DelEsSUFBbkMsRUFBeUM7SUFDckMsUUFBSTtJQUNBMkcsTUFBQUEsVUFBVSxDQUFDK0osSUFBWCxDQUFnQjFRLElBQUksR0FBRzNQLE1BQU0sQ0FBQ3lNLFVBQWQsR0FBMkIsS0FBM0IsS0FBcUMsRUFBckQ7SUFDQW1OLE1BQUFBLDBCQUEwQixDQUFDdEQsVUFBVSxDQUFDdFcsTUFBWixDQUExQjtJQUNBLGFBQU8sQ0FBUCxDQUhBO0lBS0gsS0FMRCxDQUtFLE9BQU93RixDQUFQLEVBQVU7SUFHZjs7SUFFRCxXQUFTOGEsdUJBQVQsQ0FBaUNDLGFBQWpDLEVBQWdEO0lBQzVDLFVBQU1DLE9BQU8sR0FBR3RILE1BQU0sQ0FBQzlZLE1BQXZCO0lBQ0FtZ0IsSUFBQUEsYUFBYSxNQUFNLENBQW5CO0lBQ0EsVUFBTUUsV0FBVyxHQUFHLFVBQXBCOztJQUNBLFFBQUlGLGFBQWEsR0FBR0UsV0FBcEIsRUFBaUM7SUFDN0IsYUFBTyxLQUFQO0lBQ0g7O0lBQ0QsU0FBSyxJQUFJQyxPQUFPLEdBQUcsQ0FBbkIsRUFBc0JBLE9BQU8sSUFBSSxDQUFqQyxFQUFvQ0EsT0FBTyxJQUFJLENBQS9DLEVBQWtEO0lBQzlDLFVBQUlDLGlCQUFpQixHQUFHSCxPQUFPLElBQUksSUFBSSxLQUFLRSxPQUFiLENBQS9CO0lBQ0FDLE1BQUFBLGlCQUFpQixHQUFHMWQsSUFBSSxDQUFDd0csR0FBTCxDQUFTa1gsaUJBQVQsRUFBNEJKLGFBQWEsR0FBRyxTQUE1QyxDQUFwQjtJQUNBLFlBQU1LLE9BQU8sR0FBRzNkLElBQUksQ0FBQ3dHLEdBQUwsQ0FBU2dYLFdBQVQsRUFBc0IvRyxPQUFPLENBQUN6VyxJQUFJLENBQUN5RyxHQUFMLENBQVM2VyxhQUFULEVBQXdCSSxpQkFBeEIsQ0FBRCxFQUE2QyxLQUE3QyxDQUE3QixDQUFoQjtJQUNBLFlBQU1FLFdBQVcsR0FBR1QseUJBQXlCLENBQUNRLE9BQUQsQ0FBN0M7O0lBQ0EsVUFBSUMsV0FBSixFQUFpQjtJQUNiLGVBQU8sSUFBUDtJQUNIO0lBQ0o7O0lBQ0QsV0FBTyxLQUFQO0lBQ0g7O0lBQ0QsUUFBTUMsUUFBUSxHQUFHO0lBQ2JDLElBQUFBLFFBQVEsRUFBRSxFQURHO0lBRWIxVixJQUFBQSxPQUFPLEVBQUUsQ0FBQyxJQUFELEVBQU8sRUFBUCxFQUNMLEVBREssQ0FGSTs7SUFLYjJWLElBQUFBLFNBQVMsQ0FBQ0MsTUFBRCxFQUFTQyxJQUFULEVBQWU7SUFDcEIsWUFBTWxoQixNQUFNLEdBQUc4Z0IsUUFBUSxDQUFDelYsT0FBVCxDQUFpQjRWLE1BQWpCLENBQWY7O0lBQ0EsVUFBSUMsSUFBSSxLQUFLLENBQVQsSUFBY0EsSUFBSSxLQUFLLEVBQTNCLEVBQStCO0lBQzNCLFNBQUNELE1BQU0sS0FBSyxDQUFYLEdBQWU3TSxHQUFmLEdBQXFCdkMsR0FBdEIsRUFBMkJ1RyxpQkFBaUIsQ0FBQ3BZLE1BQUQsRUFBUyxDQUFULENBQTVDO0lBQ0FBLFFBQUFBLE1BQU0sQ0FBQ0ksTUFBUCxHQUFnQixDQUFoQjtJQUNILE9BSEQsTUFHTztJQUNISixRQUFBQSxNQUFNLENBQUNtaEIsSUFBUCxDQUFZRCxJQUFaO0lBQ0g7SUFDSixLQWJZOztJQWNiRSxJQUFBQSxPQUFPLEVBQUVoSyxTQWRJOztJQWViblYsSUFBQUEsR0FBRyxHQUFHO0lBQ0Y2ZSxNQUFBQSxRQUFRLENBQUNNLE9BQVQsSUFBb0IsQ0FBcEI7SUFDQSxZQUFNN08sR0FBRyxHQUFHc0QsTUFBTSxDQUFDaUwsUUFBUSxDQUFDTSxPQUFULEdBQW1CLENBQW5CLElBQXdCLENBQXpCLENBQWxCO0lBQ0EsYUFBTzdPLEdBQVA7SUFDSCxLQW5CWTs7SUFvQmI4TyxJQUFBQSxNQUFNLENBQUM1TCxHQUFELEVBQU07SUFDUixZQUFNbEQsR0FBRyxHQUFHbUYsWUFBWSxDQUFDakMsR0FBRCxDQUF4QjtJQUNBLGFBQU9sRCxHQUFQO0lBQ0gsS0F2Qlk7O0lBd0JiK08sSUFBQUEsS0FBSyxDQUFDQyxHQUFELEVBQU07SUFDUCxhQUFPQSxHQUFQO0lBQ0g7O0lBMUJZLEdBQWpCOztJQTZCQSxXQUFTQyxTQUFULENBQW1CQyxFQUFuQixFQUF1QkMsR0FBdkIsRUFBNEJDLE1BQTVCLEVBQW9DQyxJQUFwQyxFQUEwQztJQUN0QyxRQUFJMUIsR0FBRyxHQUFHLENBQVY7O0lBQ0EsU0FBSyxJQUFJbGUsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRzJmLE1BQXBCLEVBQTRCM2YsQ0FBQyxFQUE3QixFQUFpQztJQUM3QixZQUFNeVQsR0FBRyxHQUFHSSxNQUFNLENBQUM2TCxHQUFHLElBQUksQ0FBUixDQUFsQjtJQUNBLFlBQU1qWixHQUFHLEdBQUdvTixNQUFNLENBQUM2TCxHQUFHLEdBQUcsQ0FBTixJQUFXLENBQVosQ0FBbEI7SUFDQUEsTUFBQUEsR0FBRyxJQUFJLENBQVA7O0lBQ0EsV0FBSyxJQUFJOWIsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRzZDLEdBQXBCLEVBQXlCN0MsQ0FBQyxFQUExQixFQUE4QjtJQUMxQmtiLFFBQUFBLFFBQVEsQ0FBQ0UsU0FBVCxDQUFtQlMsRUFBbkIsRUFBdUJ2SSxNQUFNLENBQUN6RCxHQUFHLEdBQUc3UCxDQUFQLENBQTdCO0lBQ0g7O0lBQ0RzYSxNQUFBQSxHQUFHLElBQUl6WCxHQUFQO0lBQ0g7O0lBQ0RvTixJQUFBQSxNQUFNLENBQUMrTCxJQUFJLElBQUksQ0FBVCxDQUFOLEdBQW9CMUIsR0FBcEI7SUFDQSxXQUFPLENBQVA7SUFDSCxHQTl4QjZCOzs7SUFpeUI5QixXQUFTMkIsWUFBVCxDQUFzQkMsR0FBdEIsRUFBMkI7SUFFMUI7O0lBQ0QsUUFBTTdFLGFBQWEsR0FBRztJQUNsQixxQkFBaUJvQixjQURDO0lBRWxCLGdDQUE0QkUseUJBRlY7SUFHbEIsb0JBQWdCRSxhQUhFO0lBSWxCLG1CQUFlc0IsWUFKRztJQUtsQixhQUFTQyxNQUxTO0lBTWxCLDZCQUF5QkMsc0JBTlA7SUFPbEIsOEJBQTBCSyx1QkFQUjtJQVFsQixnQkFBWWtCLFNBUk07SUFTbEIsbUJBQWVLO0lBVEcsR0FBdEI7SUFXQTlFLEVBQUFBLFVBQVU7O0lBQ1YsRUFBeUJ6TSxNQUFNLENBQUN5UixrQkFBUCxHQUE0QixZQUFXO0lBQzVELFdBQU8sQ0FBc0J6UixNQUFNLENBQUN5UixrQkFBUCxHQUE0QnpSLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV0csaUJBQTdELEVBQWdGeUUsS0FBaEYsQ0FBc0YsSUFBdEYsRUFBNEZ0TixTQUE1RixDQUFQO0lBQ0g7O0lBQ0QsRUFBWXBFLE1BQU0sQ0FBQzJSLEtBQVAsR0FBZSxZQUFXO0lBQ2xDLFdBQU8sQ0FBUzNSLE1BQU0sQ0FBQzJSLEtBQVAsR0FBZTNSLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBVzhFLElBQW5DLEVBQXlDRixLQUF6QyxDQUErQyxJQUEvQyxFQUFxRHROLFNBQXJELENBQVA7SUFDSDs7SUFDRCxFQUFxQnBFLE1BQU0sQ0FBQzZSLGNBQVAsR0FBd0IsWUFBVztJQUNwRCxXQUFPLENBQWtCN1IsTUFBTSxDQUFDNlIsY0FBUCxHQUF3QjdSLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV2dGLGFBQXJELEVBQW9FSixLQUFwRSxDQUEwRSxJQUExRSxFQUFnRnROLFNBQWhGLENBQVA7SUFDSDs7SUFDRCxFQUFzQnBFLE1BQU0sQ0FBQytSLGVBQVAsR0FBeUIsWUFBVztJQUN0RCxXQUFPLENBQW1CL1IsTUFBTSxDQUFDK1IsZUFBUCxHQUF5Qi9SLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV2tGLGNBQXZELEVBQXVFTixLQUF2RSxDQUE2RSxJQUE3RSxFQUFtRnROLFNBQW5GLENBQVA7SUFDSDs7SUFDRCxFQUFpQnBFLE1BQU0sQ0FBQ2lTLFVBQVAsR0FBb0IsWUFBVztJQUM1QyxXQUFPLENBQWNqUyxNQUFNLENBQUNpUyxVQUFQLEdBQW9CalMsTUFBTSxDQUFDOE0sR0FBUCxDQUFXb0YsU0FBN0MsRUFBd0RSLEtBQXhELENBQThELElBQTlELEVBQW9FdE4sU0FBcEUsQ0FBUDtJQUNIOztJQUNELEVBQWtCcEUsTUFBTSxDQUFDbVMsV0FBUCxHQUFxQixZQUFXO0lBQzlDLFdBQU8sQ0FBZW5TLE1BQU0sQ0FBQ21TLFdBQVAsR0FBcUJuUyxNQUFNLENBQUM4TSxHQUFQLENBQVdzRixVQUEvQyxFQUEyRFYsS0FBM0QsQ0FBaUUsSUFBakUsRUFBdUV0TixTQUF2RSxDQUFQO0lBQ0g7O0lBQ0QsRUFBa0JwRSxNQUFNLENBQUNxUyxXQUFQLEdBQXFCLFlBQVc7SUFDOUMsV0FBTyxDQUFlclMsTUFBTSxDQUFDcVMsV0FBUCxHQUFxQnJTLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV3dGLFVBQS9DLEVBQTJEWixLQUEzRCxDQUFpRSxJQUFqRSxFQUF1RXROLFNBQXZFLENBQVA7SUFDSDs7SUFDRCxFQUF3QnBFLE1BQU0sQ0FBQ3VTLGlCQUFQLEdBQTJCLFlBQVc7SUFDMUQsV0FBTyxDQUFxQnZTLE1BQU0sQ0FBQ3VTLGlCQUFQLEdBQTJCdlMsTUFBTSxDQUFDOE0sR0FBUCxDQUFXMEYsZ0JBQTNELEVBQTZFZCxLQUE3RSxDQUFtRixJQUFuRixFQUF5RnROLFNBQXpGLENBQVA7SUFDSDs7SUFDRCxNQUFJcUQsU0FBUyxHQUFHekgsTUFBTSxDQUFDeUgsU0FBUCxHQUFtQixZQUFXO0lBQzFDLFdBQU8sQ0FBQ0EsU0FBUyxHQUFHekgsTUFBTSxDQUFDeUgsU0FBUCxHQUFtQnpILE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV3JGLFNBQTNDLEVBQXNEaUssS0FBdEQsQ0FBNEQsSUFBNUQsRUFBa0V0TixTQUFsRSxDQUFQO0lBQ0gsR0FGRDs7SUFHQSxNQUFJdUQsWUFBWSxHQUFHM0gsTUFBTSxDQUFDMkgsWUFBUCxHQUFzQixZQUFXO0lBQ2hELFdBQU8sQ0FBQ0EsWUFBWSxHQUFHM0gsTUFBTSxDQUFDMkgsWUFBUCxHQUFzQjNILE1BQU0sQ0FBQzhNLEdBQVAsQ0FBV25GLFlBQWpELEVBQStEK0osS0FBL0QsQ0FBcUUsSUFBckUsRUFBMkV0TixTQUEzRSxDQUFQO0lBQ0gsR0FGRDs7SUFHQSxNQUFJMkMsVUFBVSxHQUFHL0csTUFBTSxDQUFDK0csVUFBUCxHQUFvQixZQUFXO0lBQzVDLFdBQU8sQ0FBQ0EsVUFBVSxHQUFHL0csTUFBTSxDQUFDK0csVUFBUCxHQUFvQi9HLE1BQU0sQ0FBQzhNLEdBQVAsQ0FBVy9GLFVBQTdDLEVBQXlEMkssS0FBekQsQ0FBK0QsSUFBL0QsRUFBcUV0TixTQUFyRSxDQUFQO0lBQ0gsR0FGRDs7SUFHQSxNQUFJOUUsT0FBTyxHQUFHVSxNQUFNLENBQUNWLE9BQVAsR0FBaUIsWUFBVztJQUN0QyxXQUFPLENBQUNBLE9BQU8sR0FBR1UsTUFBTSxDQUFDVixPQUFQLEdBQWlCVSxNQUFNLENBQUM4TSxHQUFQLENBQVcyRixNQUF2QyxFQUErQ2YsS0FBL0MsQ0FBcUQsSUFBckQsRUFBMkR0TixTQUEzRCxDQUFQO0lBQ0gsR0FGRDs7SUFHQSxFQUFZcEUsTUFBTSxDQUFDRixLQUFQLEdBQWUsWUFBVztJQUNsQyxXQUFPLENBQVNFLE1BQU0sQ0FBQ0YsS0FBUCxHQUFlRSxNQUFNLENBQUM4TSxHQUFQLENBQVc0RixJQUFuQyxFQUF5Q2hCLEtBQXpDLENBQStDLElBQS9DLEVBQXFEdE4sU0FBckQsQ0FBUDtJQUNIOztJQUNELEVBQW1CcEUsTUFBTSxDQUFDMlMsWUFBUCxHQUFzQixZQUFXO0lBQ2hELFdBQU8sQ0FBZ0IzUyxNQUFNLENBQUMyUyxZQUFQLEdBQXNCM1MsTUFBTSxDQUFDOE0sR0FBUCxDQUFXNkYsWUFBakQsRUFBK0RqQixLQUEvRCxDQUFxRSxJQUFyRSxFQUEyRXROLFNBQTNFLENBQVA7SUFDSDs7SUFDRHBFLEVBQUFBLE1BQU0sQ0FBQ3dHLEtBQVAsR0FBZUEsS0FBZjtJQUNBeEcsRUFBQUEsTUFBTSxDQUFDTixRQUFQLEdBQWtCQSxRQUFsQjtJQUNBTSxFQUFBQSxNQUFNLENBQUNSLFFBQVAsR0FBa0JBLFFBQWxCO0lBQ0EsTUFBSW9ULFNBQUo7O0lBRUEsV0FBU3ZSLFVBQVQsQ0FBb0JqQixNQUFwQixFQUE0QjtJQUN4QixTQUFLeVMsSUFBTCxHQUFZLFlBQVo7SUFDQSxTQUFLQyxPQUFMLEdBQWdCLGdDQUFpQzFTLE1BQVMsR0FBMUQ7SUFDQSxTQUFLQSxNQUFMLEdBQWNBLE1BQWQ7SUFDSDs7SUFFRDRLLEVBQUFBLHFCQUFxQixHQUFHLFNBQVMrSCxTQUFULEdBQXFCO0lBQ3pDLFFBQUksQ0FBQ0gsU0FBTCxFQUFnQkksR0FBRztJQUNuQixRQUFJLENBQUNKLFNBQUwsRUFBZ0I1SCxxQkFBcUIsR0FBRytILFNBQXhCO0lBQ25CLEdBSEQ7O0lBS0EsV0FBU0UsUUFBVCxDQUFrQnRNLElBQWxCLEVBQXdCO0lBQ3BCLFVBQU11TSxhQUFhLEdBQUdsVCxNQUFNLENBQUMyUixLQUE3QjtJQUNBaEwsSUFBQUEsSUFBSSxHQUFHQSxJQUFJLElBQUksRUFBZjtJQUNBLFVBQU13TSxJQUFJLEdBQUd4TSxJQUFJLENBQUM3VyxNQUFMLEdBQWMsQ0FBM0I7SUFDQSxVQUFNd1MsSUFBSSxHQUFHeUUsVUFBVSxDQUFDLENBQUNvTSxJQUFJLEdBQUcsQ0FBUixJQUFhLENBQWQsQ0FBdkI7SUFDQTVOLElBQUFBLE1BQU0sQ0FBQ2pELElBQUksSUFBSSxDQUFULENBQU4sR0FBb0I2RyxtQkFBbUIsQ0FBQ2pKLFdBQUQsQ0FBdkM7O0lBQ0EsU0FBSyxJQUFJeE8sQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR3loQixJQUFwQixFQUEwQnpoQixDQUFDLEVBQTNCLEVBQStCO0lBQzNCNlQsTUFBQUEsTUFBTSxDQUFDLENBQUNqRCxJQUFJLElBQUksQ0FBVCxJQUFjNVEsQ0FBZixDQUFOLEdBQTBCeVgsbUJBQW1CLENBQUN4QyxJQUFJLENBQUNqVixDQUFDLEdBQUcsQ0FBTCxDQUFMLENBQTdDO0lBQ0g7O0lBQ0Q2VCxJQUFBQSxNQUFNLENBQUMsQ0FBQ2pELElBQUksSUFBSSxDQUFULElBQWM2USxJQUFmLENBQU4sR0FBNkIsQ0FBN0I7O0lBQ0EsUUFBSTtJQUNBLFlBQU1sUixHQUFHLEdBQUdpUixhQUFhLENBQUNDLElBQUQsRUFBTzdRLElBQVAsQ0FBekI7SUFDQVMsTUFBQUEsSUFBSSxDQUFDZCxHQUFELEVBQU0sSUFBTixDQUFKO0lBQ0EsYUFBT0EsR0FBUDtJQUNILEtBSkQsQ0FJRSxPQUFPL00sQ0FBUCxFQUFVO0lBQ1IsYUFBTzRZLGVBQWUsQ0FBQzVZLENBQUQsQ0FBdEI7SUFDSCxLQU5ELFNBTVU7SUFHVDtJQUNKOztJQUVELFdBQVM4ZCxHQUFULENBQWFyTSxJQUFiLEVBQW1CO0lBQ2ZBLElBQUFBLElBQUksR0FBR0EsSUFBSSxJQUFJMUcsVUFBZjs7SUFDQSxRQUFJOEssZUFBZSxHQUFHLENBQXRCLEVBQXlCO0lBQ3JCO0lBQ0g7O0lBQ0RYLElBQUFBLE1BQU07O0lBQ04sUUFBSVcsZUFBZSxHQUFHLENBQXRCLEVBQXlCO0lBQ3JCO0lBQ0g7O0lBRUQsYUFBU3FJLEtBQVQsR0FBaUI7SUFDYixVQUFJUixTQUFKLEVBQWU7SUFDZkEsTUFBQUEsU0FBUyxHQUFHLElBQVo7SUFDQTVTLE1BQUFBLE1BQU0sQ0FBQzRTLFNBQVAsR0FBbUIsSUFBbkI7SUFDQSxVQUFJM00sS0FBSixFQUFXO0lBQ1h1RSxNQUFBQSxXQUFXO0lBQ1hDLE1BQUFBLE9BQU87SUFDUCxVQUFJekssTUFBTSxDQUFDcVQsb0JBQVgsRUFBaUNyVCxNQUFNLENBQUNxVCxvQkFBUDtJQUNqQyxVQUFJQyxZQUFKLEVBQWtCTCxRQUFRLENBQUN0TSxJQUFELENBQVI7SUFDbEIrRCxNQUFBQSxPQUFPO0lBQ1Y7O0lBQ0QsUUFBSTFLLE1BQU0sQ0FBQ3VULFNBQVgsRUFBc0I7SUFDbEJ2VCxNQUFBQSxNQUFNLENBQUN1VCxTQUFQLENBQWlCLFlBQWpCO0lBQ0FDLE1BQUFBLFVBQVUsQ0FBQyxNQUFNO0lBQ2JBLFFBQUFBLFVBQVUsQ0FBQyxNQUFNO0lBQ2J4VCxVQUFBQSxNQUFNLENBQUN1VCxTQUFQLENBQWlCLEVBQWpCO0lBQ0gsU0FGUyxFQUVQLENBRk8sQ0FBVjtJQUdBSCxRQUFBQSxLQUFLO0lBQ1IsT0FMUyxFQUtQLENBTE8sQ0FBVjtJQU1ILEtBUkQsTUFRTztJQUNIQSxNQUFBQSxLQUFLO0lBQ1I7SUFDSjs7SUFDRHBULEVBQUFBLE1BQU0sQ0FBQ2dULEdBQVAsR0FBYUEsR0FBYjs7SUFFQSxXQUFTalEsSUFBVCxDQUFjM0MsTUFBZCxFQUFzQjtJQUNsQjhGLElBQUFBLFVBQVUsR0FBRzlGLE1BQWIsQ0FEa0I7O0lBTWxCcVQsSUFBQUEsUUFBUSxDQUFDclQsTUFBRCxDQUFSO0lBQ0g7O0lBRUQsV0FBU3FULFFBQVQsQ0FBa0JDLElBQWxCLEVBQXdCO0lBQ3BCeE4sSUFBQUEsVUFBVSxHQUFHd04sSUFBYjs7SUFDQSxRQUFJLENBQUM3USxnQkFBZ0IsRUFBckIsRUFBeUI7SUFDckIsVUFBSTdDLE1BQU0sQ0FBQzJULE1BQVgsRUFBbUIzVCxNQUFNLENBQUMyVCxNQUFQLENBQWNELElBQWQ7SUFDbkJ6TixNQUFBQSxLQUFLLEdBQUcsSUFBUjtJQUNIOztJQUNEOUYsSUFBQUEsS0FBSyxDQUFDdVQsSUFBRCxFQUFPLElBQUlyUyxVQUFKLENBQWVxUyxJQUFmLENBQVAsQ0FBTDtJQUNIOztJQUNELE1BQUkxVCxNQUFNLENBQUM0VCxPQUFYLEVBQW9CO0lBQ2hCLFFBQUksT0FBTzVULE1BQU0sQ0FBQzRULE9BQWQsS0FBMEIsVUFBOUIsRUFBMEM1VCxNQUFNLENBQUM0VCxPQUFQLEdBQWlCLENBQUM1VCxNQUFNLENBQUM0VCxPQUFSLENBQWpCOztJQUMxQyxXQUFPNVQsTUFBTSxDQUFDNFQsT0FBUCxDQUFlOWpCLE1BQWYsR0FBd0IsQ0FBL0IsRUFBa0M7SUFDOUJrUSxNQUFBQSxNQUFNLENBQUM0VCxPQUFQLENBQWVDLEdBQWY7SUFDSDtJQUNKOztJQUNELE1BQUlQLFlBQVksR0FBRyxJQUFuQjtJQUNBLE1BQUl0VCxNQUFNLENBQUM4VCxZQUFYLEVBQXlCUixZQUFZLEdBQUcsS0FBZjtJQUN6Qk4sRUFBQUEsR0FBRztJQUVILFNBQU9oVCxNQUFQO0lBQ0gsQ0EvN0JEOztJQ3JCQTs7Ozs7OztVQU1hK1Qsb0JBQW9CQztJQUN2QjVVLEVBQUFBLE1BQU07SUFFZDs7Ozs7SUFJQXhRLEVBQUFBO0lBQ0U7SUFDQSxTQUFLd1EsTUFBTCxHQUFjVyxtQkFBbUIsRUFBakM7O0lBQ0EsU0FBS1gsTUFBTCxDQUFZaVUsb0JBQVosR0FBbUM7SUFDakMsV0FBS1ksYUFBTCxDQUFtQixJQUFJQyxLQUFKLENBQVUsYUFBVixDQUFuQjtJQUNELEtBRkQ7SUFHRDtJQUVEOzs7Ozs7Ozs7SUFPT25qQixFQUFBQSxZQUFZLENBQUNvTyxJQUFELEVBQXNCRSxJQUF0QjtJQUNqQixXQUFPLElBQUlSLFVBQUosQ0FBZSxLQUFLTyxNQUFwQixFQUE0QkQsSUFBNUIsRUFBa0NFLElBQWxDLENBQVA7SUFDRDtJQUVEOzs7Ozs7Ozs7SUFPT2pPLEVBQUFBLGNBQWMsQ0FBQyxHQUFHdVYsSUFBSjtJQUNuQixXQUFPLEtBQUtoWCxZQUFMLENBQWtCLFlBQWxCLEVBQWdDLEdBQUdnWCxJQUFuQyxDQUFQO0lBQ0Q7O0lBRU0vVyxFQUFBQSxrQkFBa0IsQ0FBQyxHQUFHK1csSUFBSjtJQUN2QixXQUFPLEtBQUtoWCxZQUFMLENBQWtCLGdCQUFsQixFQUFvQyxHQUFHZ1gsSUFBdkMsQ0FBUDtJQUNEOztJQUVNelYsRUFBQUEsYUFBYSxDQUFDLEdBQUd5VixJQUFKO0lBQ2xCLFdBQU8sS0FBS2hYLFlBQUwsQ0FBa0IsV0FBbEIsRUFBK0IsR0FBR2dYLElBQWxDLENBQVA7SUFDRDs7SUFFTXJWLEVBQUFBLGNBQWMsQ0FBQyxHQUFHcVYsSUFBSjtJQUNuQixXQUFPLEtBQUtoWCxZQUFMLENBQWtCLFlBQWxCLEVBQWdDLEdBQUdnWCxJQUFuQyxDQUFQO0lBQ0Q7O0lBRU1oWCxFQUFBQSxZQUFZLENBQUN3a0IsUUFBRCxFQUFtQixHQUFHeE4sSUFBdEI7SUFDakIsVUFBTXlOLE9BQU8sR0FBR3pOLElBQUksQ0FBQzBOLEdBQUwsQ0FBVXJlLENBQUQsSUFBUUEsQ0FBQyxZQUFZNkksVUFBYixHQUEwQjdJLENBQUMsQ0FBQzZKLFVBQUYsRUFBMUIsR0FBMkM3SixDQUE1RCxDQUFoQjtJQUNBLFVBQU0wUSxRQUFRLEdBQUdDLElBQUksQ0FBQzBOLEdBQUwsQ0FBVXJlLENBQUQsSUFBUUEsQ0FBQyxZQUFZNkksVUFBYixHQUEwQixTQUExQixHQUFzQyxRQUF2RCxDQUFqQjtJQUNBLFdBQU8sS0FBS08sTUFBTCxDQUFZb0gsS0FBWixDQUFrQjJOLFFBQWxCLEVBQTRCLFFBQTVCLEVBQXNDek4sUUFBdEMsRUFBZ0QwTixPQUFoRCxDQUFQO0lBQ0Q7Ozs7VUMvRFVFO0lBQ0puaUIsRUFBQUEsQ0FBQztJQUVEQyxFQUFBQSxDQUFDOztJQUVSeEQsRUFBQUEsWUFBWTBELEtBQWEsR0FBR0MsS0FBYTtJQUN2QyxTQUFLSixDQUFMLEdBQVNHLEVBQVQ7SUFDQSxTQUFLRixDQUFMLEdBQVNHLEVBQVQ7SUFDRDs7SUFFTUUsRUFBQUEsR0FBRyxDQUFDTixDQUFELEVBQVlDLENBQVo7SUFDUixTQUFLRCxDQUFMLEdBQVNBLENBQVQ7SUFDQSxTQUFLQyxDQUFMLEdBQVNBLENBQVQ7SUFDQSxXQUFPLElBQVA7SUFDRDs7SUFFTU0sRUFBQUEsT0FBTztJQUNaLFdBQU8sS0FBS1AsQ0FBTCxJQUFVLEdBQVYsR0FBZ0IsS0FBS0MsQ0FBTCxJQUFVLEdBQWpDO0lBQ0Q7O0lBRU10QyxFQUFBQSxNQUFNO0lBQ1gsV0FBTzZDLElBQUksQ0FBQ0MsSUFBTCxDQUFVLEtBQUtGLE9BQUwsRUFBVixDQUFQO0lBQ0Q7O0lBRU1HLEVBQUFBLFFBQVEsQ0FBQ0MsQ0FBRDtJQUNiLFdBQU9ILElBQUksQ0FBQ0MsSUFBTCxDQUFVLENBQUMsS0FBS1QsQ0FBTCxHQUFTVyxDQUFDLENBQUNYLENBQVosS0FBa0IsQ0FBbEIsR0FBc0IsQ0FBQyxLQUFLQyxDQUFMLEdBQVNVLENBQUMsQ0FBQ1YsQ0FBWixLQUFrQixDQUFsRCxDQUFQO0lBQ0Q7O0lBRU1XLEVBQUFBLEdBQUcsQ0FBQ0QsQ0FBRDtJQUNSLFFBQUlBLENBQUMsWUFBWXdoQixPQUFqQixFQUEwQixPQUFPLElBQUlBLE9BQUosQ0FBWSxLQUFLbmlCLENBQUwsR0FBU1csQ0FBQyxDQUFDWCxDQUF2QixFQUEwQixLQUFLQyxDQUFMLEdBQVNVLENBQUMsQ0FBQ1YsQ0FBckMsQ0FBUDtJQUMxQixXQUFPLElBQUlraUIsT0FBSixDQUFZLEtBQUtuaUIsQ0FBTCxHQUFTVyxDQUFyQixFQUF3QixLQUFLVixDQUFMLEdBQVNVLENBQWpDLENBQVA7SUFDRDs7SUFFTUUsRUFBQUEsUUFBUSxDQUFDRixDQUFEO0lBQ2IsUUFBSUEsQ0FBQyxZQUFZd2hCLE9BQWpCLEVBQTBCLE9BQU8sSUFBSUEsT0FBSixDQUFZLEtBQUtuaUIsQ0FBTCxHQUFTVyxDQUFDLENBQUNYLENBQXZCLEVBQTBCLEtBQUtDLENBQUwsR0FBU1UsQ0FBQyxDQUFDVixDQUFyQyxDQUFQO0lBQzFCLFdBQU8sSUFBSWtpQixPQUFKLENBQVksS0FBS25pQixDQUFMLEdBQVNXLENBQXJCLEVBQXdCLEtBQUtWLENBQUwsR0FBU1UsQ0FBakMsQ0FBUDtJQUNEOztJQUVNRyxFQUFBQSxRQUFRLENBQUNILENBQUQ7SUFDYixRQUFJQSxDQUFDLFlBQVl3aEIsT0FBakIsRUFBMEIsT0FBTyxJQUFJQSxPQUFKLENBQVksS0FBS25pQixDQUFMLEdBQVNXLENBQUMsQ0FBQ1gsQ0FBdkIsRUFBMEIsS0FBS0MsQ0FBTCxHQUFTVSxDQUFDLENBQUNWLENBQXJDLENBQVA7SUFDMUIsV0FBTyxJQUFJa2lCLE9BQUosQ0FBWSxLQUFLbmlCLENBQUwsR0FBU1csQ0FBckIsRUFBd0IsS0FBS1YsQ0FBTCxHQUFTVSxDQUFqQyxDQUFQO0lBQ0Q7O0lBRU1JLEVBQUFBLE1BQU0sQ0FBQ0osQ0FBRDtJQUNYLFFBQUlBLENBQUMsWUFBWXdoQixPQUFqQixFQUEwQjtJQUN4QjlqQixNQUFBQSxPQUFPLENBQUMyQyxNQUFSLENBQWUsRUFBRUwsQ0FBQyxDQUFDWCxDQUFGLEtBQVEsQ0FBUixJQUFhVyxDQUFDLENBQUNWLENBQUYsS0FBUSxDQUF2QixDQUFmLEVBQTBDLHVCQUExQztJQUNBLGFBQU8sSUFBSWtpQixPQUFKLENBQVksS0FBS25pQixDQUFMLEdBQVNXLENBQUMsQ0FBQ1gsQ0FBdkIsRUFBMEIsS0FBS0MsQ0FBTCxHQUFTVSxDQUFDLENBQUNWLENBQXJDLENBQVA7SUFDRDs7SUFDRDVCLElBQUFBLE9BQU8sQ0FBQzJDLE1BQVIsQ0FBZUwsQ0FBQyxLQUFLLENBQXJCLEVBQXdCLHVCQUF4QjtJQUNBLFdBQU8sSUFBSXdoQixPQUFKLENBQVksS0FBS25pQixDQUFMLEdBQVNXLENBQXJCLEVBQXdCLEtBQUtWLENBQUwsR0FBU1UsQ0FBakMsQ0FBUDtJQUNEOztJQUVNTSxFQUFBQSxTQUFTO0lBQ2QsV0FBTyxLQUFLRixNQUFMLENBQVksS0FBS3BELE1BQUwsRUFBWixDQUFQO0lBQ0Q7O0lBRU11RCxFQUFBQSxHQUFHLENBQUNQLENBQUQ7SUFDUixXQUFPLEtBQUtYLENBQUwsR0FBU1csQ0FBQyxDQUFDWCxDQUFYLEdBQWUsS0FBS0MsQ0FBTCxHQUFTVSxDQUFDLENBQUNWLENBQWpDO0lBQ0Q7O0lBRU1tQixFQUFBQSxLQUFLLENBQUNULENBQUQ7SUFDVixXQUFPLEtBQUtYLENBQUwsS0FBV1csQ0FBQyxDQUFDWCxDQUFiLElBQWtCLEtBQUtDLENBQUwsS0FBV1UsQ0FBQyxDQUFDVixDQUF0QztJQUNEOztJQUVNb0IsRUFBQUEsSUFBSTtJQUNULFdBQU8sSUFBSThnQixPQUFKLENBQVksS0FBS25pQixDQUFqQixFQUFvQixLQUFLQyxDQUF6QixDQUFQO0lBQ0Q7O0lBRU1xQixFQUFBQSxRQUFRO0lBQ2IsV0FBTyxJQUFJQyxZQUFKLENBQWlCLENBQUMsS0FBS3ZCLENBQU4sRUFBUyxLQUFLQyxDQUFkLENBQWpCLENBQVA7SUFDRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
