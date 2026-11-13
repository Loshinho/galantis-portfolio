import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  PORTFOLIO_PHOTOS,
  ASPECT_RATIO_VERTICAL_2_3,
  normalizePhotoAspectRatio,
} from '@/lib/infinite-grid';

export const dynamic = 'force-dynamic';

/**
 * Reads image width and height directly from JPEG, PNG, or WebP file headers
 * so any photo dropped into /public/portfolio (regardless of filename) automatically
 * adapts to 3:2 (horizontal) or 2:3 (vertical) aspect ratio.
 */
function readImageAspectRatioFromFile(filePath: string): number {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 24) return ASPECT_RATIO_VERTICAL_2_3;

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0) return normalizePhotoAspectRatio(w / h);
    }

    // WebP signature: RIFF....WEBP
    if (
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8 ' && buf.length >= 30) {
        const w = buf.readUInt16LE(26) & 0x3fff;
        const h = buf.readUInt16LE(28) & 0x3fff;
        if (w > 0 && h > 0) return normalizePhotoAspectRatio(w / h);
      } else if (chunk === 'VP8L' && buf.length >= 25) {
        const b0 = buf[21];
        const b1 = buf[22];
        const b2 = buf[23];
        const b3 = buf[24];
        const w = 1 + (((b1 & 0x3f) << 8) | b0);
        const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (w > 0 && h > 0) return normalizePhotoAspectRatio(w / h);
      } else if (chunk === 'VP8X' && buf.length >= 30) {
        const w = 1 + buf.readUIntLE(24, 3);
        const h = 1 + buf.readUIntLE(27, 3);
        if (w > 0 && h > 0) return normalizePhotoAspectRatio(w / h);
      }
    }

    // JPEG signature: FF D8
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = buf[i + 1];
        if (marker === 0xff) {
          i += 1;
          continue;
        }
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          const h = buf.readUInt16BE(i + 5);
          const w = buf.readUInt16BE(i + 7);
          if (w > 0 && h > 0) return normalizePhotoAspectRatio(w / h);
          break;
        }
        const segLen = buf.readUInt16BE(i + 2);
        if (segLen < 2) break;
        i += 2 + segLen;
      }
    }
  } catch {
    // Fallback to vertical 2:3 if header cannot be read
  }
  return ASPECT_RATIO_VERTICAL_2_3;
}

export async function GET() {
  try {
    const portfolioDir = path.join(process.cwd(), 'public', 'portfolio');
    const files = fs
      .readdirSync(portfolioDir)
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));

    if (files.length === 0) {
      return NextResponse.json({ photos: PORTFOLIO_PHOTOS });
    }

    const photos = files.map((filename, index) => {
      const encodedName = encodeURIComponent(filename);
      const src = `/portfolio/${encodedName}`;
      const fullPath = path.join(portfolioDir, filename);
      const aspectRatio = readImageAspectRatioFromFile(fullPath);
      const fallback = PORTFOLIO_PHOTOS[index % PORTFOLIO_PHOTOS.length];

      return {
        id: filename.replace(/\.[^.]+$/, '') || `photo-${index + 1}`,
        src,
        aspectRatio,
        fallbackColorA: fallback.fallbackColorA,
        fallbackColorB: fallback.fallbackColorB,
      };
    });

    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ photos: PORTFOLIO_PHOTOS });
  }
}

