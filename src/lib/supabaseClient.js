import { createClient } from '@supabase/supabase-js';

// This file talks to the database (Supabase Postgres for now).
// It uses the SERVICE ROLE key, which has full access — that's fine because
// this file only ever runs on the server (inside API routes), never in the browser.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.warn(
    '[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Check your .env.local file.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

/*
  SWAP-OUT NOTE:
  If the database ever moves off Supabase (e.g. to AWS RDS Postgres), this file is the
  only place that needs to change. As long as whatever replaces it exposes the same
  `supabaseAdmin.from(table).select/insert/upsert(...)` style calls, nothing else in
  the app needs to know the difference. (Supabase's Postgres is standard Postgres, so
  a move to RDS is realistically just a connection-string change here.)
*/
