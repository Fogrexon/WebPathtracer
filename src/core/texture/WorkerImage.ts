export const loadWorkerImage = async (url: string) => {
  const imageResponse = await fetch(url);
  const imageBlob = await imageResponse.blob();
  return createImageBitmap(imageBlob);
};
