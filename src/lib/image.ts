/** 读取 File 为 dataURL。 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * 把图片文件压缩为 dataURL 后返回:
 * - 限制最长边不超过 maxDimension(等比缩放),导出 JPEG/PNG;SVG 原样保留;
 * - 若压缩结果反而比原图大(小图/纯色图),回退返回原图。
 * 用于侧栏图标、计时器背景图等需要存进 localStorage 的场景,避免 base64 撑爆配额。
 */
export async function compressImageFile(file: File, maxDimension: number, quality = 0.85): Promise<string> {
  const original = await readFileAsDataUrl(file);
  if (file.type === "image/svg+xml") return original;

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(1, image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas 不可用");
        context.drawImage(image, 0, 0, width, height);
        // PNG(可能有透明通道)用无损导出;其余(JPEG/WEBP 等)导出 JPEG。
        const exportType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressed = canvas.toDataURL(exportType, quality);
        resolve(compressed.length < original.length ? compressed : original);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("图片解码失败"));
    image.src = original;
  });
}
