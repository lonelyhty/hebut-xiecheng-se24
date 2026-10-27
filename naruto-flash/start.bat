@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "naruto_vs_naruto_3.2.swf" (
  echo [!] 缺少游戏文件 naruto_vs_naruto_3.2.swf
  echo     请先运行： powershell -ExecutionPolicy Bypass -File setup.ps1
  pause
  exit /b 1
)
if not exist "vendor\ruffle\ruffle.js" (
  echo [!] 缺少 Ruffle 运行时 vendor\ruffle\
  echo     请先运行： powershell -ExecutionPolicy Bypass -File setup.ps1
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [!] 没找到 Node.js，改用 Python 起本地服务
  where python >nul 2>nul || (echo     也没有 Python，装一个 Node.js 再来 & pause & exit /b 1)
  start "" /min cmd /c "python -m http.server 8765 --bind 127.0.0.1"
  timeout /t 2 >nul
  start "" http://127.0.0.1:8765/play.html
  exit /b 0
)

start "" /min cmd /c "node serve.js"
timeout /t 2 >nul
start "" http://127.0.0.1:8765/play.html

echo 已启动： http://127.0.0.1:8765/play.html
echo 关掉那个最小化的 node 窗口即可停止服务。
timeout /t 3 >nul
