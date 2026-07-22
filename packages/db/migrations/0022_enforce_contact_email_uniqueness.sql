-- Normalize contact addresses and enforce one case-insensitive email per tenant.
UPDATE contacts
SET email = lower(btrim(email)),
    is_active = COALESCE(is_active, TRUE)
WHERE email <> lower(btrim(email))
   OR is_active IS NULL;

ALTER TABLE contacts
  ALTER COLUMN is_active SET NOT NULL;

DROP INDEX IF EXISTS contacts_user_email_idx;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_email_unique_idx
  ON contacts (user_id, lower(email));
