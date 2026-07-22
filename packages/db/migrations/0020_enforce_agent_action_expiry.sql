-- Give every proposed action a finite approval window.
UPDATE agent_proposed_actions
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL;

ALTER TABLE agent_proposed_actions
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours'),
  ALTER COLUMN expires_at SET NOT NULL;
