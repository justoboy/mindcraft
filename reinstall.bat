@echo off
REM ============================================================
REM  reinstall.bat
REM  Run this after switching git branches (e.g. develop <-> develop-ce).
REM  The branches pin different dependency versions (notably
REM  mineflayer-auto-eat), so node_modules must be rebuilt to match
REM  the current branch's package.json. This script wipes node_modules
REM  and reinstalls, which also re-applies the correct patch-package
REM  patches for the checked-out branch.
REM ============================================================
setlocal

echo.
echo Current branch:
git rev-parse --abbrev-ref HEAD
echo.

echo Removing node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    if errorlevel 1 (
        echo ERROR: Failed to delete node_modules.
        exit /b 1
    )
) else (
    echo node_modules not present, skipping delete.
)

echo.
echo Installing dependencies for current branch...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    exit /b 1
)

echo.
echo Done. Installed versions:
node -e "console.log('  mineflayer        =', require('./node_modules/mineflayer/package.json').version); console.log('  mineflayer-auto-eat =', require('./node_modules/mineflayer-auto-eat/package.json').version);"

echo.
echo Reinstall complete. You can now run: node main.js
endlocal
