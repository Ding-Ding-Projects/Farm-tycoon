@echo off
REM download-dependencies.bat - fetch everything Farm Tycoon needs to build, from nothing.
REM   download-dependencies.bat        interactive
REM   download-dependencies.bat /s     silent, no prompts, non-zero exit on the first failure
setlocal
set "SILENT=0"
if /I "%~1"=="/s" set "SILENT=1"
if /I "%~1"=="--silent" set "SILENT=1"
if "%SILENT_ENV%"=="1" set "SILENT=1"
set "SILENTARG="
if "%SILENT%"=="1" set "SILENTARG=-Silent"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\bootstrap.ps1" %SILENTARG%
exit /b %ERRORLEVEL%
