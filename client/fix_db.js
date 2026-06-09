import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:@1s2s3s4s5S@db.curbfldkaqeysbggvbyp.supabase.co:5432/postgres';

async function fixDB() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to Supabase Postgres...');
    await client.connect();
    
    // 1. Drop the known trigger
    console.log('Dropping on_auth_user_created trigger...');
    await client.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`);
    
    // 2. Search for any other triggers on auth.users and drop them
    console.log('Searching for any other broken triggers on auth.users...');
    const { rows } = await client.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_schema = 'auth' AND event_object_table = 'users';
    `);
    
    if (rows.length > 0) {
      console.log('Found triggers:', rows.map(r => r.trigger_name).join(', '));
      for (const row of rows) {
        // Don't drop Supabase-native triggers if there are any (usually none are shown in information_schema)
        await client.query(`DROP TRIGGER IF EXISTS "${row.trigger_name}" ON auth.users;`);
        console.log(`Dropped trigger ${row.trigger_name}`);
      }
    } else {
      console.log('No other triggers found on auth.users.');
    }

    // 3. Ensure profiles table has the correct schema
    console.log('Ensuring public.profiles table exists with display_name and avatar_url...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Force add columns
    await client.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;`);
    await client.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);

    console.log('Database fix complete! Sign-ups should now work.');
  } catch (error) {
    console.error('Error during database fix:', error);
  } finally {
    await client.end();
  }
}

fixDB();
