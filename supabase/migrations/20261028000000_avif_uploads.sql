-- Allow AVIF images in uploads (tilesets, sprites, portraits)
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'image/avif')
where id = 'assets' and not ('image/avif' = any(allowed_mime_types));
