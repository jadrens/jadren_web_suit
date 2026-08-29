ALTER TABLE reminder_event
  ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(16);

UPDATE reminder_event
   SET schedule_type = CASE
     WHEN repeat_interval_minutes IS NULL THEN 'one_time'
     ELSE 'repeat'
   END
 WHERE schedule_type IS NULL;

ALTER TABLE reminder_event
  ALTER COLUMN schedule_type SET DEFAULT 'one_time',
  ALTER COLUMN schedule_type SET NOT NULL,
  ALTER COLUMN remind_at DROP NOT NULL,
  ALTER COLUMN next_remind_at DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'reminder_event_schedule_type'
       AND conrelid = 'reminder_event'::regclass
  ) THEN
    ALTER TABLE reminder_event
      ADD CONSTRAINT reminder_event_schedule_type
      CHECK (schedule_type IN ('one_time', 'repeat', 'never'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'reminder_event_schedule_values'
       AND conrelid = 'reminder_event'::regclass
  ) THEN
    ALTER TABLE reminder_event
      ADD CONSTRAINT reminder_event_schedule_values
      CHECK (
        (schedule_type = 'never' AND remind_at IS NULL AND next_remind_at IS NULL
          AND repeat_interval_minutes IS NULL AND status = 'paused') OR
        (schedule_type = 'one_time' AND remind_at IS NOT NULL AND next_remind_at IS NOT NULL
          AND repeat_interval_minutes IS NULL) OR
        (schedule_type = 'repeat' AND remind_at IS NOT NULL AND next_remind_at IS NOT NULL
          AND repeat_interval_minutes IS NOT NULL)
      );
  END IF;
END $$;
