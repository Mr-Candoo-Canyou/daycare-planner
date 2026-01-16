ALTER TABLE daycares
ADD COLUMN IF NOT EXISTS waitlist_policy VARCHAR(40) DEFAULT 'application_date';
