import fs from "fs";
import http from "https";
import sharp from "sharp";
import { ImageData } from "ssim.js/dist/types";

/**
 * If `limit` is set, it will return proportional dimensions to `width` and `height` with the
 * smallest dimesion limited to `limit`.
 */
export function getLimitDimensions(
  width: number,
  height: number,
  limit?: number
) {
  if (limit && width >= limit && height >= limit) {
    const ratio = width / height;

    if (ratio > 1) {
      return { height: limit, width: Math.round(limit / ratio) };
    }
    return { height: Math.round(limit * ratio), width: limit };
  }
  return { width, height };
}

/**
 * Parses the buffer data and returns it. If `limit` is set, it will make sure the smallest dimesion
 * will at most be of size `limit`.
 */
async function parse(data: Buffer, limit: number): Promise<ImageData> {
  return sharp(data)
    .raw()
    .toBuffer()
    .then((data) => {
      const uint8Array = new Uint8ClampedArray(
        data.buffer,
        data.byteOffset,
        data.byteLength
      );
      return { data: uint8Array, width: 1280, height: 720 };
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });

  // const { ext = "" } = (await imageType(data)) || {};
  // console.log(ext);

  // return new Promise((resolve, reject) => {
  //   sharp({});
  //   Canvas.loadImage(data)
  //     .then((img) => {
  //       const { width, height } = getLimitDimensions(
  //         img.width,
  //         img.height,
  //         limit
  //       );
  //       const canvas = Canvas.createCanvas(width, height);
  //       const ctx = canvas.getContext("2d");

  //       ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);

  //       return ctx.getImageData(0, 0, width, height) as unknown as ImageData;
  //     })
  //     .then(resolve)
  //     .catch(reject);
  // });
}

function loadUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    http
      .get(url)
      .on("response", (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (data) => chunks.push(data));
        res.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      })
      .on("error", reject);
  });
}

function loadFs(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data);
    });
  });
}

export function getImageData(
  url: string | Buffer,
  limit = 0
): Promise<ImageData> {
  let bufferPromise;

  if (Buffer.isBuffer(url)) {
    bufferPromise = Promise.resolve(url);
  } else if (typeof url === "string" && url.startsWith("http")) {
    bufferPromise = loadUrl(url);
  } else if (typeof url === "string") {
    bufferPromise = loadFs(url);
  } else {
    throw new Error("Invalid format used");
  }
  return bufferPromise.then((bufferData) => parse(bufferData, limit));
}
