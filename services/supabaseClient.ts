
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wfqzvdvinxkhshozdrxu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcXp2ZHZpbnhraHNob3pkcnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjQxMzAsImV4cCI6MjA4MjcwMDEzMH0.7OuDxzpXed_bDw1kmSJYNQh4jNoAyzp-UoXvoCpK7xo';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
