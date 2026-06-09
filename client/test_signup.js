import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://curbfldkaqeysbggvbyp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cmJmbGRrYXFleXNiZ2d2YnlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4NzY5NywiZXhwIjoyMDk1NDYzNjk3fQ.lF8BUTiKZgyCPMjxYcyqQHJ-4_p_T9Kkt-hH_GGT8Lw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  console.log('Testing Admin Auth User Creation...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test_trigger_crash_' + Date.now() + '@example.com',
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      displayName: 'Test User'
    }
  });

  console.log('Create User Error:', error);
  if (data?.user) {
    console.log('Created user successfully! ID:', data.user.id);
    // Cleanup
    await supabase.auth.admin.deleteUser(data.user.id);
  }
}
test();
