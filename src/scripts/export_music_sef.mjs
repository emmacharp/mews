#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..", "..");
const inputPath = resolve(rootDir, "src", "templates", "music.sef.json");
const outputPath = resolve(rootDir, "src", "templates", "music_sef.mjs");

const sefText = await readFile(inputPath, "utf8");
await writeFile(outputPath, `const musicSefText = ${JSON.stringify(sefText)};\n\nexport default musicSefText;\n`, "utf8");
