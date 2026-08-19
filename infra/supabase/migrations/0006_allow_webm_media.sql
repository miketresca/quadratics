-- HeyGen avatar clips are stored as WebM so optional avatar output can preserve the provider's video format.
update storage.buckets
set allowed_mime_types = array['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/webm', 'application/json']
where id = 'generated-media';
