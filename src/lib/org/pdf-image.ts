/**
 * Kompresia canvasu do JPEG pre viacstránkové PDF, aby neskončili na stovkách MB.
 * A4 landscape pri ~180 dpi je cca 2100 px na dlhšej strane – viac už len nafukuje súbor.
 */
export function canvasToFitJpeg(
  source: HTMLCanvasElement,
  maxEdgePx = 2200,
  quality = 0.8,
): { dataUrl: string; width: number; height: number } {
  const longest = Math.max(source.width, source.height, 1);
  const scale = Math.min(1, maxEdgePx / longest);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  if (width === source.width && height === source.height) {
    return { dataUrl: source.toDataURL("image/jpeg", quality), width, height };
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    return { dataUrl: source.toDataURL("image/jpeg", quality), width: source.width, height: source.height };
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return { dataUrl: out.toDataURL("image/jpeg", quality), width, height };
}
