"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FileView } from "./file";

export function FileTree({ files }: { files: string[] }) {
  const [current, setCurrent] = useState<string | null>(null);

  const params = useSearchParams();
  const file = params.get("file");

  return (
    <div className="bg-gray-900 overflow-y-scroll max-h-screen">
      {files.map((file, index) => (
        <Link
          key={index}
          className={
            (current === file ? "bg-gray-800 " : "") +
            "block px-4 py-2 hover:bg-gray-800 transition-all "
          }
          href={`?file=${file}`}
          onClick={() => setCurrent(file)}
        >
          {file}
        </Link>
      ))}
      <Suspense>{file && <FileView file={file} />}</Suspense>
    </div>
  );
}
