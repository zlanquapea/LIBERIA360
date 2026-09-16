import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Extract a lightweight poster without making browser clients download the video first. */
export async function extractVideoThumbnail(input: Buffer): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("FFmpeg is not available");
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
