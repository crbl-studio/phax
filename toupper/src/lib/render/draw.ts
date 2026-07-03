import type { ImageInsertion } from "$lib/drinfo";

export const drawSquares = (
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size = 20,
) => {
  let x = 0;
  let y = 0;
  let white = true;
  let firstWhite;
  while (y < context.canvas.height) {
    firstWhite = white;
    while (x < context.canvas.width) {
      context.fillStyle = white ? "#ffffff" : "#aaaaaa";
      white = !white;
      context.fillRect(x, y, size, size);
      x += size;
    }
    white = !firstWhite;
    x = 0;
    y += size;
  }
};

export const drawImage = (
  image: HTMLImageElement,
  imageInsertion: ImageInsertion,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  const centerX = Math.round(
    (imageInsertion.point.x * 2 + image.width * imageInsertion.scale.x) / 2,
  );
  const centerY = Math.round(
    (imageInsertion.point.y * 2 + image.height * imageInsertion.scale.y) / 2,
  );
  context.translate(centerX, centerY);
  context.rotate((imageInsertion.rotate * Math.PI * 2) / (2 ** 32 - 1));
  context.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    (-image.width * imageInsertion.scale.x) / 2,
    (-image.height * imageInsertion.scale.y) / 2,
    image.width * imageInsertion.scale.x,
    image.height * imageInsertion.scale.y,
  );
  context.resetTransform();
};
