@echo off
chcp 65001 > nul
title QY4 TTBYT
cd /d "%~dp0"
start http://localhost:5000
npm start
pause
