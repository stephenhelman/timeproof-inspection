// Zero-dependency ESM resolve hook for the bot test harness.
//
// Node 24 strips TypeScript types natively, but raw Node ESM still requires
// explicit file extensions on relative imports. Our src/lib/bot-v2 modules use
// extensionless imports (so `next build`/tsc — which forbids `.ts` import
// extensions without allowImportingTsExtensions — stays happy). This hook lets
// raw Node resolve those extensionless relative specifiers to their `.ts` files.
//
// It is a `.mjs` file, so tsconfig (`**/*.ts`) never typechecks it and the Next
// build never touches it. Registered via:
//   node --import ./harness/load-ts.mjs harness/bot-test.ts <fixture>

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Project root = the directory containing this harness/ folder.
const PROJECT_ROOT = new URL("../", import.meta.url);

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function isDir(url) {
  try {
    return statSync(fileURLToPath(url)).isDirectory();
  } catch {
    return false;
  }
}

// Resolve a candidate URL to a real file: as-is if it's a file, else with a
// `.ts` extension, else (if it's a directory) its `index.ts`. Returns a resolved
// hook result or null.
function resolveWithTs(url) {
  if (isFile(url)) return { url: url.href, shortCircuit: true };
  const tsUrl = new URL(url.href + ".ts");
  if (isFile(tsUrl)) return { url: tsUrl.href, shortCircuit: true };
  if (isDir(url)) {
    const indexUrl = new URL(url.href.replace(/\/?$/, "/") + "index.ts");
    if (isFile(indexUrl)) return { url: indexUrl.href, shortCircuit: true };
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // `@/...` path alias (tsconfig: "@/*" -> "./*", i.e. project root). Lets the
    // harness import real app modules (lib/conversation, lib/prisma) that use the
    // alias, the same way Next/tsc resolve it.
    if (specifier.startsWith("@/")) {
      const target = new URL(specifier.slice(2), PROJECT_ROOT);
      const resolved = resolveWithTs(target);
      if (resolved) return resolved;
      // fall through to default resolution (e.g. real "@scope/pkg" packages)
    }

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        const tsUrl = new URL(specifier + ".ts", context.parentURL);
        if (existsSync(fileURLToPath(tsUrl))) {
          return { url: tsUrl.href, shortCircuit: true };
        }
        throw err;
      }
    }
    return nextResolve(specifier, context);
  },
});
