import { createClient } from '@supabase/supabase-js';

// ATENȚIE: Valorile de mai jos sunt corecte și deja introduse.
// Le găsiți în panoul de control -> Settings -> API.

// 1. Project URL:
const supabaseUrl = "https://ahumszqxihacswcaaxri.supabase.co";

// 2. Cheia "anon" "public":
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodW1zenF4aWhhY3N3Y2FheHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NzY4ODksImV4cCI6MjA3NDA1Mjg4OX0.t3ozWp-s0CWMLSEnKg1zbUa5NzxpuTxhwvXu14rDvYM";

// Creăm și exportăm clientul Supabase folosind funcția importată.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);