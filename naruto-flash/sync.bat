@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem 常驻轮询：GitHub 上有更新就自动拉下来（默认分支 naruto-flash，30 秒一次）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\sync.ps1" %*