@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title QY4-TTBYT v5.0.0 - Cai dat va chay

echo ================================================
echo   QY4-TTBYT v5.0.0 - BENH VIEN QUAN Y 4
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Khuyen nghi Node.js 20.x.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [LOI] Khong tim thay npm.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [THONG TIN] Chua co .env. Dang tao cau hinh production an toan toi thieu...
  > ".env" echo PORT=5000
  >> ".env" echo DEMO_MODE=false
  >> ".env" echo ADMIN_INITIAL_PASSWORD=
  >> ".env" echo AUTH_SESSION_HOURS=8
  >> ".env" echo TRUST_PROXY=false
  >> ".env" echo QR_SIGNING_SECRET=
  >> ".env" echo QR_PUBLIC_BASE_URL=
  echo [THONG TIN] Lan chay dau, neu ADMIN_INITIAL_PASSWORD de trong, he thong se sinh mat khau tam va bat buoc doi sau dang nhap.
  echo.
)

findstr /R /C:"^DEMO_MODE=true" ".env" >nul 2>&1
if not errorlevel 1 (
  echo [LOI] .env dang co DEMO_MODE=true. Khong duoc cai/chay ban production voi che do demo.
  echo Hay sua DEMO_MODE=false roi chay lai.
  pause
  exit /b 1
)

echo [1/3] Cai dung dependency theo package-lock...
call npm ci
if errorlevel 1 (
  echo [LOI] npm ci that bai. Kiem tra Internet, Node.js va package-lock.json.
  pause
  exit /b 1
)

echo.
echo [2/3] Kiem tra dependency production...
call npm audit --omit=dev
if errorlevel 1 (
  echo [LOI] npm audit production chua dat. Khong tu dong chay production.
  pause
  exit /b 1
)

echo.
echo [3/3] Kiem tra safety P0-P8 + RC1...
call npm run check:safety
if errorlevel 1 (
  echo [LOI] Safety check that bai. Khong khoi dong phan mem.
  pause
  exit /b 1
)

echo.
echo [DAT] Source va dependency da qua kiem tra.
echo Mo trinh duyet: http://localhost:5000
echo Nhan Ctrl+C trong cua so nay de dung server.
echo.
start "" http://localhost:5000
call npm start

endlocal
pause
