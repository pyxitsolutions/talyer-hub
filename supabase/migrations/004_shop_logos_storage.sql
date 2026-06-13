-- Shop logo uploads (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-logos',
  'shop-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read shop logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-logos');

CREATE POLICY "Shop users upload own logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
);

CREATE POLICY "Shop users update own logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
)
WITH CHECK (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
);

CREATE POLICY "Shop users delete own logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND (storage.foldername(name))[1] = get_user_shop_id()::text
);
