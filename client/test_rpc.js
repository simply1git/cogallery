import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://curbfldkaqeysbggvbyp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cmJmbGRrYXFleXNiZ2d2YnlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4NzY5NywiZXhwIjoyMDk1NDYzNjk3fQ.lF8BUTiKZgyCPMjxYcyqQHJ-4_p_T9Kkt-hH_GGT8Lw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_db_size');
  console.log('DB Size:', data, error);
}
test();
