# Orbital

A minimal, command-palette-driven browser. Built on Electron, portable to mobile via Capacitor.

## Design Philosophy

Orbital breaks from the traditional browser layout. Instead of a persistent toolbar, everything is accessed through a **command palette** (Ctrl+K). The result is a distraction-free browsing experience with maximum screen space for content.

- **Command Palette**: Ctrl+K opens a searchable command bar for URLs, navigation, settings, and actions
- **Vertical Tabs**: Sidebar-based tab management inspired by VS Code
- **Minimal Chrome**: The nav bar auto-hides; only appears when you need it
- **Clean, Minimal**: No clutter, no noise — just you and the web

## Quick Start

```bash
npm install
npm start           # Launch browser
npm start -- --dev  # Launch with DevTools open
npm start -- --private  # Launch in private mode
```

## Desktop Build

```bash
npm run build:win    # Windows NSIS installer
npm run build:linux  # Linux AppImage + .deb
npm run build:mac    # macOS
npm run build:all    # All platforms
```

## Mobile (Android)

```bash
npm run mobile:add:android   # Generate Android project
npm run mobile:sync          # Sync web assets
npm run mobile:open:android  # Open in Android Studio
```

From Android Studio, build and deploy to a device or emulator.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Command Palette |
| Ctrl+T | New Tab |
| Ctrl+W | Close Tab |
| Ctrl+Tab | Next Tab |
| Ctrl+Shift+Tab | Previous Tab |
| Ctrl+D | Bookmark Page |
| Ctrl+H | History |
| Ctrl+J | Downloads |
| Ctrl+Shift+O | Bookmark Manager |
| Ctrl+Shift+N | New Private Window |
| Ctrl+R | Reload |
| F11 | Fullscreen |
| Ctrl+F | Find in Page |
| Ctrl+Shift+I | Developer Tools |

## Features

- **Command Palette**: Everything at your fingertips
- **Privacy First**: Tracker blocking, fingerprinting protection, forced HTTPS
- **Vertical Tab Management**: Clean sidebar-based tabs
- **Bookmarks & History**: Full manager with search
- **Download Manager**: Track and manage downloads
- **Extension Support**: Chrome API shim (MV3)
- **Password Manager**: Save and autofill passwords
- **Mobile Ready**: Capacitor-powered Android app
