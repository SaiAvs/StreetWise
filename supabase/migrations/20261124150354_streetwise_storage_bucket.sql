/*
# Storage bucket for complaint evidence images

1. Objects
- Creates a PRIVATE storage bucket `complaint-evidence`.
- Storage RLS policies on storage.objects:
  - INSERT: authenticated users may upload to their own folder
    (path prefix = their auth.uid()) — evidence lives at `<uid>/<filename>`.
  - SELECT: the owner, authorities, and admins may read. Authorities can read
    because assignment-driven complaint access requires viewing evidence; image
    URLs stored in complaints point here.
  - UPDATE/DELETE: owner only.
- File type/size validation happens in the app before upload (images only,
  <= 5MB); this policy layer scopes WHO and WHERE.

2. Notes
- Idempotent (policy drop-if-exists, bucket insert guarded).
- Bucket stays private: public URL access is denied; the app renders images
  through authenticated URLs.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-evidence', 'complaint-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "citizens upload own evidence" ON storage.objects;
CREATE POLICY "citizens upload own evidence" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "owners read own evidence" ON storage.objects;
CREATE POLICY "owners read own evidence" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "staff read evidence" ON storage.objects;
CREATE POLICY "staff read evidence" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-evidence'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.image_urls @> ARRAY[storage.objects.name]
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
    )
  )
);

DROP POLICY IF EXISTS "owners update own evidence" ON storage.objects;
CREATE POLICY "owners update own evidence" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "owners delete own evidence" ON storage.objects;
CREATE POLICY "owners delete own evidence" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);