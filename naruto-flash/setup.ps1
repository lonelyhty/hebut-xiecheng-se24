# -*- coding: utf-8 -*-
<#
  一键准备运行环境：
    1) 下载游戏本体 SWF（4399 CDN，必须带 Referer，否则只给 23KB 的假壳）
    2) 下载 Ruffle（Flash 模拟器，npm 包，含 wasm）
  用法：右键「使用 PowerShell 运行」，或在终端里： powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

$swfUrl = 'https://sxiao.4399.com/4399swf/upload_swf/ftp29/haibo/suwei/13.swf'
$swfRef = 'https://www.4399.com/flash/199408_3.htm'
$swfOut = Join-Path $root 'naruto_vs_naruto_3.2.swf'
$swfSize = 61775668

Write-Host '[1/2] 下载 Ruffle ...' -ForegroundColor Cyan
$ruffleDir = Join-Path $root 'vendor\ruffle'
if (Test-Path (Join-Path $ruffleDir 'ruffle.js')) {
    Write-Host '     已存在，跳过' -ForegroundColor DarkGray
} else {
    New-Item -ItemType Directory -Force -Path $ruffleDir | Out-Null
    $tgz = Join-Path $env:TEMP 'ruffle.tgz'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/@ruffle-rs/ruffle/-/ruffle-0.7.1.tgz' -OutFile $tgz
    & tar.exe -xzf $tgz -C $ruffleDir --strip-components=1
    Remove-Item $tgz -Force
    Write-Host '     OK' -ForegroundColor Green
}

Write-Host '[2/2] 下载游戏 SWF（带 Referer 绕防盗链）...' -ForegroundColor Cyan
if ((Test-Path $swfOut) -and ((Get-Item $swfOut).Length -eq $swfSize)) {
    Write-Host '     已存在且大小正确，跳过' -ForegroundColor DarkGray
} else {
    $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    Invoke-WebRequest -UseBasicParsing -Uri $swfUrl -OutFile $swfOut -Headers @{ 'Referer' = $swfRef; 'User-Agent' = $ua }
    $len = (Get-Item $swfOut).Length
    if ($len -ne $swfSize) {
        Write-Warning "大小 $len 与预期 $swfSize 不符，可能被 CDN 拦了（检查 Referer）"
    } else {
        Write-Host '     OK 58.9 MiB' -ForegroundColor Green
    }
}

Write-Host ''
Write-Host '准备完成，双击 start.bat 开始游戏。' -ForegroundColor Green
