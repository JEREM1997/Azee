CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  plan_id text,
  store_production_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_email_idx
  ON audit_logs (actor_email);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON audit_logs (action);

CREATE INDEX IF NOT EXISTS audit_logs_plan_id_idx
  ON audit_logs (plan_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read audit logs" ON audit_logs;
CREATE POLICY "Admin can read audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

GRANT SELECT ON audit_logs TO authenticated;
