import { join } from "path";

// Single source of truth for where local-disk uploads live — shared by
// main.ts (which serves this directory statically at /uploads) and
// LocalStorageProvider (which writes into it). Resolved from the process's
// working directory rather than __dirname so both agree on the same
// physical folder whether this is running under ts-node in dev or from
// compiled dist/ in prod (`__dirname` differs between the two; `cwd()`
// doesn't, since both are always started from the package root).
export function localUploadsDir(): string {
  return join(process.cwd(), "uploads");
}
