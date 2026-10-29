import { NextResponse } from 'next/server';
import { processImage } from '@/lib/imageProcessing';

// Sharp needs Node's full runtime (not the lightweight Edge runtime), so
// we say so explicitly here.
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // 1. Read the uploaded file + crop info sent from the browser.
    const formData = await request.formData();
    const file = formData.get('file');
    const cropJson = formData.get('crop');

    if (!file) {
      return NextResponse.json({ error: 'No file was received.' }, { status: 400 });
    }

    const crop = cropJson ? JSON.parse(cropJson) : null;
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const { buffer } = await processImage(inputBuffer, crop);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="merchant-lifestyle-600x400.png"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/process] failed:', err);
    const message = err?.message || 'Something went wrong while processing your image.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
