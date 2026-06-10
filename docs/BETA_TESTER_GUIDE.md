# Trackd Beta Tester Guide

Thank you for helping test Trackd. This guide covers setup, what to try, and how to report issues.

## Getting started

1. **Open the app:** https://trackd-eight.vercel.app (or the URL your invite email includes)
2. **Create an account** with email/password or **Continue with Google**
3. **Complete onboarding** — you can skip email setup and connect it later
4. **Install the browser extension** (Chrome recommended):
   - Download the zip from **Settings → Integrations → Download extension**, or visit `/api/download-extension`
   - Unzip, then in Chrome go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder
   - In Trackd, generate an **Extension key** on the integrations page and paste it into the extension popup

## What to test (in scope)

| Area | What to try |
|------|-------------|
| **Applications** | Add a job manually, add from URL, edit status, delete |
| **Board** | Drag jobs between columns at `/board` |
| **Extension** | Save jobs from LinkedIn and Indeed job pages |
| **Email sync** | Connect Gmail or Outlook under **Email sync**, run **Sync Now**, check the notification bell |
| **Profile** | Update your display name at `/profile` |
| **Feedback** | Use **Send feedback** in the user menu (avatar, top right) |

## Optional (by invitation only)

- **Job Search bot** (`/bot`) — AI job discovery and queue. Requires the team to enable API access for your account.

## Not available in this beta

- **Auto-apply** — not enabled in the UI
- **Password reset** — contact the team if you are locked out
- **Chrome Web Store install** — sideload/unzip only for now

## Reporting bugs

1. Use **Send feedback** in the app (preferred — includes your account context)
2. Or email the team address from your invite

Include:
- What you were trying to do
- What happened vs what you expected
- Browser (Chrome version) and whether the extension was involved
- Screenshot if helpful

## Data & privacy notice

Trackd processes data you provide to deliver the service:

- **Job applications** you create or save
- **Email content** if you connect Gmail/Outlook (used to detect application updates)
- **Resumes** if you upload them (bot search or resume advisor)
- Some features use **OpenAI** for classification, matching, and AI assistance

Do not use production credentials you are unwilling to store in a beta product. You can disconnect email integration at any time from **Email sync** settings.

## Known limitations

- Extension must be installed manually (not from the Chrome Web Store)
- Google sign-in may require your email to be added as a test user until the app is publicly verified
- Background email sync runs on a schedule — use **Sync Now** for immediate results
- Best experience in **Chrome** on desktop

## Quick troubleshooting

| Problem | Try |
|---------|-----|
| Extension won't connect | Regenerate key; confirm you copied the full `tk_...` value |
| Extension saves fail | Check you're logged into the same account that owns the key |
| Email OAuth fails | Try again from `/settings/integrations`; confirm you approved all permissions |
| Redirect loop after login | Clear cookies for the app domain and sign in again |
| Empty jobs after extension save | Refresh `/jobs`; check extension shows "Connected as [your email]" |
