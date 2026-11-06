CREATE POLICY "Owners read their comment photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comment-photos' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = (storage.foldername(name))[1] AND p.owner_id = auth.uid()));
CREATE POLICY "Owners delete their comment photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comment-photos' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = (storage.foldername(name))[1] AND p.owner_id = auth.uid()));