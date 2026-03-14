const fs = require("fs");
const zlib = require("zlib");

// Generate a 20x20 PNG calendar heatmap icon — pure Node.js, no dependencies

const W = 20, H = 20;

// Green heatmap colors (GitHub-style)
const palette = {
    bg:    [13, 17, 23],     // #0d1117
    empty: [22, 27, 34],     // #161b22
    l1:    [14, 68, 41],     // #0e4429
    l2:    [0, 109, 50],     // #006d32
    l3:    [38, 166, 65],    // #26a641
    l4:    [57, 211, 83],    // #39d353
    l5:    [155, 233, 168],  // #9be9a8
};

// 4x5 grid pattern for mini heatmap
const grid = [
    ["l1",  "l2",  "l4",  "l5",  "l3"],
    ["empty","l3",  "l1",  "l4",  "empty"],
    ["l2",  "l5",  "l3",  "l1",  "l4"],
    ["l1",  "empty","l5",  "l2",  "l3"]
];

const cellSize = 3, gap = 1, startX = 1, startY = 2;

// Create raw pixel data
const pixels = Buffer.alloc(H * (1 + W * 3)); // filter byte + RGB per row

for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 3);
    pixels[rowStart] = 0; // filter: None
    for (let x = 0; x < W; x++) {
        let color = palette.bg;

        // Check if pixel falls in a grid cell
        const gx = x - startX;
        const gy = y - startY;
        if (gx >= 0 && gy >= 0) {
            const col = Math.floor(gx / (cellSize + gap));
            const row = Math.floor(gy / (cellSize + gap));
            const lx = gx % (cellSize + gap);
            const ly = gy % (cellSize + gap);

            if (col < 5 && row < 4 && lx < cellSize && ly < cellSize) {
                const key = grid[row][col];
                color = palette[key];
            }
        }

        const idx = rowStart + 1 + x * 3;
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
    }
}

// Build PNG file
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let j = 0; j < 8; j++) {
            c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
        }
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type: RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace
const ihdrChunk = makeChunk("IHDR", ihdr);

// IDAT
const compressed = zlib.deflateSync(pixels);
const idatChunk = makeChunk("IDAT", compressed);

// IEND
const iendChunk = makeChunk("IEND", Buffer.alloc(0));

const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
fs.writeFileSync("assets/icon.png", png);
console.log("Icon generated: assets/icon.png (" + png.length + " bytes)");
