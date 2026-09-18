@echo off
title Portable Chrome Defaults Setup
echo =========================================================
echo  Configuring Google Chrome User Session Defaults...
echo =========================================================
echo.

:: 1. Trigger Chrome's built-in background routine to register its protocols for the user
echo [Step 1] Triggering Chrome Default Handlers...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --make-default-browser --no-default-browser-check

:: 2. Launch the hidden Windows 11 Settings URI directly to Google Chrome's association map
echo [Step 2] Opening Windows App Settings directly to Chrome page...
echo please click the "Set default" button at the top of the window that opens!
echo.
start ms-settings:defaultapps?registeredApp=Google%%20Chrome

:: 3. Give the user a brief moment, then clean and refresh File Explorer
echo [Step 3] Preparing file system refresh...
timeout /t 3 >nul

echo Refreshing Windows Explorer shell...
taskkill /f /im explorer.exe >nul 2>&1
start explorer.exe

echo.
echo =========================================================
echo  Process complete! Ensure you clicked 'Set Default' 
echo  in the Settings window to lock in your extensions.
echo =========================================================
pause
