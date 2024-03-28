/**
 * Copyright 2015 Igor Bezkrovny
 * All rights reserved. (MIT Licensed)
 */

import { SERVER_URL } from "./constants";
import { getDiffPath, getMime } from "./utils";

export type CompareParams = {
  path1: string;
  path2: string;
};

export type CompareResult = {
  ssim: number;
  mcs: number;
};

type SsimInput = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
};

type Options = {
  windowSize?: number;
  K1?: number;
  K2?: number;
  luminance?: boolean;
  bitsPerComponent?: number;
};

function iterate(
  image1: SsimInput,
  image2: SsimInput,
  windowSize: number,
  luminance: boolean,
  callback: (
    lumaValues1: Float32Array,
    lumaValues2: Float32Array,
    averageLumaValue1: number,
    averageLumaValue2: number
  ) => void
): void {
  let width = image1.width;
  let height = image1.height;

  for (let y = 0; y < height; y += windowSize) {
    for (let x = 0; x < width; x += windowSize) {
      // avoid out-of-width/height
      let windowWidth = Math.min(windowSize, width - x);
      let windowHeight = Math.min(windowSize, height - y);

      let lumaValues1 = lumaValuesForWindow(
          image1,
          x,
          y,
          windowWidth,
          windowHeight,
          luminance
        ),
        lumaValues2 = lumaValuesForWindow(
          image2,
          x,
          y,
          windowWidth,
          windowHeight,
          luminance
        ),
        averageLuma1 = averageLuma(lumaValues1),
        averageLuma2 = averageLuma(lumaValues2);

      callback(lumaValues1, lumaValues2, averageLuma1, averageLuma2);
    }
  }
}

function lumaValuesForWindow(
  image: SsimInput,
  x: number,
  y: number,
  width: number,
  height: number,
  luminance: boolean
) {
  let array = image.data;
  let lumaValues = new Float32Array(new ArrayBuffer(width * height * 4));
  let counter = 0;
  let maxj = y + height;

  for (let j = y; j < maxj; j++) {
    let offset = j * image.width;
    let i = (offset + x) * image.channels;
    let maxi = (offset + x + width) * image.channels;

    switch (image.channels) {
      case 1:
        while (i < maxi) {
          // (0.212655 +  0.715158 + 0.072187) === 1
          lumaValues[counter++] = array[i++];
        }
        break;
      case 2:
        while (i < maxi) {
          lumaValues[counter++] = array[i++] * (array[i++] / 255);
        }
        break;
      case 3:
        if (luminance) {
          while (i < maxi) {
            lumaValues[counter++] =
              array[i++] * 0.212655 +
              array[i++] * 0.715158 +
              array[i++] * 0.072187;
          }
        } else {
          while (i < maxi) {
            lumaValues[counter++] = array[i++] + array[i++] + array[i++];
          }
        }
        break;
      case 4:
        if (luminance) {
          while (i < maxi) {
            lumaValues[counter++] =
              (array[i++] * 0.212655 +
                array[i++] * 0.715158 +
                array[i++] * 0.072187) *
              (array[i++] / 255);
          }
        } else {
          while (i < maxi) {
            lumaValues[counter++] =
              (array[i++] + array[i++] + array[i++]) * (array[i++] / 255);
          }
        }
        break;
    }
  }

  return lumaValues;
}

function averageLuma(lumaValues: Float32Array) {
  let sumLuma = 0.0;
  for (let i = 0; i < lumaValues.length; i++) {
    sumLuma += lumaValues[i];
  }
  return sumLuma / lumaValues.length;
}

function getSsimResult(
  image1: SsimInput,
  image2: SsimInput,
  {
    windowSize = 8,
    K1 = 0.01,
    K2 = 0.03,
    luminance = true,
    bitsPerComponent = 8,
  }: Options = {}
): CompareResult {
  if (image1.width !== image2.width || image1.height !== image2.height) {
    return { ssim: 0, mcs: 0 };
  }

  let L = (1 << bitsPerComponent) - 1;

  let c1 = Math.pow(K1 * L, 2);
  let c2 = Math.pow(K2 * L, 2);
  let numWindows = 0;
  let mssim = 0.0;
  let mcs = 0.0;

  function iteration(
    lumaValues1: Float32Array,
    lumaValues2: Float32Array,
    averageLumaValue1: number,
    averageLumaValue2: number
  ): void {
    // calculate letiance and coletiance
    let sigxy = 0.0;
    let sigsqx = 0.0;
    let sigsqy = 0.0;

    for (let i = 0; i < lumaValues1.length; i++) {
      sigsqx += Math.pow(lumaValues1[i] - averageLumaValue1, 2);
      sigsqy += Math.pow(lumaValues2[i] - averageLumaValue2, 2);
      sigxy +=
        (lumaValues1[i] - averageLumaValue1) *
        (lumaValues2[i] - averageLumaValue2);
    }

    let numPixelsInWin = lumaValues1.length - 1;
    sigsqx /= numPixelsInWin;
    sigsqy /= numPixelsInWin;
    sigxy /= numPixelsInWin;

    // perform ssim calculation on window
    let numerator =
      (2 * averageLumaValue1 * averageLumaValue2 + c1) * (2 * sigxy + c2);

    let denominator =
      (Math.pow(averageLumaValue1, 2) + Math.pow(averageLumaValue2, 2) + c1) *
      (sigsqx + sigsqy + c2);

    mssim += numerator / denominator;
    mcs += (2 * sigxy + c2) / (sigsqx + sigsqy + c2);

    numWindows++;
  }

  // calculate SSIM for each window
  iterate(image1, image2, windowSize, luminance, iteration);

  return { ssim: mssim / numWindows, mcs: mcs / numWindows };
}

function loadImage(path: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = `${SERVER_URL}/image?path=${path}`;
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = (e) => {
      reject(new Error(`Could not load ${url}, ${e}`));
    };
    image.src = url;
  });
}

function getImageData(image: HTMLImageElement) {
  const { width, height } = image;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("Could not get 2d context");
  }
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  return { data, width, height, channels: 3 as const };
}

function dataUrlToBlob(dataUrl: string) {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return u8arr;
}

function getDiff(
  mime: string,
  image1: HTMLImageElement,
  image2: HTMLImageElement
) {
  const canvas = document.createElement("canvas");
  canvas.width = image1.width;
  canvas.height = image1.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx === null) {
    throw new Error("Could not get 2d context");
  }

  ctx.drawImage(image2, 0, 0);
  const imgData2 = ctx.getImageData(0, 0, canvas.width, canvas.height);

  ctx.drawImage(image1, 0, 0);
  const imgData1 = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const overlayData = ctx.createImageData(canvas.width, canvas.height);

  const scaleFactor = 1;
  for (var i = 0; i < imgData1.data.length; i += 4) {
    const diff = Math.abs(imgData1.data[i] - imgData2.data[i]);
    overlayData.data[i] = diff * scaleFactor; // Red
    overlayData.data[i + 1] = 0;
    overlayData.data[i + 2] = 0;
    overlayData.data[i + 3] = 255;
  }

  // ctx.globalCompositeOperation = "difference";
  ctx.putImageData(overlayData, 0, 0);

  const dataUrl = canvas.toDataURL(mime);
  return dataUrlToBlob(dataUrl);
}

function putImage(path: string, body: Uint8Array) {
  return fetch(`${SERVER_URL}/image?path=${path}`, { method: "POST", body });
}

function compare({ path1, path2 }: CompareParams) {
  return Promise.all([loadImage(path1), loadImage(path2)]).then(
    async ([image1, image2]) => {
      const path = getDiffPath(path1);
      await putImage(path, getDiff(getMime(path1), image1, image2));
      return getSsimResult(getImageData(image1), getImageData(image2));
    }
  );
}

window.compare = compare;
