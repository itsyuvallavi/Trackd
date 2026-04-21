-- Recover provider slug from the initial bot NOTE ("Bot found via jsearch ...") when importSource was never stored.
UPDATE "Job" AS j
SET "importSource" = matched.slug
FROM (
  SELECT DISTINCT ON (a."jobId")
    a."jobId",
    lower((regexp_match(a.description, '^Bot found via ([A-Za-z0-9_]+)'))[1]) AS slug
  FROM "Activity" AS a
  WHERE a.type = 'NOTE'::"ActivityType"
    AND a.description ~ '^Bot found via [A-Za-z0-9_]+'
  ORDER BY a."jobId", a."createdAt" ASC
) AS matched
WHERE j.id = matched."jobId"
  AND j.source = 'BOT'::"JobSource"
  AND (j."importSource" IS NULL OR trim(j."importSource") = '')
  AND matched.slug IS NOT NULL;
