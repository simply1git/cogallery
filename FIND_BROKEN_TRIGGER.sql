-- Run this in your Supabase SQL Editor to find the broken trigger:
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'photos' OR event_object_table = 'events';
