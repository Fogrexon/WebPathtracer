import { GLTFJson } from "../types/gltf";

/**
 * glTF model data
 * 
 * @export
 * @class GLTFLoader
 */
export class GLTFLoader {
  private rawUrl: string | null = null;

  private rawJson: GLTFJson | null = null;

  private _position: Float32Array = new Float32Array();

  private _normal: Float32Array = new Float32Array();

  private _texcoord: Float32Array = new Float32Array();

  private _indicies: Int16Array = new Int16Array();

  // private _transformMatrix: Matrix4 = new Matrix4();


  
  /**
   * load glTF
   *
   * @param {string} url GLTFのURL
   * @memberof GLTFLoader
   */
  public async load(url: string) {
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
  private async analize() {
    if (!this.rawJson) return;
    // first node only
    const {
      nodes,
      meshes,
      accessors,
      bufferViews,
      buffers,
    } = this.rawJson;

    if (!Array.isArray(nodes) || !Array.isArray(meshes) || !Array.isArray(accessors) || !Array.isArray(bufferViews) || !Array.isArray(buffers)) return;

    const [bufPos, bufNorm, bufTex, bufInd] = bufferViews;
    const [{uri}] = buffers;

    const response = await fetch(uri);
    const buffer = await (await response.blob()).arrayBuffer();

    this._position = new Float32Array(
      buffer.slice(bufPos.byteOffset, bufPos.byteOffset + bufPos.byteLength)
    );

    this._normal = new Float32Array(
      buffer.slice(bufNorm.byteOffset, bufNorm.byteOffset + bufNorm.byteLength)
    );

    this._texcoord = new Float32Array(
      buffer.slice(bufTex.byteOffset, bufTex.byteOffset + bufTex.byteLength)
    );

    this._indicies = new Int16Array(
      buffer.slice(bufInd.byteOffset, bufInd.byteOffset + bufInd.byteLength)
    );
  }
}