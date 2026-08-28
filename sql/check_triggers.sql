-- Check all triggers
SELECT trigger_name, event_manipulation, event_object_schema, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'auth');
