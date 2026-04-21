-- `schema.prisma` includes `BOT` on `JobSource`; this value was missing from migration SQL until now.
ALTER TYPE "JobSource" ADD VALUE IF NOT EXISTS 'BOT';
