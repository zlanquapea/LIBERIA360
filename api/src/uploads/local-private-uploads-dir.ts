import { join } from "path";

// Where LocalStorageProvider.savePrivate()/readPrivate() keep files that
// must NOT be reachable without going through an authorization check — a
// sibling of localUploadsDir(), never passed to app.useStaticAssets(), so
// main.ts never serves this directory over HTTP the way it does /uploads.
export function localPrivateUploadsDir(): string {
  return join(process.cwd(), "private-uploads");
}
