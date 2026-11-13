# Compiles CelestaLauncher.cs -> Celesta.exe with the .NET Framework compiler
# that ships with Windows (no SDK/runtime install needed on the target machine).
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe /out:"$PSScriptRoot\Celesta.exe" `
  /reference:System.dll,System.Windows.Forms.dll,System.Net.dll,System.Core.dll `
  "$PSScriptRoot\CelestaLauncher.cs"
