import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FEEDBACK_PRINTS } from '@/lib/infinite-grid';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feedbacksDir = path.join(process.cwd(), 'public', 'feedbacks');
    const files = fs
      .readdirSync(feedbacksDir)
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (files.length === 0) {
      return NextResponse.json({ feedbacks: FEEDBACK_PRINTS });
    }

    const feedbacks = files.map((filename, index) => ({
      id: filename.replace(/\.[^.]+$/, '') || `feedback-${index + 1}`,
      src: `/feedbacks/${encodeURIComponent(filename)}`,
    }));

    return NextResponse.json({ feedbacks });
  } catch {
    return NextResponse.json({ feedbacks: FEEDBACK_PRINTS });
  }
}

