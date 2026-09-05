import { createClient } from '@supabase/supabase-js';

function sanitizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim().replace(/^["']|["']$/g, '').trim();
  // Check for markdown link [text](url) or (url)
  const markdownMatch = trimmed.match(/\((https?:\/\/[^\s\)]+)\)/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim();
  }
  // Check for any http/https URL in the string
  const urlMatch = trimmed.match(/https?:\/\/[^\s\]\)\"\'\>]+/);
  if (urlMatch && urlMatch[0]) {
    return urlMatch[0].trim();
  }
  // Hostname only e.g. "gjshbwdxxrzvfqkjicla.supabase.co"
  if (trimmed.includes('.supabase.co') && !trimmed.startsWith('http')) {
    const cleanHost = trimmed.replace(/^[\[\(\/\s]+|[\]\)\/\s]+$/g, '');
    return `https://${cleanHost}`;
  }
  return trimmed;
}

function sanitizeSupabaseKey(rawKey: string | undefined): string {
  if (!rawKey) return '';
  return rawKey.trim().replace(/^["']|["']$/g, '').trim();
}

function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const cleanUrl = sanitizeSupabaseUrl(rawUrl);
const cleanKey = sanitizeSupabaseKey(rawKey);

export const isSupabaseConfigured = Boolean(
  cleanUrl &&
  cleanKey &&
  isValidHttpUrl(cleanUrl) &&
  !cleanUrl.includes('your-project') &&
  !cleanKey.includes('your-anon-key') &&
  !cleanUrl.includes('placeholder.supabase.co')
);

const finalUrl = (cleanUrl && isValidHttpUrl(cleanUrl)) ? cleanUrl : 'https://placeholder.supabase.co';
const finalKey = cleanKey || 'placeholder';

// Cliente seguro para frontend con anon key pública y RLS
export const supabase = createClient(
  finalUrl,
  finalKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);

