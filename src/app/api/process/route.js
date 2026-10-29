import { NextResponse } from 'next/server';
import { processImage } from '@/lib/imageProcessing';
import { uploadImage } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabaseClient';

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

    // 2. Keep the existing activity-history relationship for public visitors.
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          firebase_uid: 'public-access',
          email: 'public@merchantassetconverter.local',
          display_name: 'Public visitor',
        },
        { onConflict: 'firebase_uid' }
      )
      .select()
      .single();

    if (userError) throw userError;

    // 3. Do the real, high-quality image processing.
    const { buffer, originalMeta } = await processImage(inputBuffer, crop);

    // 4. Store the finished PNG in Cloudinary.
    const publicId = `job-${Date.now()}`;
    const { url } = await uploadImage(buffer, publicId);

    // 5. Record what happened in the database.
    const originalFormat = (file.type || '').split('/')[1]?.toUpperCase() || 'UNKNOWN';
    const { data: job, error: jobError } = await supabaseAdmin
      .from('image_jobs')
      .insert({
        original_filename: file.name || 'untitled',
        original_format: originalFormat === 'JPEG' ? 'JPEG' : originalFormat,
        original_width: originalMeta.width,
        original_height: originalMeta.height,
        original_file_size: inputBuffer.length,
        output_filename: 'merchant-lifestyle-600x400.png',
        output_format: 'PNG',
        output_width: 600,
        output_height: 400,
        output_storage_url: url,
        status: 'completed',
        processed_by: userRow.id,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    return NextResponse.json({ job });
  } catch (err) {
    console.error('[api/process] failed:', err);
    const message = err?.message || 'Something went wrong while processing your image.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
