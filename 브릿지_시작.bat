@echo off
chcp 65001 > nul
title JKP WorkHub 브릿지 서버
echo.
echo ╔════════════════════════════════════════╗
echo ║    JKP WorkHub 로컬 브릿지 시작 중     ║
echo ╚════════════════════════════════════════╝
echo.

:: Node.js 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js를 설치해주세요.
    pause
    exit /b 1
)

:: 필요 패키지 설치
if not exist node_modules (
    echo [설치] 필요 패키지 설치 중...
    npm install --production
)

echo [시작] 브릿지 서버를 백그라운드로 실행합니다...
echo [접속] 웹: https://jkpworkhub.vercel.app
echo.

node bridge-server.js
pause
