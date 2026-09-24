import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function withExtension(base) {
  for (const ext of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = withExtension(path.join(SRC, specifier.slice(2)));
    if (found) return nextResolve(pathToFileURL(found).href, context);
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
    const found = withExtension(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }
  return nextResolve(specifier, context);
}
