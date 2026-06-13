-- Speed up public invoice verification lookups by QR code
CREATE INDEX IF NOT EXISTS idx_invoices_verification_code ON invoices(verification_code);
