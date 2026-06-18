-- Non-cash payment details (reference number and payer account name)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payer_account_name TEXT;
