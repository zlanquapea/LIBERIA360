import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Prefer an explicitly configured binary in hosted environments and otherwise
// use the operating system's ffmpeg. The previous ffmpeg-static package ran a
// postinstall download from GitHub, which made `npm ci` (and therefore every
// CI/deploy build) fail whenever that release host was unavailable or blocked.
const ffmpegPath = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

/** Extract a lightweight poster without making browser clients download the video first. */
export async function extractVideoThumbnail(input: Buffer): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "liberia360-video-"));
  const inputPath = join(directory, "input-video");
  const outputPath = join(directory, "poster.jpg");
  try {
    await writeFile(inputPath, input);
    await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.5",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=720:-2:force_original_aspect_ratio=decrease",
        "-q:v",
        "5",
        outputPath,
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
