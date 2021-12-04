export class GLTFLoader {
  private rawUrl: string = '';
  private rawJson: Object = {};

  public async load(url) {
    this.rawUrl = url;
    fetch(url)
      .then((response) => {
        if (response.headers)
        return response.json()
      })
  }
}