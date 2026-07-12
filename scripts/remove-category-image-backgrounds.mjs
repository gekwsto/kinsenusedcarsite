#!/usr/bin/env node
// Reproducible background-removal pass for the homepage vehicle category
// images. The source PNGs are RGBA with a fully opaque alpha channel and a
// near-white studio background baked into the RGB pixels.
//
// This does NOT chroma-key every near-white pixel in the image (that would
// erase white/light-gray vehicle paint). Instead it 8-connected flood-fills
// from the four image edges, only through pixels close to the sampled
// background color, so background regions that are enclosed by the vehicle
// silhouette (e.g. light-colored body panels, glass) are left untouched.
//
// Usage: node scripts/remove-category-image-backgrounds.mjs [--preview]
//   --preview  also render /tmp preview composites over a light and a dark
//              background so the result can be inspected before committing.

import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const imagesDir = path.join(root, "public/images");

const FILES = ["cat-town.png", "cat-hybrid.png", "cat-suv.png", "cat-van.png"];

// Color-distance (max channel delta) ceiling for the *connectivity* flood
// fill: only pixels this close to the sampled background color are treated
// as "confident background". Soft photographic shadow gradients under the
// vehicle fade gradually from white through mid-gray, and a loose threshold
// here lets the flood fill tunnel straight through that gradient and bleed
// into unrelated light-colored vehicle regions (chrome, rims, highlights)
// that happen to sit at a similar brightness further along the image. Kept
// tight so the fill can only ever consume genuinely near-white pixels.
const T_CONNECT = 14;
// Width (in pixels) of the geometric feather ring drawn just outside the
// confident-background mask. This is a fixed-radius morphological growth,
// not a color-distance search, so — unlike the connectivity flood fill —
// it cannot tunnel arbitrarily far through a gradient. It exists purely to
// soften the hard pixel boundary of the flood fill into a smooth edge.
const FEATHER_WIDTH = 4;
// Light blur applied to the alpha channel only, to soften the flood-fill
// boundary (which is inherently a per-pixel/jagged decision) into a smooth
// antialiased edge.
const ALPHA_BLUR_SIGMA = 0.6;
// Below this alpha, skip RGB decontamination (see rationale at call site).
const DECONTAMINATE_MIN_ALPHA = 96;

const PREVIEW = process.argv.includes("--preview");
const previewDir = path.join(os.tmpdir(), "category-bg-preview");

function colorDist(r, g, b, bg) {
  return Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2]));
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function processImage(file) {
  const filePath = path.join(imagesDir, file);
  const original = sharp(filePath);
  const meta = await original.metadata();
  const { data, info } = await original.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;

  let initAlphaMin = 255;
  let initAlphaMax = 0;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] < initAlphaMin) initAlphaMin = data[i];
    if (data[i] > initAlphaMax) initAlphaMax = data[i];
  }

  // 1. Estimate background color from a 2px outer border ring.
  const ring = 2;
  const rSamples = [];
  const gSamples = [];
  const bSamples = [];
  for (let y = 0; y < height; y++) {
    const onYEdge = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (!onYEdge && x >= ring && x < width - ring) continue;
      const i = (y * width + x) * channels;
      rSamples.push(data[i]);
      gSamples.push(data[i + 1]);
      bSamples.push(data[i + 2]);
    }
  }
  const bg = [median(rSamples), median(gSamples), median(bSamples)];

  // 2. Phase A — 8-connected flood fill from the image border, only through
  // pixels within T_CONNECT of the sampled background color. This produces
  // the "confident background" mask and is deliberately conservative: it
  // must never reach a real vehicle pixel.
  const confident = new Uint8Array(size);
  const queueX = new Int32Array(size);
  const queueY = new Int32Array(size);
  let qHead = 0;
  let qTail = 0;

  const tryEnqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (confident[idx]) return;
    const i = idx * channels;
    if (colorDist(data[i], data[i + 1], data[i + 2], bg) <= T_CONNECT) {
      confident[idx] = 1;
      queueX[qTail] = x;
      queueY[qTail] = y;
      qTail++;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];

  while (qHead < qTail) {
    const x = queueX[qHead];
    const y = queueY[qHead];
    qHead++;
    for (const [dx, dy] of neighbors) tryEnqueue(x + dx, y + dy);
  }

  // 3. Phase B — geometric feather ring. Grown outward from the confident
  // mask's frontier by a fixed number of pixels (FEATHER_WIDTH), regardless
  // of pixel color. Because this expansion is purely spatial and capped, it
  // cannot tunnel through a gradient the way a color-distance search can:
  // it softens the true boundary without ever risking a deep leak.
  const ringDepth = new Uint8Array(size); // 0 = not in ring, else 1..FEATHER_WIDTH
  const claimed = new Uint8Array(size); // confident OR already assigned a ring depth
  for (let idx = 0; idx < size; idx++) claimed[idx] = confident[idx];

  let frontier = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!confident[idx]) continue;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (!confident[nIdx] && !claimed[nIdx]) {
          claimed[nIdx] = 1;
          ringDepth[nIdx] = 1;
          frontier.push(nIdx);
        }
      }
    }
  }
  for (let depth = 2; depth <= FEATHER_WIDTH && frontier.length > 0; depth++) {
    const next = [];
    for (const idx of frontier) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (!claimed[nIdx]) {
          claimed[nIdx] = 1;
          ringDepth[nIdx] = depth;
          next.push(nIdx);
        }
      }
    }
    frontier = next;
  }

  // 4. Assign final alpha. Confident background -> 0. Feather ring -> a
  // linear ramp from just-above-0 up to 255 (continuous with the untouched
  // vehicle pixels right at the outer edge of the ring). Everything else is
  // left completely untouched, preserving original RGB and alpha.
  let removedPixelCount = 0;
  for (let idx = 0; idx < size; idx++) {
    const i = idx * channels;
    let newAlpha = null;

    if (confident[idx]) {
      newAlpha = 0;
    } else if (ringDepth[idx] > 0) {
      newAlpha = Math.round((255 * ringDepth[idx]) / FEATHER_WIDTH);
    }

    if (newAlpha === null) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i + 3] = newAlpha;
    if (newAlpha === 0) removedPixelCount++;

    // Decontaminate (remove the background color's contribution) only for
    // the mostly-opaque part of the feather ring. At low alpha, dividing by
    // the true (tiny) value amplifies ordinary per-pixel source noise into
    // wild RGB swings that clamp to 0/255 — visible as black/white static
    // once composited on a dark ground. Low-alpha pixels barely contribute
    // to any composite anyway, so leaving their RGB as-is is imperceptible.
    if (newAlpha >= DECONTAMINATE_MIN_ALPHA && newAlpha < 255) {
      const a = newAlpha / 255;
      data[i] = clamp255(bg[0] + (r - bg[0]) / a);
      data[i + 1] = clamp255(bg[1] + (g - bg[1]) / a);
      data[i + 2] = clamp255(bg[2] + (b - bg[2]) / a);
    }
  }

  // 4. Light blur on the alpha channel alone, to smooth the flood-fill
  // boundary. RGB channels are untouched by this step.
  const alphaOnly = Buffer.alloc(size);
  for (let idx = 0; idx < size; idx++) alphaOnly[idx] = data[idx * channels + 3];
  const blurredAlpha = await sharp(alphaOnly, { raw: { width, height, channels: 1 } })
    .blur(ALPHA_BLUR_SIGMA)
    .toColorspace("b-w")
    .raw()
    .toBuffer();
  for (let idx = 0; idx < size; idx++) data[idx * channels + 3] = blurredAlpha[idx];

  let finalAlphaMin = 255;
  let finalAlphaMax = 0;
  let opaqueCount = 0;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] < finalAlphaMin) finalAlphaMin = data[i];
    if (data[i] > finalAlphaMax) finalAlphaMax = data[i];
    if (data[i] === 255) opaqueCount++;
  }

  const cornerAlpha = [
    data[(0 * width + 0) * channels + 3],
    data[(0 * width + (width - 1)) * channels + 3],
    data[((height - 1) * width + 0) * channels + 3],
    data[((height - 1) * width + (width - 1)) * channels + 3],
  ];

  const outBuffer = await sharp(data, { raw: { width, height, channels } })
    .png({ palette: false, compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return {
    file,
    width,
    height,
    bg,
    initAlphaMin,
    initAlphaMax,
    finalAlphaMin,
    finalAlphaMax,
    opaqueCount,
    removedPixelCount,
    totalPixels: size,
    cornerAlpha,
    outBuffer,
  };
}

async function writePreview(result) {
  fs.mkdirSync(previewDir, { recursive: true });
  const { width, height, outBuffer, file } = result;
  const base = file.replace(/\.png$/, "");

  // Resize is done as a second pass on the already-composited buffer;
  // chaining .resize() directly after .composite() in one pipeline makes
  // sharp shrink the base canvas before the composite size check runs.
  const lightFull = await sharp({
    create: { width, height, channels: 4, background: "#f5f7fa" },
  })
    .composite([{ input: outBuffer }])
    .png()
    .toBuffer();
  const light = await sharp(lightFull).resize({ width: 500 }).png().toBuffer();
  fs.writeFileSync(path.join(previewDir, `${base}-on-light.png`), light);

  const darkFull = await sharp({
    create: { width, height, channels: 4, background: "#15181d" },
  })
    .composite([{ input: outBuffer }])
    .png()
    .toBuffer();
  const dark = await sharp(darkFull).resize({ width: 500 }).png().toBuffer();
  fs.writeFileSync(path.join(previewDir, `${base}-on-dark.png`), dark);
}

async function main() {
  const results = [];
  for (const file of FILES) {
    const result = await processImage(file);
    results.push(result);

    console.log(`\n${file}`);
    console.log(`  size: ${result.width}x${result.height}`);
    console.log(`  sampled background rgb: ${result.bg.join(",")}`);
    console.log(`  initial alpha min/max: ${result.initAlphaMin}/${result.initAlphaMax}`);
    console.log(`  final alpha min/max:   ${result.finalAlphaMin}/${result.finalAlphaMax}`);
    console.log(`  corner alpha (TL,TR,BL,BR): ${result.cornerAlpha.join(",")}`);
    console.log(
      `  opaque pixels: ${result.opaqueCount} / ${result.totalPixels} ` +
        `(${((result.opaqueCount / result.totalPixels) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  fully removed background pixels: ${result.removedPixelCount} ` +
        `(${((result.removedPixelCount / result.totalPixels) * 100).toFixed(1)}%)`,
    );

    if (PREVIEW) {
      await writePreview(result);
    } else {
      const tmpPath = path.join(imagesDir, `${file}.tmp`);
      fs.writeFileSync(tmpPath, result.outBuffer);
      fs.renameSync(tmpPath, path.join(imagesDir, file));

      // Verify the written file decodes cleanly and still has a real alpha
      // channel with the expected 0..255 range.
      const check = await sharp(path.join(imagesDir, file)).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      let min = 255;
      let max = 0;
      for (let i = 3; i < check.data.length; i += check.info.channels) {
        if (check.data[i] < min) min = check.data[i];
        if (check.data[i] > max) max = check.data[i];
      }
      console.log(`  re-decoded OK, alpha min/max: ${min}/${max}`);
    }
  }

  if (PREVIEW) {
    console.log(`\nPreview composites written to: ${previewDir}`);
  } else {
    console.log("\nDone. public/images/*.png updated with real alpha transparency.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
