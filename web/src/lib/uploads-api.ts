import { HttpError } from "./http";

const API_URL = "/api/v1";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // matches api/src/uploads/uploads.controller.ts
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** POST /uploads/image — multipart, so this bypasses http.ts's apiRequest
 * (which always sets Content-Type: application/json); the browser sets its
 * own multipart boundary as long as no Content-Type header is set here. */
export async function uploadImage(token: string, file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new HttpError(
      400,
      "Only JPEG, PNG, WebP, or GIF images are allowed.",
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new HttpError(400, "Image is larger than 8MB.");
  }

  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${API_URL}/uploads/image`, {
    method: "POST",
    credentials: "same-origin",
    body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { message?: unknown } | null)?.message;
    throw new HttpError(
      res.status,
      typeof message === "string"
        ? message
        : `Upload failed with ${res.status}`,
    );
  }
  return (data as { url: string }).url;
}
