-- SerpAPI integration removed; bot search uses server env keys only.
-- `serpApiKey` is not part of the chain: `20260411100000_bot_baseline_tables` creates
-- `BotConfig` without that column. A previous `ALTER TABLE "BotConfig" ... DROP` made
-- `prisma migrate dev` fail on the shadow DB (P1014) with hand-written baselines.
SELECT 1;
