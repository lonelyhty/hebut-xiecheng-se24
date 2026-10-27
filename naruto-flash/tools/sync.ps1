<#
  sync.ps1 — 反向同步：GitHub 上有更新，本地自动拉下来

  用法：
    powershell -ExecutionPolicy Bypass -File tools\sync.ps1 -Once        # 拉一次
    powershell -ExecutionPolicy Bypass -File tools\sync.ps1               # 每 30 秒轮询
    ... -Branch main -RepoUrl https://github.com/you/repo.git             # 指定分支/仓库

  为什么要镜像：
    这台机 github.com 的 DNS 被本地解析策略指到 127.0.0.1（rpz.local），直连时通时不通。
    gh-proxy.com / ghproxy.net 读仓正常，所以按 直连 -> gh-proxy -> ghproxy 依次尝试。

  读同步不需要 token（公开仓库即可）。纯本地，不推送、不改远端。
#>
param(
    [string]$Branch = 'naruto-flash',
    [string]$RepoUrl,
    [int]$IntervalSec = 30,
    [string[]]$Mirrors = @('', 'https://gh-proxy.com/', 'https://ghproxy.net/'),
    [switch]$Once,
    [switch]$Quiet
)

$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Log($msg, $color = 'Gray') {
    if (-not $Quiet) { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor $color }
}

if (-not $RepoUrl) {
    $RepoUrl = (& git remote get-url origin) 2>$null
    if (-not $RepoUrl) { Log '没有 origin remote，也不没给 -RepoUrl' 'Red'; exit 1 }
}
# 统一成 https://github.com/<user>/<repo>.git（本地路径原样保留，方便离线自测）
$RepoUrl = $RepoUrl -replace '^git@github\.com:', 'https://github.com/'
if ($RepoUrl -match '^https?://' -and $RepoUrl -notmatch '\.git$') { $RepoUrl = "$RepoUrl.git" }

function Fetch-ViaMirror {
    $list = if ($RepoUrl -match '^https?://') { $Mirrors } else { @('') }
    foreach ($m in $list) {
        $endpoint = "$m$RepoUrl"
        $label = if ($m) { $m.TrimEnd('/') } else { 'direct' }
        & git fetch --quiet $endpoint $Branch 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { return @{ ok = $true; via = $label } }
        Log "  $label 拉取失败，换下一个" 'DarkYellow'
    }
    return @{ ok = $false; via = $null }
}

function Sync-Once {
    $before = (& git rev-parse --short=8 HEAD) 2>$null
    if (-not $before) { $before = '(空)' }

    $r = Fetch-ViaMirror
    if (-not $r.ok) { Log "全部通道失败（分支 $Branch）" 'Red'; return $false }

    $remote = (& git rev-parse --short=8 FETCH_HEAD) 2>$null
    if (-not $remote) { Log '取不到 FETCH_HEAD' 'Red'; return $false }

    if ($before -eq $remote) { Log "已最新 $before（via $($r.via)）" 'DarkGray'; return $false }

    $behind = (& git rev-list --count 'HEAD..FETCH_HEAD') 2>$null
    $ahead  = (& git rev-list --count 'FETCH_HEAD..HEAD') 2>$null
    Log "远端更新：$before -> $remote（落后 $behind / 领先 $ahead，via $($r.via)）" 'Cyan'

    if ($behind -eq '0') { Log '本地比远端新，不动（可能是本地还没推的提交）' 'Yellow'; return $false }

    & git merge --ff-only --quiet FETCH_HEAD 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Log '快进失败：本地有未提交改动或历史分叉，手工处理一下' 'Red'
        return $false
    }
    Log "已快进到 $remote —— 浏览器刷新即最新（改了 serve.js 才需重启 node）" 'Green'
    return $true
}

Log "目录 : $repoRoot"
Log "远端 : $RepoUrl (分支 $Branch)"
Log "模式 : $(if ($Once) { '单次' } else { "轮询 ${IntervalSec}s" })"
Log ("通道 : " + (($Mirrors | ForEach-Object { if ($_) { $_.TrimEnd('/') } else { 'direct' } }) -join ' -> '))

if ($Once) { if (Sync-Once) { exit 0 } else { exit 0 } }

while ($true) {
    Sync-Once | Out-Null
    Start-Sleep -Seconds $IntervalSec
}
