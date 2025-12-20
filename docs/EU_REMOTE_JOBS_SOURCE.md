# Adding EU Remote Jobs as a Source

## ✅ What Was Done

### 1. Updated Prisma Schema
Added `EU_REMOTE_JOBS` to the `JobSource` enum in `prisma/schema.prisma`:

```prisma
enum JobSource {
  MANUAL
  LINKEDIN
  INDEED
  COMPANY_SITE
  REFERRAL
  RECRUITER
  EU_REMOTE_JOBS  // ← NEW!
  OTHER
}
```

### 2. Updated API Mapping
Updated `src/app/api/extension/save-job/route.ts` to map "EU Remote Jobs" → `JobSource.EU_REMOTE_JOBS`

### 3. Created Migration
Created migration file: `prisma/migrations/20251219124625_add_eu_remote_jobs_source/migration.sql`

## 🚀 Apply the Migration

Run this command to apply the migration to your database:

```bash
cd my-app
bunx prisma migrate deploy
```

**OR** if that has connection issues, run the SQL directly:

```bash
# Option 1: Using Prisma Studio
bunx prisma studio
# Then run: ALTER TYPE "JobSource" ADD VALUE 'EU_REMOTE_JOBS';

# Option 2: Using Supabase Dashboard
# Go to your Supabase project → SQL Editor
# Run: ALTER TYPE "JobSource" ADD VALUE 'EU_REMOTE_JOBS';
```

## ✅ Verify It Works

After applying the migration:

1. **Restart your dev server**:
   ```bash
   # Stop server (Ctrl+C)
   bun run dev
   ```

2. **Reload extension**:
   ```
   chrome://extensions/ → Reload Trackd extension
   ```

3. **Test**:
   - Go to an EU Remote Jobs listing
   - Click extension → Save job
   - Go to http://localhost:3000/jobs
   - The job should show source as "EU Remote Jobs" ✅

## 🔍 How to Check Source in Database

```sql
SELECT id, company, title, source 
FROM "Job" 
WHERE source = 'EU_REMOTE_JOBS' 
LIMIT 5;
```

## Current Source Mapping

| Extension Shows | Database Stores |
|----------------|-----------------|
| LinkedIn | `LINKEDIN` |
| Indeed | `INDEED` |
| Greenhouse | `COMPANY_SITE` |
| Lever | `COMPANY_SITE` |
| **EU Remote Jobs** | **`EU_REMOTE_JOBS`** ✅ |
| Extension | `OTHER` |
| Unknown | `OTHER` |

## Troubleshooting

### Migration fails with TLS error?

Run the SQL manually in Supabase:
```sql
ALTER TYPE "JobSource" ADD VALUE 'EU_REMOTE_JOBS';
```

### "EU_REMOTE_JOBS" doesn't exist error?

The migration hasn't been applied yet. Run `bunx prisma migrate deploy` or apply SQL manually.

### Jobs still saving as "OTHER"?

1. Make sure migration is applied
2. Restart dev server
3. Check that TypeScript types are regenerated: `bunx prisma generate`
4. Reload extension

## ✨ You're Done!

Once the migration is applied:
- ✅ Schema updated
- ✅ API mapping updated  
- ✅ Extension sends correct source
- ✅ Database stores `EU_REMOTE_JOBS`
- ✅ Jobs page will display correct source

Just run the migration and test! 🚀
