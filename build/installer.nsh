; The stock uninstaller renames every file aside before an update. That
; rename needs delete access, so it aborts when another process still has
; app.asar open (for example an editor). Leave the files in place on an
; update and let the new installer overwrite them. A normal uninstall still
; removes the folder.

!macro customRemoveFiles
  ${if} ${isUpdated}
    DetailPrint "Leaving existing files in place so they can be replaced."
  ${else}
    SetOutPath $TEMP
    RMDir /r $INSTDIR
  ${endif}
!macroend

; An older uninstaller still aborts when a rename fails. Continue installing
; anyway; the copy step overwrites the files that could not be moved.
!macro customUnInstallCheck
  ClearErrors
  StrCpy $R0 0
!macroend
