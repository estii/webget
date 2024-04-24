import { customAlphabet } from "nanoid";

export function getOutputType(path: string) {
  if (path.endsWith(".png")) {
    return "png";
  }
  if (path.endsWith(".jpg")) {
    return "jpeg";
  }
  throw new Error(`Invalid file type ${path}`);
}

export function getDiffPath(path: string) {
  const index = path.lastIndexOf(".");
  return path.slice(0, index) + ".diff" + path.slice(index);
}

export function getMime(path: string) {
  const type = getOutputType(path);
  return `image/${type}` as const;
}

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const getId = customAlphabet(alphabet, 8);

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

export function getImageType(path: string) {
  if (path.endsWith(".png")) {
    return "png";
  }
  if (path.endsWith(".jpg")) {
    return "jpeg";
  }
  throw new Error(`Invalid file type ${path}`);
}
