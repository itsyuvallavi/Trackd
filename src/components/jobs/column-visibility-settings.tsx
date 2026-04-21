'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ColumnKey = 'role' | 'company' | 'source' | 'location' | 'status' | 'notes'

interface ColumnVisibilitySettingsProps {
  visibleColumns: Set<ColumnKey>
  onColumnsChange: (columns: Set<ColumnKey>) => void
}

const COLUMN_LABELS: Record<ColumnKey, string> = {
  role: 'Role',
  company: 'Company',
  source: 'Fetched via (API)',
  location: 'Location',
  status: 'Status',
  notes: 'Notes',
}

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = ['role', 'company', 'source', 'location', 'status', 'notes']

export function ColumnVisibilitySettings({ visibleColumns, onColumnsChange }: ColumnVisibilitySettingsProps) {
  const handleToggle = (column: ColumnKey) => {
    const newColumns = new Set(visibleColumns)
    if (newColumns.has(column)) {
      newColumns.delete(column)
    } else {
      newColumns.add(column)
    }
    onColumnsChange(newColumns)
    
    // Save to localStorage
    localStorage.setItem('jobs-column-visibility', JSON.stringify(Array.from(newColumns)))
  }

  const handleReset = () => {
    const defaultSet = new Set(DEFAULT_VISIBLE_COLUMNS)
    onColumnsChange(defaultSet)
    localStorage.setItem('jobs-column-visibility', JSON.stringify(Array.from(defaultSet)))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8"
          >
            <Settings2 className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <div className="px-2 py-1.5 flex items-center justify-between">
            <DropdownMenuLabel className="p-0">Visible Columns</DropdownMenuLabel>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
            >
              Reset
            </Button>
          </div>
          <DropdownMenuSeparator />
          {DEFAULT_VISIBLE_COLUMNS.map((column) => (
            <DropdownMenuCheckboxItem
              key={column}
              checked={visibleColumns.has(column)}
              onCheckedChange={() => handleToggle(column)}
            >
              {COLUMN_LABELS[column]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function useColumnVisibility() {
  // Always start with default columns to match server render
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    return new Set(DEFAULT_VISIBLE_COLUMNS)
  })
  
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage after hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true)
    try {
      const saved = localStorage.getItem('jobs-column-visibility')
      if (saved) {
        const parsed = JSON.parse(saved) as ColumnKey[]
        setVisibleColumns(new Set(parsed))
      }
    } catch (error) {
      console.error('Error loading column visibility:', error)
    }
  }, [])

  return { visibleColumns, setVisibleColumns, isHydrated }
}

