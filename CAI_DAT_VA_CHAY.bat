@echo off
chcp 65001 >nul
cd /d %~dp0
echo ========================================
echo  QY4-TTBYT V5.0 - Khoa Trang bi BVQY4
echo ========================================
echo.
echo Dang cai dat thu vien neu can...
call npm install
if errorlevel 1 (
  echo.
  echo Loi cai dat thu vien. Hay kiem tra Node.js va Internet.
  pause
  exit /b 1
)
echo.
echo Dang khoi dong phan mem...
echo Mo trinh duyet: http://localhost:5000
echo.
call npm start
pause
