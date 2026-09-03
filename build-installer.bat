@echo off
REM build-installer.bat - produce the same unsigned Squirrel.Windows installer CI publishes.
REM   build-installer.bat        interactive
REM   build-installer.bat /s     silent, no prompts, non-zero exit on the first failure
setlocal
set "SILENT=0"
if /I "%~1"=="/s" set "SILENT=1"
if /I "%~1"=="--silent" set "SILENT=1"
if "%SILENT_ENV%"=="1" set "SILENT=1"
set "SILENTARG="
if "%SILENT%"=="1" set "SILENTARG=-Silent"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\build.ps1" %SILENTARG% -Installer
exit /b %ERRORLEVEL%
