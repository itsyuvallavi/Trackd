'use client'

import { useState } from 'react'
import { CalendarPageContent, CalendarEvent } from './calendar-page-content'
import { CalendarSidebar } from './calendar-sidebar'

interface CalendarPageWrapperProps {
  events: CalendarEvent[]
  monthStart: Date
}

export function CalendarPageWrapper({ events, monthStart }: CalendarPageWrapperProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const handleSidebarCollapse = () => {
    setIsSidebarCollapsed(true)
  }

  const handleSidebarExpand = () => {
    setIsSidebarCollapsed(false)
  }

  return (
    <>
      {/* Main Content - Always centered, sidebar overlays when open */}
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
          <div className="w-full max-w-[1160px]">
            <CalendarPageContent 
              events={events} 
              monthStart={monthStart}
            />
          </div>
        </div>
      </div>

      {/* Calendar Sidebar - Desktop only, always rendered, overlays content */}
      <div className="hidden lg:block">
        <CalendarSidebar
          events={events}
          onClose={handleSidebarCollapse}
          onExpand={handleSidebarExpand}
          isCollapsed={isSidebarCollapsed}
        />
      </div>
    </>
  )
}

