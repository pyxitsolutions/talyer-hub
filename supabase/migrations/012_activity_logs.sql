-- Shop activity / audit log

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  summary TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_shop_created ON activity_logs(shop_id, created_at DESC);
CREATE INDEX idx_activity_logs_shop_action ON activity_logs(shop_id, action_type);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop users can view activity logs" ON activity_logs
  FOR SELECT USING (shop_id = get_user_shop_id());

CREATE POLICY "Shop users can insert own activity logs" ON activity_logs
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id() AND user_id = auth.uid());
