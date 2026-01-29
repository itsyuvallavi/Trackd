# Pattern-Based Location Detection

## Overview

The extension now uses **pattern matching as the primary method** for location detection, with hardcoded country names only as a fallback/confidence booster.

## How It Works

### Priority System (Lower = Better)

| Priority | Pattern | Example | Country List Used? |
|----------|---------|---------|-------------------|
| 1 | US State (City, ST) | "San Francisco, CA" | ✅ (verify ST) |
| 1 | Location + work type | "Warsaw, Poland (Remote)" | ❌ |
| 1-2 | City, Region, Country | "Munich, Bavaria, Germany" | Only to boost confidence |
| 1-2 | City, Country | "Malibu, CA" | Only to boost confidence |
| 2-3 | Single word (4+ chars) | **"Lithuania"** | Only to boost confidence |
| 5 | Contains country name | "Remote in Poland" | ✅ (fallback only) |
| 7 | Work type only | "Remote" | ❌ |
| 8 | Contains location keyword | "hybrid position" | ❌ (fallback only) |

## Key Improvements

### ✅ Pattern-First Approach

**Before** (hardcoded dependency):
```javascript
// Had to list every country
if (countryNames.includes(text)) { ... }
// "Lithuania" didn't work unless in the list ❌
```

**After** (pattern-based):
```javascript
// Works for ANY single-word country!
if (text.match(/^[A-Z][a-zA-Z]{3,}$/)) { ... }
// "Lithuania" works ✅
// "Lesotho" works ✅
// "Mongolia" works ✅
```

### ✅ Hardcoded List as Fallback

The country names list is now used in 3 limited ways:

1. **Confidence boost**: If "Lithuania" matches the single-word pattern AND is in the list, give it priority 2 instead of 3
2. **Comma-separated boost**: "Munich, Bavaria, Germany" gets priority 1 instead of 2 if "Germany" is verified
3. **Safety net**: If unusual format doesn't match patterns, check if it contains a known country (priority 5)

### ✅ Pattern Examples

**Works WITHOUT hardcoded list:**
- Single word countries: Lithuania, Mongolia, Ethiopia, Lesotho
- Two-part format: "Reykjavik, Iceland", "Tallinn, Estonia"
- Three-part format: "São Paulo, São Paulo, Brazil"
- Work type combos: "Hybrid", "Remote", "Berlin (Remote)"

**Uses hardcoded list only for verification:**
- US states: "CA", "NY" (must be in usStates array)
- Confidence boost: Verified countries get slightly higher priority
- Fallback: Catches edge cases like "Remote in Poland"

## Debug Output

Console logs now show the detection reason:

```
[Trackd LinkedIn Debug] Top 5 candidates:
  "Lithuania" (priority: 2, reason: Single word (verified country))
  "Remote" (priority: 7, reason: Work type only)
  "Malibu, CA" (priority: 1, reason: 2-part location (pattern))
```

This helps you understand:
- Why each location was detected
- Whether the hardcoded list was used
- Which pattern matched

## Why This Is Better

### Scalability
- ✅ Works for new countries without updates
- ✅ Handles regional spellings (München, Zürich)
- ✅ Supports international characters (São Paulo, Wrocław)

### Maintainability
- ✅ Less code to maintain
- ✅ Patterns are self-documenting
- ✅ Easy to add new patterns without growing lists

### Reliability
- ✅ Doesn't break if country list is incomplete
- ✅ Pattern matching is more robust
- ✅ Multiple fallback layers

## Testing

Reload extension and test:

1. **Lithuania job** → Should detect "Lithuania" via single-word pattern
2. **Any country** → Should work even if not in hardcoded list
3. **Console** → Check detection reasons

```bash
# Reload extension
chrome://extensions/ → Click reload 🔄

# Test and check console
F12 → Console tab → Look for detection reasons
```

## Future Enhancements

Since we're pattern-first, we can easily add:
- ✅ Timezone patterns ("UTC+2", "EST")
- ✅ Postal codes ("10001", "SW1A 1AA")
- ✅ Continent detection ("Europe", "Asia")
- ✅ Multi-language support ("À distance", "遠程")

All without maintaining massive lists!
