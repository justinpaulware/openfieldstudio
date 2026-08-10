CREATE POLICY "Owners read their project thumbnails"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Owners write their project thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Owners update their project thumbnails"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Owners delete their project thumbnails"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-thumbnails'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);