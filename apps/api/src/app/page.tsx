import { globSync } from "glob";
import { FileTree } from "./files";

function getFiles() {
  return globSync("doc/**/*.png.ts", { cwd: "/Users/dpeek/code/estii" });
}

export default function Page() {
  const files = getFiles();
  console.log(files);
  return (
    <div className="bg-gray-700">
      <FileTree files={files} />
    </div>
  );
}
