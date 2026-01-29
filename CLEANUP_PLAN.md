# Project Cleanup and Reorganization Plan

## Files Analysis

### Root Directory - Files to Move/Delete

#### Documentation Files (Move to `/docs`)
- ✅ KEEP: `README.md` (keep in root)
- ✅ KEEP: `CLAUDE.md` (keep in root - used by Claude Code)
- 📁 MOVE: `PROJECT_PLAN.md` → `/docs/PROJECT_PLAN.md`
- 📁 MOVE: `FIGMA_BRIEF.md` → `/docs/FIGMA_BRIEF.md`
- 📁 MOVE: `apptracker.md` → `/docs/product-spec.md` (rename for clarity)

#### Test/Sync Scripts (Move to `/scripts`)
- 📁 MOVE: `test-email.ts` → `/scripts/test-email.ts`
- 📁 MOVE: `setup-and-sync.ts` → `/scripts/setup-and-sync.ts`
- 📁 MOVE: `sync-today.ts` → `/scripts/sync-today.ts`
- 📁 MOVE: `sync-emails-now.ts` → `/scripts/sync-emails-now.ts`
- 📁 MOVE: `sync-recent.ts` → `/scripts/sync-recent.ts`

---

## Components Directory Reorganization

### Current Components Status

#### ✅ KEEP - Currently Used
- `Sidebar.tsx` - Main navigation
- `jobs-page-content.tsx` - Jobs table view
- `add-job-modal.tsx` - Add job modal
- `job-actions-menu.tsx` - Job row actions
- `user-profile-menu.tsx` - Profile dropdown

#### ❌ DELETE - Unused/Deprecated
- `Header.tsx` - Not used anymore (header is inline in jobs page)
- `nav.tsx` - Old navbar, replaced by Sidebar
- `status-badge.tsx` - Replaced by ui/badge.tsx
- `job-row.tsx` - Not used in current table implementation

#### 🔄 EVALUATE - May Need Refactoring
- `board-card.tsx` - Will be used in board view (keep)
- `board-column.tsx` - Will be used in board view (keep)
- `edit-job-modal.tsx` - Keep for job editing
- `email-integration-form.tsx` - Keep for settings
- `status-dropdown.tsx` - Keep for status changes
- `sync-emails-button.tsx` - Keep for manual sync

### Proposed Component Folder Structure

```
src/components/
├── layout/                    # Layout components
│   ├── Sidebar.tsx
│   └── user-profile-menu.tsx
│
├── jobs/                      # Job-related components
│   ├── add-job-modal.tsx
│   ├── edit-job-modal.tsx
│   ├── job-actions-menu.tsx
│   ├── jobs-page-content.tsx
│   └── status-dropdown.tsx
│
├── board/                     # Kanban board components
│   ├── board-card.tsx
│   └── board-column.tsx
│
├── email/                     # Email integration components
│   ├── email-integration-form.tsx
│   └── sync-emails-button.tsx
│
└── ui/                        # Reusable UI primitives
    ├── badge.tsx
    ├── button.tsx
    ├── input.tsx
    ├── select.tsx
    └── table.tsx
```

---

## Import Path Updates Required

After reorganization, we'll need to update imports in these files:

### Files Using Sidebar
- `/src/app/(authenticated)/jobs/page.tsx`
- `/src/app/(authenticated)/board/page.tsx`
- `/src/app/(authenticated)/today/page.tsx`
- `/src/app/(authenticated)/settings/integrations/page.tsx`

**Old:** `@/components/Sidebar`
**New:** `@/components/layout/Sidebar`

### Files Using Job Components
- `/src/app/(authenticated)/jobs/page.tsx`
- `/src/app/(authenticated)/jobs/[id]/page.tsx` (when created)

**Old:** `@/components/add-job-modal`, `@/components/job-actions-menu`, etc.
**New:** `@/components/jobs/add-job-modal`, `@/components/jobs/job-actions-menu`, etc.

### Files Using Board Components
- `/src/app/(authenticated)/board/page.tsx`

**Old:** `@/components/board-card`, `@/components/board-column`
**New:** `@/components/board/board-card`, `@/components/board/board-column`

### Files Using Email Components
- `/src/app/(authenticated)/settings/integrations/page.tsx`

**Old:** `@/components/email-integration-form`, `@/components/sync-emails-button`
**New:** `@/components/email/email-integration-form`, `@/components/email/sync-emails-button`

---

## Step-by-Step Cleanup Actions

### Phase 1: Create New Directories
```bash
mkdir -p docs
mkdir -p scripts
mkdir -p src/components/layout
mkdir -p src/components/jobs
mkdir -p src/components/board
mkdir -p src/components/email
```

### Phase 2: Move Documentation
```bash
mv PROJECT_PLAN.md docs/
mv FIGMA_BRIEF.md docs/
mv apptracker.md docs/product-spec.md
```

### Phase 3: Move Scripts
```bash
mv test-email.ts scripts/
mv setup-and-sync.ts scripts/
mv sync-today.ts scripts/
mv sync-emails-now.ts scripts/
mv sync-recent.ts scripts/
```

### Phase 4: Delete Unused Components
```bash
rm src/components/Header.tsx
rm src/components/nav.tsx
rm src/components/status-badge.tsx
rm src/components/job-row.tsx
```

### Phase 5: Reorganize Components
```bash
# Layout
mv src/components/Sidebar.tsx src/components/layout/
mv src/components/user-profile-menu.tsx src/components/layout/

# Jobs
mv src/components/add-job-modal.tsx src/components/jobs/
mv src/components/edit-job-modal.tsx src/components/jobs/
mv src/components/job-actions-menu.tsx src/components/jobs/
mv src/components/jobs-page-content.tsx src/components/jobs/
mv src/components/status-dropdown.tsx src/components/jobs/

# Board
mv src/components/board-card.tsx src/components/board/
mv src/components/board-column.tsx src/components/board/

# Email
mv src/components/email-integration-form.tsx src/components/email/
mv src/components/sync-emails-button.tsx src/components/email/
```

### Phase 6: Update Import Paths
Update imports in all files that reference moved components.

---

## Updated Project Structure

```
my-app/
├── docs/                           # 📁 NEW - Documentation
│   ├── PROJECT_PLAN.md
│   ├── FIGMA_BRIEF.md
│   └── product-spec.md
│
├── scripts/                        # 📁 NEW - Utility scripts
│   ├── test-email.ts
│   ├── setup-and-sync.ts
│   ├── sync-today.ts
│   ├── sync-emails-now.ts
│   └── sync-recent.ts
│
├── src/
│   ├── app/
│   │   ├── (authenticated)/
│   │   │   ├── layout.tsx
│   │   │   ├── today/
│   │   │   │   └── page.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── actions.ts
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── new-url/
│   │   │   │       └── page.tsx
│   │   │   ├── board/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── integrations/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── preferences/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── account/
│   │   │   │       └── page.tsx
│   │   │   └── onboarding/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── scrape-job/
│   │   │   │   └── route.ts
│   │   │   ├── jobs/
│   │   │   │   └── from-extension/
│   │   │   │       └── route.ts
│   │   │   ├── auth/
│   │   │   │   └── gmail/
│   │   │   │       ├── route.ts
│   │   │   │       └── callback/
│   │   │   │           └── route.ts
│   │   │   └── cron/
│   │   │       └── sync-emails/
│   │   │           └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── layout/                 # 📁 NEW - Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   └── user-profile-menu.tsx
│   │   │
│   │   ├── jobs/                   # 📁 NEW - Job-related components
│   │   │   ├── add-job-modal.tsx
│   │   │   ├── edit-job-modal.tsx
│   │   │   ├── job-actions-menu.tsx
│   │   │   ├── jobs-page-content.tsx
│   │   │   ├── jobs-search.tsx     # To be created
│   │   │   ├── job-detail-view.tsx # To be created
│   │   │   ├── job-timeline.tsx    # To be created
│   │   │   ├── job-edit-form.tsx   # To be created
│   │   │   └── status-dropdown.tsx
│   │   │
│   │   ├── board/                  # 📁 NEW - Kanban board
│   │   │   ├── board-card.tsx
│   │   │   ├── board-column.tsx
│   │   │   └── kanban-board.tsx    # To be created
│   │   │
│   │   ├── email/                  # 📁 NEW - Email integration
│   │   │   ├── email-integration-form.tsx
│   │   │   └── sync-emails-button.tsx
│   │   │
│   │   ├── dashboard/              # 📁 NEW - Dashboard widgets
│   │   │   ├── status-counter.tsx  # To be created
│   │   │   ├── status-stats.tsx    # To be created
│   │   │   ├── today-tasks.tsx     # To be created
│   │   │   └── upcoming-deadlines.tsx # To be created
│   │   │
│   │   ├── settings/               # 📁 NEW - Settings components
│   │   │   ├── settings-layout.tsx # To be created
│   │   │   └── profile-form.tsx    # To be created
│   │   │
│   │   ├── onboarding/             # 📁 NEW - Onboarding flow
│   │   │   ├── onboarding-steps.tsx # To be created
│   │   │   ├── onboarding-email-setup.tsx # To be created
│   │   │   └── onboarding-extension-prompt.tsx # To be created
│   │   │
│   │   └── ui/                     # Reusable UI primitives
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── card.tsx            # To be created
│   │       ├── dialog.tsx          # To be created
│   │       └── dropdown.tsx        # To be created
│   │
│   └── lib/
│       ├── prisma.ts
│       ├── constants.ts
│       ├── utils.ts
│       ├── gmail-client.ts         # To be created
│       ├── email-parser.ts         # To be created
│       ├── email-rules.ts          # To be created
│       └── job-scraper.ts          # To be created
│
├── prisma/
│   └── schema.prisma
│
├── public/
│
├── extension/                      # 📁 NEW - Chrome extension
│   ├── manifest.json
│   ├── popup.html
│   ├── background.js
│   └── content-script.js
│
├── .env
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── CLAUDE.md                       # Keep in root
└── README.md                       # Keep in root
```

---

## Benefits of This Organization

### 1. **Clear Component Categories**
- Easy to find related components
- Logical grouping by feature area
- Scalable as project grows

### 2. **Separation of Concerns**
- Layout components separate from feature components
- UI primitives clearly defined
- Business logic components grouped by domain

### 3. **Better Developer Experience**
- Intuitive folder structure
- Faster navigation
- Clear naming conventions

### 4. **Cleaner Root Directory**
- Documentation in one place
- Scripts separate from source
- Only essential config files in root

---

## Next Steps

1. ✅ Review this cleanup plan
2. Execute Phase 1-5 (create dirs, move files, delete unused)
3. Update all import paths in affected files
4. Test that everything still works
5. Update PROJECT_PLAN.md with new structure
6. Commit changes

**Ready to execute?** Let me know and I'll run all the commands and update the imports!
