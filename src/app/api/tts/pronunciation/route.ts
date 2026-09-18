import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { requestIp } from "@lib/auth/email-send-rate-limit";
import { consumeTtsRequest } from "@lib/tts/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 256;
const MAX_AUDIO_BYTES = 2_000_000;

function isWav(audio: Buffer) {
  return audio.length > 44 && audio.length <= MAX_AUDIO_BYTES &&
    audio.toString("ascii", 0, 4) === "RIFF" && audio.toString("ascii", 8, 12) === "WAVE";
}

async function readSmallJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

async function generateWav(word: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "dictionary-tts-"));
  try {
    const output = join(directory, "speech.wav");
    try {
      await execFileAsync("pico2wave", ["-l", "en-US", "-w", output, word], { timeout: 8_000 });
      const wav = await readFile(output);
      if (isWav(wav)) return wav;
    } catch {
      // eSpeak is the local fallback when Pico is unavailable.
    }
    for (const command of ["espeak-ng", "espeak"]) {
      try {
        const { stdout } = await execFileAsync(command, ["-v", "en-us", "-s", "155", "--stdout", word], {
          encoding: "buffer", maxBuffer: MAX_AUDIO_BYTES, timeout: 8_000,
        });
        const wav = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
        if (isWav(wav)) return wav;
      } catch { /* Try the next installed engine. */ }
    }
    throw new Error("No local TTS engine is available");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function POST(request: Request) {
  const payload = await readSmallJson(request);
  const word = payload && typeof payload === "object" && "word" in payload && typeof payload.word === "string"
    ? payload.word.trim().replace(/\s+/g, " ") : "";
  if (!/^[A-Za-z][A-Za-z '-]{0,63}$/.test(word)) {
    return NextResponse.json({ error: "invalid_word" }, { status: 400 });
  }
  try {
    if (!consumeTtsRequest(requestIp(request))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const wav = await generateWav(word);
    return new Response(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store", "Content-Length": String(wav.length) },
    });
  } catch (error) {
    console.error("Unable to generate pronunciation", error);
    return NextResponse.json({ error: "tts_unavailable" }, { status: 503 });
  }
}
