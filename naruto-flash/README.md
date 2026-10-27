# 火影VS火影 3.2 — 脱离 Flash 浏览器插件离线运行

把 4399 的 Flash 小游戏《火影VS火影 3.2》(`/flash/199408.htm`) 扒下来，用 [Ruffle](https://ruffle.rs)（Rust 写的开源 Flash 模拟器）在本地浏览器里跑，不需要装 Flash Player 插件、不联网也能玩。

```
naruto_flash/
├─ setup.ps1                 一键下载：游戏 SWF + Ruffle 运行时
├─ start.bat                 双击启动：起本地 HTTP 服务 + 打开播放页
├─ play.html                 播放页（Ruffle 配置 + 加载进度 + 键盘焦点）
├─ serve.js                  40 行静态服务器（wasm 不能走 file://）
├─ naruto_vs_naruto_3.2.swf  游戏本体 58.9 MiB（由 setup.ps1 下载）
├─ vendor/ruffle/            Ruffle 0.7.1（npm 包，含 wasm）
└─ tools/                    调试工具（CDP 驱动无头 Edge 截图 / 抓控制台）
```

## 快速开始

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # 第一次：拉 SWF + Ruffle
.\start.bat                                            # 之后：双击即可
```

浏览器打开 <http://127.0.0.1:8765/play.html>，点一下画面拿到键盘焦点。

操作：`A`/`D` 左右移动 · `S` 防御 · `J` 攻击/确定 · `K` 跳跃 · `L` 冲刺 · `U` 远攻 · `I` 必杀 · `O` 召唤援助
（2P：方向键移动 · `↓` 防御 · `1`~`6` 对应攻击/跳/冲刺/远攻/必杀/援助）

## 为什么不能直接下载这个 SWF

`_strGamePath` 指向 `sxiao.4399.com/4399swf/upload_swf/ftp29/haibo/suwei/13.swf`，但 CDN 有防盗链：

| 请求 | 响应 |
|---|---|
| 无 `Referer` | `200`，**23,832 字节** ← 假壳，只是个「4399 首页」按钮 |
| 带 `Referer: https://www.4399.com/flash/199408_3.htm` | `200`，**61,775,668 字节** ← 真游戏 |

## 当前状态

- ✅ SWF 已提取、已确认结构（SWF v19 / CWS 压缩 / 解压后 62,176,913 字节）
- ✅ Ruffle 能加载、能解包 62MB 内嵌资源
- ✅ 打掉两道内置校验：`allowScriptAccess` 参数校验、Flash 版本下限校验
- ⏳ 剩下 4399 通用壳的「克隆 embed 再替换」行为，会让 Ruffle 实例被销毁（黑屏）

详见 [NOTES.md](NOTES.md)，里面记了完整的逆向过程和踩坑点。

## 版权

游戏版权归原作者 / 4399 所有，本仓库只用于格式与兼容性研究，不含游戏本体（`setup.ps1` 从原站拉取）。
Ruffle 为 MIT / Apache-2.0，见 `vendor/ruffle/LICENSE_*`。
