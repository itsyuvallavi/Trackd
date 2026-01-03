#!/usr/bin/env bun
/**
 * Update JobStatus enum from GHOSTED to ARCHIVED
 * 
 * This script updates the database enum and migrates existing records.
 * 
 * Usage:
 *   bun run src/scripts/update-enum-to-archived.ts
 */

import { prisma } from '../lib/prisma'

async function updateEnum() {
  try {
    console.log('🔄 Updating JobStatus enum from GHOSTED to ARCHIVED...')
    
    // Step 1: Update the enum value
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        -- Check if ARCHIVED exists, if not rename GHOSTED to ARCHIVED
        IF EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'GHOSTED' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'JobStatus')
        ) THEN
          ALTER TYPE "JobStatus" RENAME VALUE 'GHOSTED' TO 'ARCHIVED';
          RAISE NOTICE 'Enum value GHOSTED renamed to ARCHIVED';
        ELSIF EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'ARCHIVED' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'JobStatus')
        ) THEN
          RAISE NOTICE 'Enum value ARCHIVED already exists';
        ELSE
          RAISE EXCEPTION 'Neither GHOSTED nor ARCHIVED found in JobStatus enum';
        END IF;
      END $$;
    `)
    
    console.log('✅ Enum updated successfully')
    
    // Step 2: Update any existing GHOSTED records to ARCHIVED (shouldn't be needed, but just in case)
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "Job" 
      SET status = 'ARCHIVED'::"JobStatus" 
      WHERE status::text = 'GHOSTED'
    `)
    
    console.log(`✅ Updated existing records (if any)`)
    console.log('\n✅ Migration complete! You can now use ARCHIVED in your code.')
    
  } catch (error) {
    console.error('❌ Error updating enum:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateEnum()

