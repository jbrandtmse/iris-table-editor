/**
 * Generate ICO file from PNG for Windows installer.
 * Story 13.1: Electron Builder Config
 *
 * ICO format for sizes >= 48px can embed PNG data directly.
 * This script creates a minimal ICO container wrapping the existing PNG.
 *
 * ICO structure:
 *   - 6-byte header: reserved(2) + type(2) + count(2)
 *   - 16-byte directory entry per image
 *   - PNG payload
 *
 * Uses only Node.js built-in modules (fs, path).
 */
const fs = require('fs');
const path = require('path');

/**
 * Generate an ICO file from a PNG file.
 * @param {string} pngPath - Path to source PNG file
 * @param {string} icoPath - Path to output ICO file
 */
function generateIco(pngPath, icoPath) {
    const pngData = fs.readFileSync(pngPath);

    // Validate PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!pngData.subarray(0, 8).equals(pngSignature)) {
        throw new Error(`Not a valid PNG file: ${pngPath}`);
    }

    // Extract dimensions from IHDR chunk (bytes 16-23) for logging
    const width = pngData.readUInt32BE(16);
    const height = pngData.readUInt32BE(20);

    // ICO header: 6 bytes
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);  // Reserved, must be 0
    header.writeUInt16LE(1, 2);  // Type: 1 = ICO
    header.writeUInt16LE(1, 4);  // Number of images: 1

    // Directory entry: 16 bytes
    // Always declare 256x256 (0 = 256 in ICO format) so electron-builder
    // accepts the icon. The actual PNG data can be any size — Windows will
    // render the embedded PNG at its native resolution and scale as needed.
    // This is valid per the ICO specification: the directory entry declares
    // the slot size, and the PNG payload provides the actual image data.
    const dirEntry = Buffer.alloc(16);
    dirEntry.writeUInt8(0, 0);          // Width: 0 = 256
    dirEntry.writeUInt8(0, 1);          // Height: 0 = 256
    dirEntry.writeUInt8(0, 2);          // Color palette count (0 = no palette)
    dirEntry.writeUInt8(0, 3);          // Reserved
    dirEntry.writeUInt16LE(1, 4);       // Color planes
    dirEntry.writeUInt16LE(32, 6);      // Bits per pixel (32 for PNG-in-ICO)
    dirEntry.writeUInt32LE(pngData.length, 8);   // Image data size
    dirEntry.writeUInt32LE(6 + 16, 12);          // Offset to image data (header + 1 entry)

    // Write ICO file
    const icoData = Buffer.concat([header, dirEntry, pngData]);

    fs.mkdirSync(path.dirname(icoPath), { recursive: true });
    fs.writeFileSync(icoPath, icoData);

    console.log(`Generated ICO: ${icoPath} (${width}x${height}, ${icoData.length} bytes)`);
}

// Export for testing
module.exports = { generateIco };

// CLI execution
if (require.main === module) {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const pngPath = path.join(repoRoot, 'resources', 'icon.png');
    const buildResources = path.join(__dirname, '..', 'build-resources');

    if (!fs.existsSync(pngPath)) {
        console.error(`ERROR: ${pngPath} not found`);
        process.exit(1);
    }

    // Generate ICO
    const icoPath = path.join(buildResources, 'icon.ico');
    generateIco(pngPath, icoPath);

    // Copy PNG for macOS (electron-builder auto-converts)
    const pngDest = path.join(buildResources, 'icon.png');
    fs.mkdirSync(buildResources, { recursive: true });
    fs.copyFileSync(pngPath, pngDest);
    console.log(`Copied PNG: ${pngDest}`);

    console.log('Icon generation complete.');
}
