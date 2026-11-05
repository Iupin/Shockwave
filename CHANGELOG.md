# Changelog

## 1.6.13

Aftershock can be installed again from Settings.

### Added

- Settings has Reinstall Aftershock, which opens the wireless debugging wizard.
- That option stays greyed out until Aftershock has been installed once.

### Installer

- `Shockwave-Setup-1.6.13.exe`
- `Shockwave-Setup-1.6.13.exe.blockmap`
- `latest.yml`

## 1.6.12

The Aftershock icon glows until it is opened once.

### Changed

- The phone icon glows green until the first click, then returns to its normal colour.

### Installer

- `Shockwave-Setup-1.6.12.exe`
- `Shockwave-Setup-1.6.12.exe.blockmap`
- `latest.yml`

## 1.6.11

The phone icon stays in the player. Aftershock setup opens from it.

### Changed

- Install and It's already installed are in a popup opened from the phone icon.
- The wireless debugging wizard opens in that same popup.

### Installer

- `Shockwave-Setup-1.6.11.exe`
- `Shockwave-Setup-1.6.11.exe.blockmap`
- `latest.yml`

## 1.6.10

Shockwave can install Aftershock over wireless debugging.

### Added

- Until Aftershock has been installed, the player shows Install and It's already installed.
- Install walks through developer options and wireless debugging, pairs with the phone’s code, connects over Wi-Fi, and installs the bundled app.
- Shockwave records the install only after it confirms Aftershock is on the phone. It's already installed records it without checking.

### Installer

- `Shockwave-Setup-1.6.10.exe`
- `Shockwave-Setup-1.6.10.exe.blockmap`
- `latest.yml`

## 1.6.9

The Aftershock sync control looks like a phone sending a signal.

### Changed

- The sync icon is a phone with signal waves.

### Installer

- `Shockwave-Setup-1.6.9.exe`
- `Shockwave-Setup-1.6.9.exe.blockmap`
- `latest.yml`

## 1.6.8

Aftershock sync is an icon beside the volume control.

### Changed

- The Sync button is an icon in the player, next to the volume bar.

### Installer

- `Shockwave-Setup-1.6.8.exe`
- `Shockwave-Setup-1.6.8.exe.blockmap`
- `latest.yml`

## 1.6.7

Scrollbars are a thin grey rod.

### Changed

- Scrollbars are a slim rounded grey bar instead of the Windows default.

### Installer

- `Shockwave-Setup-1.6.7.exe`
- `Shockwave-Setup-1.6.7.exe.blockmap`
- `latest.yml`

## 1.6.6

Aftershock’s navigation icons stay light grey until the current tab is selected.

### Changed

- Home, Search, and Library are light grey, and white on the selected tab.
- This release carries Aftershock 1.1.2.

### Installer

- `Shockwave-Setup-1.6.6.exe`
- `Shockwave-Setup-1.6.6.exe.blockmap`
- `latest.yml`

## 1.6.5

Accepting an Aftershock update installs the app.

### Fixed

- Aftershock cleared the update as soon as you accepted it, so Shockwave synced the library and skipped the install.
- Updating Shockwave stopped with "Failed to uninstall old application files" when a file in the install folder was still open. The installer now replaces those files in place.
- The Aftershock 1.1.1 in this release includes that fix. The top bar still shows the version.

### Installer

- `Shockwave-Setup-1.6.5.exe`
- `Shockwave-Setup-1.6.5.exe.blockmap`
- `latest.yml`

## 1.6.4

Ship Aftershock 1.1.1, which shows its version in the top bar.

### Added

- Aftershock shows its version as a small tag in the top bar.
- This Shockwave release carries Aftershock 1.1.1. Sync offers it to a phone on an older build.

### Installer

- `Shockwave-Setup-1.6.4.exe`
- `Shockwave-Setup-1.6.4.exe.blockmap`
- `latest.yml`

## 1.6.3

Shockwave can update Aftershock during a sync.

### Added

- Aftershock tells Shockwave which build it is running.
- When Shockwave is carrying a newer Aftershock app, the phone asks before Android installs it. Sync the library again after Aftershock reopens.
- A phone that does not report a build still syncs its library and is not offered an app update.

### Installer

- `Shockwave-Setup-1.6.3.exe`
- `Shockwave-Setup-1.6.3.exe.blockmap`
- `latest.yml`

## 1.6.2

Discord shows Shockwave as Listening.

### Changed

- Rich Presence uses Listening instead of Playing. A song still shows its title, artist, and duration bar.

### Installer

- `Shockwave-Setup-1.6.2.exe`
- `Shockwave-Setup-1.6.2.exe.blockmap`
- `latest.yml`

## 1.6.1

Sync only the songs and artwork Aftershock does not already have.

### Added

- A later sync copies new and changed audio and artwork. A file already on the phone, with the same path and size, is not sent again.
- Playlists, liked songs, and song details still update. Songs removed in Shockwave are removed on the phone.

### Installer

- `Shockwave-Setup-1.6.1.exe`
- `Shockwave-Setup-1.6.1.exe.blockmap`
- `latest.yml`

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
