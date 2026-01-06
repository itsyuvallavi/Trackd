# Feedback System Implementation Plan

## Overview
Add a simple, unobtrusive feedback system that allows users to report errors and malfunctions from both the web app and browser extension.

## Goals
- Minimal UI footprint (not too many buttons)
- Easy access for users to report issues
- Support for both web app and browser extension
- Store feedback in database for review
- Optional: Email notifications for new feedback

## Implementation Steps

### 1. Database Schema
Add a `Feedback` model to Prisma schema:
- `id` (String, cuid)
- `userId` (String, optional - for authenticated users)
- `userEmail` (String, optional - for extension users or anonymous)
- `type` (Enum: ERROR, BUG, FEATURE_REQUEST, OTHER)
- `source` (Enum: WEB, EXTENSION)
- `title` (String)
- `description` (String)
- `url` (String, optional - page/context where issue occurred)
- `userAgent` (String, optional - browser info)
- `metadata` (Json, optional - additional context)
- `status` (Enum: NEW, REVIEWED, RESOLVED)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### 2. Web App Implementation

#### 2.1 Feedback Button Component
- Add a floating feedback button (bottom-right corner, small icon)
- Icon: MessageSquare or AlertCircle
- Opens a modal/dialog when clicked
- Minimal design, doesn't interfere with main UI

#### 2.2 Feedback Modal Component
- Simple form with:
  - Type selector (Error/Bug, Feature Request, Other)
  - Title field
  - Description textarea
  - Optional: Current page URL (auto-filled)
  - Submit button
- Client component with form handling
- Calls API endpoint to submit feedback

#### 2.3 API Endpoint
- `/api/feedback` (POST)
- Validates input
- Saves to database
- Returns success/error response
- Optionally sends email notification

#### 2.4 Integration Points
- Add feedback button to `AppShell` or `SimpleTopBar`
- Accessible from all authenticated pages
- Can also add to user profile menu as "Report Issue"

### 3. Browser Extension Implementation

#### 3.1 Extension UI
- Add "Report Issue" button to extension footer
- Opens a simple form in the popup
- Pre-fills context (current URL, extension version if available)
- Submits to same API endpoint

#### 3.2 Extension Script Updates
- Add feedback submission function to `popup.js`
- Handle form submission
- Show success/error messages

### 4. Admin/Review System (Optional)

#### 4.1 Feedback List Page
- Simple admin page at `/admin/feedback` (or `/settings/feedback`)
- List all feedback submissions
- Filter by status, type, source
- Mark as reviewed/resolved
- View details

#### 4.2 Email Notifications (Optional)
- Send email to admin when new feedback is submitted
- Include key details (type, title, user info)

## UI/UX Considerations

### Web App
- **Floating Button**: Small, unobtrusive, bottom-right corner
- **Icon**: MessageSquare or AlertCircle (lucide-react)
- **Modal**: Clean, simple form, matches app design
- **Success State**: Brief toast notification after submission

### Browser Extension
- **Footer Button**: Add to existing footer alongside Settings/Disconnect
- **Form**: Inline in popup, or small modal overlay
- **Context**: Auto-fill current page URL and source

## Database Migration
- Create migration for new `Feedback` model
- Add indexes on `userId`, `status`, `createdAt` for efficient queries

## Security Considerations
- Rate limiting on API endpoint (prevent spam)
- Optional: Require authentication for web app feedback
- Extension feedback can use extension key for identification
- Sanitize user input

## Future Enhancements
- Screenshot capture (for visual bug reports)
- Feedback categories/tags
- User-facing status updates ("We're working on this")
- Integration with issue tracking system (GitHub Issues, Linear, etc.)

