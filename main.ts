import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Meme Sprint 3: AI Agent Goes Rogue.
// The meme is drawn programmatically by draw.py (PIL) in this same
// directory; this file only locates it and the output path, then runs it.
// Deterministic: no clock, no network, no unseeded randomness.

const scriptDir = dirname(fileURLToPath(import.meta.url));
const drawScript = join(scriptDir, "draw.py");

function pickOutputPath(): string {
  // The contract: the image goes to /output/entry.png.
  try {
    mkdirSync("/output", { recursive: true });
    return "/output/entry.png";
  } catch {
    // Sandbox without a writable /output: fall back next to the script.
    const local = join(scriptDir, "output");
    mkdirSync(local, { recursive: true });
    return join(local, "entry.png");
  }
}

const outPath = pickOutputPath();

execFileSync("python3", [drawScript, outPath], {
  cwd: scriptDir,
  stdio: "inherit",
});

if (!existsSync(outPath)) {
  throw new Error(`draw.py did not produce ${outPath}`);
}
const bytes = statSync(outPath).size;
if (bytes === 0 || bytes > 1_048_576) {
  throw new Error(`entry.png has unexpected size: ${bytes} bytes`);
}
console.log(`entry.png ready: ${outPath} (${bytes} bytes)`);
