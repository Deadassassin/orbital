const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  // Create raw pixel data (RGBA)
  const rawData = Buffer.alloc(width * height * 4);
  const cx = width / 2, cy = height / 2, radius = Math.min(width, height) / 2 - 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Outside the circle - transparent
      if (dist > radius) {
        rawData[idx] = 0; rawData[idx+1] = 0; rawData[idx+2] = 0; rawData[idx+3] = 0;
      }
      // Outer ring
      else if (dist <= radius && dist > radius - 6) {
        rawData[idx] = 255; rawData[idx+1] = 255; rawData[idx+2] = 255; rawData[idx+3] = 255;
      }
      // Inner circle
      else if (dist <= radius * 0.4) {
        rawData[idx] = 255; rawData[idx+1] = 255; rawData[idx+2] = 255; rawData[idx+3] = 255;
      }
      // Ellipse lines
      else if (dist <= radius) {
        const el1 = Math.abs(dx * 0.866 - dy * 0.5);
        const el2 = Math.abs(dx * 0.866 + dy * 0.5);
        if (el1 < 3 || el2 < 3) {
          rawData[idx] = 255; rawData[idx+1] = 255; rawData[idx+2] = 255; rawData[idx+3] = 255;
        } else {
          rawData[idx] = r; rawData[idx+1] = g; rawData[idx+2] = b; rawData[idx+3] = 255;
        }
      }
    }
  }

  // Create filtered rows (sub filter)
  const filtered = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const offset = y * (width * 4 + 1);
    filtered[offset] = 0; // None filter
    const rowStart = y * width * 4;
    rawData.copy(filtered, offset + 1, rowStart, rowStart + width * 4);
  }

  const compressed = zlib.deflateSync(filtered);

  // Build PNG
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crc]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = compressed;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Generate icons at multiple sizes
const sizes = [16, 32, 48, 64, 128, 256];
const outDir = path.join(__dirname, '..', 'icons');

for (const size of sizes) {
  const png = createPNG(size, size, 0, 0, 0); // Black
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png (${size}x${size})`);
}

// Copy 256 as main icon
fs.copyFileSync(
  path.join(outDir, 'icon256.png'),
  path.join(outDir, 'icon.png')
);
console.log('Created icon.png (256x256)');
