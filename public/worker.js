self.importScripts('../build/umd/pathtracer.js');

const renderer = (canvas, image) => {
  // Wasmロード
  const wasmManager = new PathTracer.WasmManager();
  // テクスチャ作成
  const texture = new PathTracer.Texture(image);

  // Wasmのロードが終わり次第
  wasmManager.addEventListener('initialized', async () => {
    // 壁
    const boxModel = new PathTracer.GLTFLoader(
      new PathTracer.Diffuse(new PathTracer.Vector3(1.0, 1.0, 1.0), texture),
      // new PathTracer.Glass(1.5),
    );
    // boxModel.transform.rotation.angleAxis(Math.PI * 0.25, new PathTracer.Vector3(0, 1, 0));

    const rabbitModel = new PathTracer.GLTFLoader(
      new PathTracer.Diffuse(new PathTracer.Vector3(1.0, 1.0, 1.0)),
      // new PathTracer.Glass(1.5),
    );
    rabbitModel.transform.position.set(0.5, 0, 0);

    const glassModel = new PathTracer.GLTFLoader(
      new PathTracer.Glass(1.1),
    )
    glassModel.transform.position.set(-0.5, 0, 0);
    
    // モデルのロード
    Promise.all([boxModel.load('box.gltf'), rabbitModel.load('rabbit.gltf'), glassModel.load('sphere.gltf')]).then(() => {
      
      // レンダラを用意
      const renderer = new PathTracer.Renderer(wasmManager);

      // BVH(衝突判定用のデータ構造)
      renderer.createBound(boxModel);
      renderer.createBound(rabbitModel);
      renderer.createBound(glassModel);

      // カメラ
      const cam = new PathTracer.Camera(Math.PI * 0.5);
      
      // カメラを回転
      const rotate = Math.PI * 2 * Math.random();
      cam.pos = new PathTracer.Vector3(2 * Math.cos(rotate), 1, 2 * Math.sin(rotate));
      cam.lookAt(new PathTracer.Vector3(0.0, 0.0, 0.0));
      // レンダリング(時間がかかる)
      renderer.render(canvas, cam)
      .then(() => {
        // バッファの開放
        renderer.release();
        boxModel.release();
        rabbitModel.release();
        texture.release();
        renderer.release();
        self.postMessage({});
      });
    });

  });
}

self.addEventListener('message', async (event) => {
  const image = await PathTracer.loadWorkerImage('./uv.png');
  const canvas = event.data.canvas;

  renderer(canvas, image);
})
