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
//
// Read at call time, not module load: this file (via UploadsModule) is
// imported before AppModule's ConfigModule.forRoot() call actually runs (JS
// hoists all of a module's own imports above its body), so a FFMPEG_PATH set
// only in api/.env — as opposed to already exported by the parent process —
// would otherwise still be unset when a module-level constant read it.
function resolveFfmpegPath(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

/** Extract a lightweight poster without making browser clients download the video first. */
export async function extractVideoThumbnail(input: Buffer): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "liberia360-video-"));
  const inputPath = join(directory, "input-video");
  const outputPath = join(directory, "poster.jpg");
  try {
    await writeFile(inputPath, input);
    await execFileAsync(
      resolveFfmpegPath(),
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
