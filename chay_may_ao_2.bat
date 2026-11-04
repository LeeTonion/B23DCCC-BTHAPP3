@echo off
title Khoi chay May ao 2 (stable_avd)
echo ========================================================
echo Dang bat May ao 2 tren man hinh cua ban...
echo ========================================================
start "" "D:\AndroidSdk\emulator\emulator.exe" -avd stable_avd

echo Dang cho may ao 2 ket noi...
:wait_loop
timeout /t 3 >nul
"D:\AndroidSdk\platform-tools\adb.exe" devices | findstr "emulator-5556" >nul
if errorlevel 1 (
    echo Dang cho may ao 2 len...
    goto wait_loop
)

echo May ao 2 da ket noi! Dang cho he dieu hanh khoi dong hoan tat...
"D:\AndroidSdk\platform-tools\adb.exe" -s emulator-5556 wait-for-device

:boot_loop
timeout /t 3 >nul
for /f "tokens=*" %%i in ('"D:\AndroidSdk\platform-tools\adb.exe" -s emulator-5556 shell getprop sys.boot_completed 2^>nul') do set BOOT=%%i
if not "%BOOT%"=="1" (
    echo Dang khoi dong Android...
    goto boot_loop
)

echo Dang ket noi Metro bundler (reverse port 8081)...
"D:\AndroidSdk\platform-tools\adb.exe" -s emulator-5556 reverse tcp:8081 tcp:8081

echo Dang cai dat va mo ung dung tren May ao 2...
"D:\AndroidSdk\platform-tools\adb.exe" -s emulator-5556 install -r "c:\Users\LeeTonion\Downloads\chat-main\chat-main\android\app\build\outputs\apk\debug\app-debug.apk"
"D:\AndroidSdk\platform-tools\adb.exe" -s emulator-5556 shell am start -n com.a/.MainActivity

echo.
echo ========================================================
echo THANH CONG! May ao 2 da hien tren man hinh va mo app.
echo ========================================================
pause
