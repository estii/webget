"use client";

import { use } from "react";

type FileInfo = {
  file: string;
};

const cache = new Map<string, Promise<any>>();
function getFile(file: string) {
  const existing = cache.get(file);
  if (existing) return existing;
  const promise = fetch(`/api?file=${file}`).then(
    (res) => res.json() as Promise<FileInfo>
  );
  cache.set(file, promise);
  return promise;
}

export async function FileView({ file }: { file: string }) {
  const info = use(getFile(file));
  console.log(info);
  return <div className="p-4">{file}</div>;
}
