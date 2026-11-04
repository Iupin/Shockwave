# Changelog

## 1.6.0

Send a Shockwave library to Aftershock on the same network.

### Added

- Shockwave looks for Aftershock over the local network. Sync is in the top bar.
- When a phone is found, Aftershock asks before anything is copied.
- Shockwave sends the songs, artwork, playlists, and liked songs. The desktop library is the source, and the phone replaces its copy.

### Installer

- `Shockwave-Setup-1.6.0.exe`
- `Shockwave-Setup-1.6.0.exe.blockmap`
- `latest.yml`

## 1.5.0

Discord Rich Presence while Shockwave is open.

### Added

- Shockwave shows on Discord while the app is running. When a song is playing, Discord shows the title, artist, and a duration bar.
- Rich Presence is on by default. Turn it off from Settings (gear in the top bar, or Settings on the first-run screen).
- Discord art uses the `logo` Rich Presence asset. Upload the Shockwave logo in the Discord Developer Portal under Rich Presence art assets, named `logo`.

### Installer

- `Shockwave-Setup-1.5.0.exe`
- `Shockwave-Setup-1.5.0.exe.blockmap`
- `latest.yml`

## 1.4.0

Open an artist from a song.

### Added

- Artist names are clickable. That opens an artist page with every song by that artist.
- The now-playing bar, album page, song tiles, and track lists all link to the artist.
- Play all from the artist page.

### Installer

- `Shockwave-Setup-1.4.0.exe`
- `Shockwave-Setup-1.4.0.exe.blockmap`
- `latest.yml`

## 1.3.0

Open an album from a song.

### Added

- Album names are clickable when they are set. That opens an album page with every song that shares the same album name and artist.
- The now-playing bar also links to the current album.
- Play all from the album page.

### Installer

- `Shockwave-Setup-1.3.0.exe`
- `Shockwave-Setup-1.3.0.exe.blockmap`
- `latest.yml`

## 1.2.0

Edit songs, tile menus, and calmer updates.

### Added

- Edit song details (title, artist, album, year, genre) from the pencil button or the right-click menu.
- Right-click song tiles and track rows for Edit details, Add to playlist, and Delete song.

### Changed

- The grey Update button only checks for updates. It does not start a download.
- Shockwave checks for updates on startup. If one is waiting, the button turns green. Click it to download.
- Download and install still only run after you choose to update.

### Installer

- `Shockwave-Setup-1.2.0.exe`
- `Shockwave-Setup-1.2.0.exe.blockmap`
- `latest.yml`

## 1.1.1

Seeking and song metadata.

### Fixed

- Seeking a track no longer restarts it from the beginning.
- Imported songs look up album name and official artwork from iTunes, Deezer, and MusicBrainz.

### Notes

- Songs imported before 1.1.1 keep their old tags. Import them again to pick up album and artwork.

### Installer

- `Shockwave-Setup-1.1.1.exe`
- `Shockwave-Setup-1.1.1.exe.blockmap`
- `latest.yml`

## 1.1.0

Delete songs from the app.

### Added

- Delete a song from the track list. After confirm, the file is moved to the Recycle Bin.

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

### Installer

- `Shockwave-Setup-1.0.0.exe`
- `Shockwave-Setup-1.0.0.exe.blockmap`
- `latest.yml`
