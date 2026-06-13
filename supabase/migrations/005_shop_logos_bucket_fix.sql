-- Update shop-logos bucket MIME types if migration 004 was already applied
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml'
  ],
  file_size_limit = 2097152,
  public = true
WHERE id = 'shop-logos';
