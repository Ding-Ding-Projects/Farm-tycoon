@echo off
REM build.bat - take a bare Windows machine to a running Farm Tycoon, in one click.
REM   build.bat        interactive; offers to launch the game when it finishes
REM   build.bat /s     silent, no prompts, non-zero exit on the first failure
setlocal
set "SILENT=0"
if /I "%~1"=="/s" set "SILENT=1"
if /I "%~1"=="--silent" set "SILENT=1"
if "%SILENT_ENV%"=="1" set "SILENT=1"
set "SILENTARG="
if "%SILENT%"=="1" set "SILENTARG=-Silent"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\build.ps1" %SILENTARG%
exit /b %ERRORLEVEL%
