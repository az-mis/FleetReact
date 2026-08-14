/**
 * Downscales + compresses an image file into a small square JPEG, returned as
 * a base64 data URL. Used for admin/driver avatar thumbnails, which are
 * stored inline on the Firestore user doc (this project has no Firebase
 * Storage — see AppUser.photoURL in types.ts) so the result needs to stay
 * comfortably small — well under Firestore's 1 MiB document limit.
 */
export function compressImageToDataURL(file: File, size = 160, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like a valid image."));
      img.onload = () => {
        // Center-crop to a square, then scale down to `size`x`size`.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing isn't supported in this browser."));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
