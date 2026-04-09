import { createClient } from "@supabase/supabase-js";

// Cliente admin com service role key — usar APENAS em API routes server-side
// Bypassa RLS, acesso total ao banco
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
