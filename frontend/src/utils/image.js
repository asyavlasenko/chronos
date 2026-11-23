const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 0.86;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const AVATAR_ACCEPT = ALLOWED_TYPES.join(',');

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не вдалося прочитати зображення'));
    };
    image.src = url;
  });
}

export async function toAvatarDataUrl(file) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Обери зображення PNG, JPEG або WebP');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Файл завеликий: до 12 МБ');

  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const left = (image.naturalWidth - side) / 2;
  const top = (image.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  canvas.getContext('2d').drawImage(image, left, top, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY);
}
