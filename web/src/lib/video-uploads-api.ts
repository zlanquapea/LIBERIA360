import { HttpError } from "./http";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
];

export function isSupportedVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_MIME_TYPES.includes(file.type);
}

export function validateVideoFile(file: File): void {
  if (!isSupportedVideoFile(file)) {
    throw new HttpError(
      400,
      "Only MP4, WebM, QuickTime, or Ogg videos are allowed.",
    );
  }
  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new HttpError(400, "Video is larger than 50MB.");
  }
}

/** Upload a creator video while exposing progress for mobile-friendly feedback. */
export function uploadVideo(
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  validateVideoFile(file);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}/uploads/video`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () =>
      reject(
        new HttpError(0, "Upload failed. Check your connection and try again."),
      ),
    );
    request.addEventListener("abort", () =>
      reject(new HttpError(0, "Upload cancelled.")),
    );
    request.addEventListener("load", () => {
      let data: unknown = null;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        // The status code below still gives the user a useful failure state.
      }
      if (request.status < 200 || request.status >= 300) {
        const message = (data as { message?: unknown } | null)?.message;
        reject(
          new HttpError(
            request.status,
            typeof message === "string"
              ? message
              : `Upload failed with ${request.status}`,
          ),
        );
        return;
      }
      const url = (data as { url?: unknown } | null)?.url;
      if (typeof url !== "string" || !url) {
        reject(
          new HttpError(502, "Upload completed without a usable video URL."),
        );
        return;
      }
      resolve(url);
    });
    const body = new FormData();
    body.append("file", file);
    request.send(body);
  });
}
