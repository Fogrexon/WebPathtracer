import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";
import { GLTFJson } from "../../types/gltf";
import { Model } from "./Model";

/**
 * glTF model data
 * 
 * @export
 * @class GLTFLoader
 */
export class GLTFLoader extends Model {
  private rawUrl: string | null = null;

  private rawJson: GLTFJson | null = null;

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

    if (!Array.isArray(nodes) || !Array.isArray(meshes) || !Array.isArray(accessors) || !Array.isArray(bufferViews) || !Array.isArray(buffers)) throw new Error("tttt");;
    
    const [node] = nodes;
    const [bufPos, bufNorm, bufTex, bufInd] = bufferViews;
    const [{uri}] = buffers;

    if(!node.translation || !node.rotation || !node.scale) {
      node.translation = [1, 0, 0, 0];
      node.rotation = [0, 0, 0];
      node.scale = [0, 0, 0];
    }

    const translate = (new Matrix4()).translateMatrix(new Vector3(node.translation[0], node.translation[1], node.translation[2]));
    const scale = (new Matrix4()).scaleMatrix(new Vector3(node.scale[0], node.scale[1], node.scale[2]));
    const rotation = (new Quaternion(new Vector3(node.rotation[0], node.rotation[1], node.rotation[2]), node.rotation[3])).matrix();

    this._matrix = translate.multiply(rotation.multiply(scale)) as Matrix4;

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

    this._indicies = Int32Array.from(new Int16Array(
      buffer.slice(bufInd.byteOffset, bufInd.byteOffset + bufInd.byteLength)
    ));
  }
}