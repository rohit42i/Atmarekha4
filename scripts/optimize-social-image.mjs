import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";

const INPUT = "public/ishani.png";
const OUTPUT = "public/og-atmarekha.jpg";
const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 600 * 1024;
const QUALITY_LEVELS = [82, 76, 70, 64, 58, 52, 46, 40];

const sharpModule = await import("sharp").catch(error => {
  throw new Error(
    "The social-preview build step requires sharp. Install the pinned sharp dependency before running this script. " +
    (error?.message || String(error)),
  );
});
const sharp = sharpModule.default;

const inputStat = await stat(INPUT).catch(error => {
  throw new Error("Cannot read the original artwork at " + INPUT + ": " + (error?.message || String(error)));
});
assert.ok(inputStat.isFile() && inputStat.size > 0, "Original artwork must be a non-empty file.");

const source = await readFile(INPUT);
const sourceMetadata = await sharp(source).metadata();
assert.equal(sourceMetadata.format, "png", "The source artwork must remain a PNG.");
assert.ok(sourceMetadata.width >= 600 && sourceMetadata.height >= 315, "The source artwork must have enough resolution for a 1200 x 630 share image.");

let output;
let chosenQuality;
for (const quality of QUALITY_LEVELS) {
  output = await sharp(source)
    .rotate()
    .resize(WIDTH, HEIGHT, {
      fit: "cover",
      position: sharp.strategy.attention,
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({
      quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();

  if (output.byteLength <= MAX_BYTES) {
    chosenQuality = quality;
    break;
  }
}

assert.ok(output, "Image optimizer did not produce an output.");
assert.ok(output.byteLength <= MAX_BYTES,
  "Social preview is " + output.byteLength + " bytes, above the 600 KiB target. Add another lower JPEG quality level before deploying.");

await writeFile(OUTPUT, output);
const outputMetadata = await sharp(output).metadata();
assert.equal(outputMetadata.format, "jpeg", "Social preview output must be a JPEG.");
assert.equal(outputMetadata.width, WIDTH, "Social preview width must be exactly 1200 pixels.");
assert.equal(outputMetadata.height, HEIGHT, "Social preview height must be exactly 630 pixels.");
assert.ok((await stat(OUTPUT)).size <= MAX_BYTES, "Final social preview is larger than the 600 KiB target.");

console.log(
  "Generated " + OUTPUT + ": " + outputMetadata.width + "x" + outputMetadata.height +
  ", JPEG quality " + chosenQuality + ", " + output.byteLength + " bytes. " +
  "Original artwork preserved at " + INPUT + ".",
);
