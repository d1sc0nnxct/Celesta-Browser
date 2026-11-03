; Celesta installer (NSIS 3). Payload is staged into release\Celesta before compiling.
Unicode true
SetCompressor /SOLID lzma
ManifestDPIAware true

!define APPNAME "Celesta"
!define VERSION "0.1.2"
!define PUBLISHER "Celesta"
!define APPEXE "Celesta.exe"

Name "${APPNAME}"
OutFile "..\Celesta-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\${APPNAME}"
InstallDirRegKey HKLM "Software\${APPNAME}" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Celesta" SecMain
  SetOutPath "$INSTDIR"
  File /r "Celesta\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\Celesta.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"

  CreateShortcut "$DESKTOP\Celesta.lnk" "$INSTDIR\${APPEXE}"
  CreateDirectory "$SMPROGRAMS\Celesta"
  CreateShortcut "$SMPROGRAMS\Celesta\Celesta.lnk" "$INSTDIR\${APPEXE}"
  CreateShortcut "$SMPROGRAMS\Celesta\Uninstall Celesta.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Celesta.lnk"
  RMDir /r "$SMPROGRAMS\Celesta"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
  DeleteRegKey HKLM "Software\${APPNAME}"
SectionEnd
