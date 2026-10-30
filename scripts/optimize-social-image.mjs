import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";

const INPUT = "public/ishani.png";
const OUTPUT = "public/og-atmarekha.jpg";
const WEBP_OUTPUT = "public/ishani.webp";
const WEBP_MAX_BYTES = 1024 * 1024;
const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 600 * 1024;
const QUALITY_LEVELS = [82, 76, 70, 64, 58, 52, 46, 40];

const require = createRequire(import.meta.url);
let sharp;
try {
  // CI installs this build-only tool in a temporary directory to keep the
  // application's production dependency tree and lockfile unchanged.
  sharp = require(process.env.SHARP_MODULE_PATH || "sharp");
} catch (error) {
  throw new Error(
    "The social-preview build step requires sharp. Install the pinned sharp package and set SHARP_MODULE_PATH if it lives outside node_modules. " +
    (error?.message || String(error)),
  );
}

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

// Build a smaller modern web image from the same artwork. Keep the original PNG
// for older integrations that may still reference it.
let webpOutput;
let webpQuality;
for (const quality of [82, 76, 70, 64, 58]) {
  webpOutput = await sharp(source)
    .rotate()
    .resize(1800, 1800, { fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer();
  if (webpOutput.byteLength <= WEBP_MAX_BYTES) {
    webpQuality = quality;
    break;
  }
}
assert.ok(webpOutput && webpOutput.byteLength <= WEBP_MAX_BYTES,
  "Optimized WebP artwork exceeds the 1 MiB target.");
await writeFile(WEBP_OUTPUT, webpOutput);
const webpMetadata = await sharp(webpOutput).metadata();
assert.equal(webpMetadata.format, "webp", "Optimized artwork must be WebP.");
assert.ok((await stat(WEBP_OUTPUT)).size <= WEBP_MAX_BYTES, "Final WebP artwork exceeds the 1 MiB target.");

// Render lightweight PNG icons for iOS and installable web-app manifests from
// the vector favicon. The SVG remains the browser favicon.
const faviconSvg = await readFile("public/favicon.svg");
for (const [filename, size] of [
  ["public/atma-rekha-icon-192.png", 192],
  ["public/atma-rekha-icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
]) {
  const icon = await sharp(faviconSvg, { density: 300 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await writeFile(filename, icon);
  const metadata = await sharp(icon).metadata();
  assert.equal(metadata.format, "png", filename + " must be PNG.");
  assert.equal(metadata.width, size, filename + " has the wrong width.");
  assert.equal(metadata.height, size, filename + " has the wrong height.");
}

console.log(
  "Generated " + OUTPUT + ": " + outputMetadata.width + "x" + outputMetadata.height +
  ", JPEG quality " + chosenQuality + ", " + output.byteLength + " bytes. " +
  "Generated " + WEBP_OUTPUT + ": " + webpMetadata.width + "x" + webpMetadata.height +
  ", WebP quality " + webpQuality + ", " + webpOutput.byteLength + " bytes. " +
  "Generated lightweight Atma Rekha app icons from public/favicon.svg.",
);
