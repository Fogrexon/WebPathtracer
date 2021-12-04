(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.PathTracer = {}));
})(this, (function (exports) { 'use strict';

    /**
     * glTF model data
     *
     * @export
     * @class GLTFLoader
     */
    class GLTFLoader {
      rawUrl = null;
      rawJson = null;
      _position = new Float32Array();
      _normal = new Float32Array();
      _texcoord = new Float32Array();
      _indicies = new Int16Array(); // private _transformMatrix: Matrix4 = new Matrix4();

      /**
       * load glTF
       *
       * @param {string} url GLTFのURL
       * @memberof GLTFLoader
       */

      async load(url) {
        this.rawUrl = url;
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
        if (!Array.isArray(nodes) || !Array.isArray(meshes) || !Array.isArray(accessors) || !Array.isArray(bufferViews) || !Array.isArray(buffers)) return;
        const [bufPos, bufNorm, bufTex, bufInd] = bufferViews;
        const [{
          uri
        }] = buffers;
        const response = await fetch(uri);
        const buffer = await (await response.blob()).arrayBuffer();
        this._position = new Float32Array(buffer.slice(bufPos.byteOffset, bufPos.byteOffset + bufPos.byteLength));
        this._normal = new Float32Array(buffer.slice(bufNorm.byteOffset, bufNorm.byteOffset + bufNorm.byteLength));
        this._texcoord = new Float32Array(buffer.slice(bufTex.byteOffset, bufTex.byteOffset + bufTex.byteLength));
        this._indicies = new Int16Array(buffer.slice(bufInd.byteOffset, bufInd.byteOffset + bufInd.byteLength));
      }

    }

    exports.GLTFLoader = GLTFLoader;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=pathtracer.js.map
