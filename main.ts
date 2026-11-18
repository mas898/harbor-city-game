// Harbor City entry point (Node 22, standard library only).
//
// The game itself lives in the game/ folder next to this file: plain static
// files that a desktop browser loads with no network access. This program
// gathers the hand-in: it copies game/ and screenshots/ into the output
// directory and writes dossier.json there, using the vendored dossier
// builder. The grader supplies /output; anywhere else, the
// MAKEFUN_OUTPUT_DIR environment variable picks the destination instead.
//
// To check the output locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play the game locally: node serve.ts, then open the printed address.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = fileURLToPath(new URL("./", import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const gameSource = join(repoRoot, "game");
const shotsSource = join(repoRoot, "screenshots");
const gameTarget = join(outputRoot, "game");
const shotsTarget = join(outputRoot, "screenshots");

mkdirSync(outputRoot, { recursive: true });
cpSync(gameSource, gameTarget, { recursive: true });
mkdirSync(shotsTarget, { recursive: true });
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

// Caps taken from the scorer's own limits. The text cap shapes the dossier
// bytes; the rest refuse entries the scorer would refuse anyway (too many
// or too large screenshots, too many or too large game files, or a game
// path that is too long).
const dossierText = buildDossier(outputRoot, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputRoot, "dossier.json"), dossierText);
