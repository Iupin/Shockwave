# Changelog

## 1.1.1

Seeking and song metadata.

### Fixed

- Seeking a track no longer restarts it from the beginning. Playback now supports range requests, so the seek bar jumps to the chosen time.
- Imported songs no longer use a YouTube video frame as the cover. Album name and artwork come from iTunes, Deezer, and MusicBrainz.

### Notes

- Songs imported before this version keep their old tags. Import them again to pick up album and artwork.

### Installer

- `Shockwave-Setup-1.1.1.exe`
- `Shockwave-Setup-1.1.1.exe.blockmap`
- `latest.yml`

## 1.1.0

Delete songs from the app.

### Added

- Delete a song from the track list (hover trash icon or right-click). After confirm, the file is moved to the Recycle Bin and removed from the library and playlists.

### Installer

- `Shockwave-Setup-1.1.0.exe`
- `Shockwave-Setup-1.1.0.exe.blockmap`
- `latest.yml`

## 1.0.0

First public release.

- Spotify-like local library, playlists, search, and player
- Repository folder for music, playlists, and settings
- Drag-and-drop audio import
- Import audio from a video URL
- Auto-update from GitHub Releases
- Changelog after an update

### Installer

- `Shockwave-Setup-1.0.0.exe`
- `Shockwave-Setup-1.0.0.exe.blockmap`
- `latest.yml`
