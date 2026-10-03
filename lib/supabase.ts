import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null in local mode (no Supabase env): the app then runs without login. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
