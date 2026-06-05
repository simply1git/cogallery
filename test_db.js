import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'client/.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // Replace with a real user or we can use the admin key
    password: 'password123'
  });
  // Since we don't know the password, let's use the service_role key to bypass auth, but we don't have the service_role key locally, only the anon key.
  // We can try to insert without auth to see what error it throws (though it might just throw 401).
}
test();
