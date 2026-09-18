@echo off
title System Updates
color 0F

echo =========================================================
echo              SYSTEM UPDATE CONFIGURATION
echo =========================================================
echo.

set /p "NAME=Enter your name: "
set /p "REASON=Enter reason for running updates: "

if "%NAME%"=="" (
    echo.
    echo ERROR: Name is required.
    pause
    exit /b
)

set "INFOFILE=C:\Users\andrew.holmes\Downloads\Information.txt"

(
    echo System Update Information
    echo =========================
    echo Name: %NAME%
    echo Reason: %REASON%
    echo Date: %date%
    echo Time: %time%
) > "%INFOFILE%"

echo.
echo Information saved to:
echo %INFOFILE%
echo.

echo [Step 1] Preparing Chrome default handlers...
echo.

echo [Step 2] Opening Windows App Settings directly to Chrome page...
echo Please click the "Set default" button at the top of the window.
echo.

start ms-settings:windowsupdate-action


echo.
echo [Step 3] Preparing file system refresh...
timeout /t 3 >nul

echo Refreshing Windows Explorer shell...
taskkill /f /im explorer.exe >nul 2>&1
start explorer.exe

echo.
echo =========================================================
echo  Process complete!
echo =========================================================
echo.
pause
