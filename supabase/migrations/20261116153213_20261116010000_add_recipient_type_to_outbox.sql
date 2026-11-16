/*
# Add recipient_type column to message_outbox

1. Modified Tables
- `message_outbox`: ADD `recipient_type` text (e.g. 'phone', 'zalo_group_id', 'messenger_group_id') to classify recipient
2. Security
- No new policies needed; column is nullable and covered by existing CRUD grant
3. Notes
- Backward compatible: column is nullable, existing rows unaffected
- CreateOrder will set recipient_type='phone' for customer Zalo messages
- DailyConsolidation will set recipient_type='zalo_group_id' or 'messenger_group_id' for factory orders
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'message_outbox' AND column_name = 'recipient_type') THEN
    ALTER TABLE message_outbox ADD COLUMN recipient_type text;
  END IF;
END $$;
