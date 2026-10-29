import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// Returns the 20 most recent conversions, newest first — powers the
// "Recent activity" panel so the team can see a shared history.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('image_jobs')
      .select('id, original_filename, output_storage_url, status, created_at, processed_by, users ( display_name, email )')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ jobs: data });
  } catch (err) {
    console.error('[api/jobs] failed:', err);
    return NextResponse.json({ error: err.message || 'Could not load history.' }, { status: 500 });
  }
}
