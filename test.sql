
SELECT m.model_id, -- No clue what this does but ends up working somehow
       m.name,
       m.description,
       m.short_description,
       m.long_description,
       m.created_at,
       m.owner_user_id,
       json_agg(json_build_object('id', me.id, 'url', me.url, 'weight', me.weight, 'is_active', me.is_active)) as endpoints
FROM models m
LEFT JOIN model_endpoints me ON m.model_id = me.model_id
-- WHERE m.owner_user_id = $1
GROUP BY m.model_id,
         m.name,
         m.description,
         m.short_description,
         m.long_description,
         m.created_at,
         m.owner_user_id;
-- ORDER BY m.name
-- LIMIT 10;

-- select has_file from messages;
