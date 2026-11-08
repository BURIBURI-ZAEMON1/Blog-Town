// Lossless fingerprints come from the original PNG environment faces and logo.
// Exercise browser decode + the same non-premultiplied WebGL upload as Babylon,
// not just file sizes or an encoder's claim of losslessness.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { GetEnvInfo } from '@babylonjs/core/Misc/environmentTextureTools.js';

const expected = JSON.parse(readFileSync('scripts/fixtures/town-lossless-assets.json', 'utf8'));
const bytes = readFileSync('public/assets/brick-town/studio.env');
const end = bytes.indexOf(0, 8), header = JSON.parse(bytes.subarray(8, end).toString());
assert.deepEqual([...bytes.subarray(0, 8)], [0x86, 0x16, 0x87, 0x96, 0xf6, 0xd6, 0x96, 0x36], 'invalid Babylon ENV header');
for (const key of ['width', 'version', 'irradiance']) assert.deepEqual(header[key], expected.environment[key], `${key} changed`);
assert.deepEqual(Object.fromEntries(Object.entries(header.specular).filter(([key]) => key !== 'mipmaps')), expected.environment.specularMetadata);
assert.equal(header.imageType, 'image/webp');
const normalized = GetEnvInfo(bytes);
assert.equal(normalized?.imageType, 'image/webp', 'Babylon did not recognize the encoded image format');
assert.equal(normalized?.specular.lodGenerationScale, expected.environment.specularMetadata.lodGenerationScale || 0.8);
assert.equal(header.specular.mipmaps.length, expected.environment.images.length);
assert(bytes.length <= expected.environment.maxBytes, 'environment transfer size regressed');
let offset = 0;
const images = header.specular.mipmaps.map((mip) => {
  assert.equal(mip.position, offset, 'mip offsets are not contiguous'); offset += mip.length;
  return bytes.subarray(end + 1 + mip.position, end + 1 + mip.position + mip.length).toString('base64');
});
assert.equal(end + 1 + offset, bytes.length, 'missing/trailing environment bytes');
const logo = expected.logo ? readFileSync('public/assets/profile/logo.webp') : undefined;
if (logo) {
  assert(logo.length <= expected.logo.maxBytes, 'logo transfer size regressed');
  images.push(logo.toString('base64'));
}
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const decoded = await page.evaluate(async (encoded) => {
    const canvas = new OffscreenCanvas(1, 1), gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is required to verify original GPU pixels');
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    const results = [];
    for (const text of encoded) {
      const blob = new Blob([Uint8Array.from(atob(text), c => c.charCodeAt(0))], { type: 'image/webp' });
      const image = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      canvas.width = image.width; canvas.height = image.height;
      const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('GPU verification framebuffer incomplete');
      const pixels = new Uint8Array(image.width * image.height * 4);
      gl.readPixels(0, 0, image.width, image.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      results.push({ width: image.width, height: image.height, rgba: btoa(Array.from(pixels).map(byte => String.fromCharCode(byte)).join('')) });
      image.close(); gl.deleteTexture(texture); gl.deleteFramebuffer(framebuffer);
    }
    return results;
  }, images);
  const check = (actual, width, height, digest) => {
    assert.equal(actual.width, width); assert.equal(actual.height, height);
    assert.equal(createHash('sha256').update(Buffer.from(actual.rgba, 'base64')).digest('hex'), digest, 'decoded GPU pixels differ from original asset');
  };
  expected.environment.images.forEach((image, index) => check(decoded[index], image.size, image.size, image.rgbaSha256));
  if (expected.logo) check(decoded.at(-1), expected.logo.width, expected.logo.height, expected.logo.rgbaSha256);
  console.log(`PASS: all 48 environment mip/faces${logo ? " and logo" : ""} preserve exact original RGBA pixels; lighting/LOD metadata unchanged; ENV ${bytes.length} bytes${logo ? `, logo ${logo.length} bytes` : ""}.`);
} finally { await browser.close(); }
