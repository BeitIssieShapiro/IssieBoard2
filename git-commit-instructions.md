# Git Commit Instructions

This file documents the guidelines for creating git commits in this project.

## Commit Format

Each commit should follow this structure:

```
[Category] Brief description

Feature/Bug Request:
- What was requested or what bug was being fixed

Changes Made:
- List of changes implemented
- Technical details

Leftovers/TODO:
- Any incomplete work or future improvements needed
```

## Categories
- `[Feature]` - New feature implementation
- `[Fix]` - Bug fix
- `[Refactor]` - Code refactoring
- `[Docs]` - Documentation changes
- `[Test]` - Test additions/modifications

## Example

```
[Feature] Add dark mode support

Feature/Bug Request:
- User requested dark mode theme option
- Should persist across app restarts

Changes Made:
- Added ThemeManager class to handle theme switching
- Updated all UI components to support dynamic colors
- Added theme preference to UserDefaults/SharedPreferences

Leftovers/TODO:
- Need to add animation during theme transition
- Some third-party libraries don't support dark mode yet