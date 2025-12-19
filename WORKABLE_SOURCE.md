# Adding Workable as a Source

## ✅ Changes Made

1. **Updated Prisma Schema** - Added `WORKABLE` to `JobSource` enum
2. **Updated API Mapping** - Maps "Workable" → `JobSource.WORKABLE`
3. **Created Migration** - `20251219142656_add_workable_source`

## 🚀 Apply the Migration

Run this command:

```bash
cd my-app
bunx prisma migrate deploy
```

**OR** run in Supabase SQL Editor:

```sql
ALTER TYPE "JobSource" ADD VALUE 'WORKABLE';
```

## ✅ After Migration

1. **Restart dev server**: Stop (Ctrl+C) then `bun run dev`
2. **Reload extension**: `chrome://extensions/` → Reload
3. **Save a Workable job**: Should now show source as "Workable" ✅

## Current Source Mapping

| Extension Shows | Database Stores |
|----------------|-----------------|
| LinkedIn | `LINKEDIN` |
| Indeed | `INDEED` |
| Greenhouse | `COMPANY_SITE` |
| Lever | `COMPANY_SITE` |
| **Workable** | **`WORKABLE`** ✅ |
| EU Remote Jobs | `EU_REMOTE_JOBS` |
| Extension | `OTHER` |

Now Workable has its own proper source type! 🎉
