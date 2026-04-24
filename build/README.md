# Build resources

`icon.png` — square app icon, used by `electron-builder` as source for the macOS `.icns` and Windows `.ico`.

- Minimum recommended size : **512×512** px
- Transparent background : yes
- Replace this file with a higher-resolution version for production builds.

## Build commands

**Windows installer (from a Windows machine)** :

```bash
npm ci
npm run dist:win
```

Output : `release/APM35-Gestion-Setup-<version>.exe` (NSIS installer with choice of install dir, desktop + start-menu shortcuts).

**macOS DMG** :

```bash
npm run dist:mac
```

Output : `release/APM35 Gestion-<version>-<arch>.dmg`

## Cross-building from macOS for Windows

Possible with `brew install --cask wine-stable`, but `better-sqlite3` must be rebuilt against Windows Electron headers. Safer path : build on Windows directly (or a Windows CI runner).
