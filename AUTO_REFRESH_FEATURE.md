# Auto-Refresh Indicator

## ✨ Feature Added

A subtle auto-refresh indicator has been added next to the notification bell in the top bar.

## 🎨 Visual Design

- **Icon**: Rotating refresh icon (RefreshCw from Lucide)
- **Animation**: Spins when refreshing
- **Color**: Muted gray normally, changes to primary color when active
- **Pulse effect**: Subtle pulse animation during refresh
- **Tooltip**: Shows "Auto-refreshing in Xs"

## ⚙️ Configuration

The component is highly configurable:

```tsx
<AutoRefreshIndicator 
  intervalSeconds={30}    // How often to refresh (default: 30s)
  enabled={true}          // Enable/disable auto-refresh (default: true)
  showTimer={false}       // Show countdown timer (default: false)
/>
```

### Current Settings
- **Interval**: 30 seconds
- **Enabled**: Yes
- **Timer visible**: No (cleaner UI)
- **Location**: Top bar, between search and notification bell

## 🎯 Features

1. **Auto-refresh**: Automatically calls `router.refresh()` every 30 seconds
2. **Visual feedback**: Spinning animation when refresh occurs
3. **Countdown**: Tracks time until next refresh
4. **Tooltip**: Hover to see when next refresh happens
5. **Smooth animations**: Uses Tailwind transitions

## 🎨 Animations

- **Spin**: Icon rotates 360° during refresh (1 second)
- **Pulse**: Subtle pulse effect radiates from icon
- **Color change**: Gray → Primary color transition
- **Smooth**: All animations use `transition-all duration-500`

## 🛠️ Customization Options

### Show the timer
```tsx
<AutoRefreshIndicator showTimer={true} />
// Shows: 🔄 25s
```

### Change interval
```tsx
<AutoRefreshIndicator intervalSeconds={60} />
// Refreshes every minute
```

### Disable temporarily
```tsx
<AutoRefreshIndicator enabled={false} />
// No auto-refresh (useful for settings)
```

## 📍 Location

Added to `SimpleTopBar` component:
```
Logo  |  Search  |  [Auto-refresh] 🔔 [Notifications] 👤 [Profile]
```

## 🚀 Usage

The indicator is now active on all pages that use `SimpleTopBar`. It will:

1. Refresh the page data every 30 seconds
2. Show a spinning animation during refresh
3. Display countdown in tooltip on hover
4. Keep UI in sync with database changes

Perfect for seeing new jobs from the extension or email sync without manual refresh! 🎉

## 🎨 Color Palette Used

From the Clause-inspired palette:
- **Muted gray**: `text-muted-foreground` (#8A8A8A)
- **Primary**: `text-primary` (#3A5B57)
- **Pulse**: `bg-primary/20` (20% opacity primary)

Clean, subtle, and professional! ✨
