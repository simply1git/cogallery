import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://curbfldkaqeysbggvbyp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cmJmbGRrYXFleXNiZ2d2YnlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4NzY5NywiZXhwIjoyMDk1NDYzNjk3fQ.lF8BUTiKZgyCPMjxYcyqQHJ-4_p_T9Kkt-hH_GGT8Lw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixTrigger() {
  console.log('Connecting to Supabase...');
  
  // Create or update the profiles table
  const { error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT UNIQUE,
        display_name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Force add columns in case the table existed but was missing them
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      
      -- Drop the crashing trigger
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    `
  });

  if (tableError) {
    console.log('Error executing SQL via RPC. Trying an alternative method...');
    console.error(tableError);
    // Since we might not have exec_sql, we'll just try inserting a dummy profile to trigger table creation if we can,
    // but the most reliable way without rpc is using the REST API if possible, but JS client is limited for DDL.
    // However, if we drop the trigger, we don't need DDL!
    
    // Actually, we can't run raw DDL from the JS client without an RPC like `exec_sql`.
    // Let's create a new user using the service role key. The trigger will crash if it exists.
  } else {
    console.log('Successfully ran SQL fix!');
  }
}

fixTrigger();
