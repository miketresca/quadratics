update public.usage_events
set
  model = 'avatar_iv',
  unit_cost_usd = 0.0667,
  cost_usd = quantity * 0.0667,
  metadata = metadata || jsonb_build_object('avatarModel', 'avatar_iv', 'pricingCorrection', '0007_correct_heygen_avatar_iv_usage_costs')
where
  provider = 'heygen'
  and stage = 'heygen_avatar'
  and unit_type = 'seconds'
  and unit_cost_usd = 0.0167
  and (
    model is null
    or model = 'avatar_iv'
    or metadata->>'avatarModel' is null
    or metadata->>'avatarModel' = 'avatar_iv'
  );
