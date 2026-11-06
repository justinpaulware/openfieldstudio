DROP POLICY IF EXISTS "Avatars are viewable by authenticated users" ON storage.objects;
CREATE POLICY "Users can view their own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);