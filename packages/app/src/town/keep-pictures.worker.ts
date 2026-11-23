/**
 * Encodes Chess Town's kept pictures' pages as PNG off the main thread (keep-pictures.ts `domSaveIO`): a page comes in as an ImageBitmap
 * and goes back as a Blob, its pixels exactly as painted (PNG is lossless).
 */
self.onmessage = async (e: MessageEvent<{ id: number; page: ImageBitmap }>) => {
  const { id, page } = e.data;
  try {
    const c = new OffscreenCanvas(page.width, page.height);
    c.getContext("2d")!.drawImage(page, 0, 0);
    page.close();
    const blob = await c.convertToBlob({ type: "image/png" });
    self.postMessage({ id, blob });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
