# 逆向记录：火影VS火影 3.2（4399 / 2018-07-27）

目标：证明这个 Flash 游戏可以在没有 Flash Player 的环境里运行。工具链：抓包（curl）+ SWF 结构解析（Python）+ Ruffle + CDP 驱动无头 Edge 观察渲染。

---

## 1. 定位资源

页面 `https://www.4399.com/flash/199408_3.htm` 是 GB18030，`Invoke-WebRequest` 直接拿到乱码，需要按 54936 代码页解码。关键行：

```js
var _strGamePath = "/upload_swf/ftp29/haibo/suwei/13.swf";
```

`webServer` 定义在外链 JS 里，实际前缀是 `https://sxiao.4399.com/4399swf`。

## 2. 破防盗链

```
curl -I https://sxiao.4399.com/4399swf/upload_swf/ftp29/haibo/suwei/13.swf
  -> Content-Length: 23832          # 假壳

curl -I -e https://www.4399.com/flash/199408_3.htm <同一 URL>
  -> Content-Length: 61775668       # 真身
```

假壳（23,832 字节）解压后只有 127 条字符串，里面有 `homeBtn`、`http://www.4399.com/`、`ExternalInterface.call` —— 就是个带「首页」按钮的 4399 包装层。

## 3. 真身结构

SWF 头：`CWS`（zlib）+ version 19 + 解压后 62,176,913 字节。自己写的 tag walker 跑出来只有 **17 个 tag**：

```
87 DefineBinaryData   x3
43 FrameLabel         x2
82 DoABC2             x2
76 SymbolClass        x2
69 FileAttributes     x1
 1 ShowFrame          x2
 9 SetBackgroundColor x1
 0 End
```

结论：**不是游戏本体，是「壳 + 打包」**。所有美术/音频塞在 `DefineBinaryData` 里，运行时解压成 ~62MB 的 ByteArray 再实例化；代码全在 DoABC2。

## 4. 壳里的保护

ABC 常量池里能直接读到 `com.green.utils` / `com.green.method` / `confError`，以及一张 XML 文案表：

```xml
<warn en="Your flash player version is too old.">
<info1 en="Please update your flashplayer to #min or higher.">
<info2 en="Recommended version: #rec or higher.">
<info3 en="Current version: #cur.">
<allowNetworking en="Permission of 'allowNetworking' is required.">
<allowScriptAccess en="Permission of 'allowScriptAccess' is required.">
<localURL en="'file:///' is not allowed to load file.">
```

对应的运行时检查（`loaderInfo.parameters`）：

| 键 | 期望值 | 后果 |
|---|---|---|
| `allowScriptAccess` | `always` | 不满足 → WARNING 面板 |
| `allowNetworking` | `all` | 同上 |
| `allowFullScreen` | `true` | 同上 |
| 启动方式 | 不能是 `file:///` | 直接拒绝 |
| Flash 版本 | ≥ 11.0（推荐 11.6） | 显示版本过旧面板 |

另外还有一条 `Please, do not crack our game, thank you !`，以及一套 `ExternalInterface.call.apply(...)` 的混淆调用链（字符串用 `$` 前缀加密，例如 `$f$l$a$s$h$.$e$x$t$e$r$n$a$l...`）。

## 5. Ruffle 踩坑（按踩到顺序）

**(a) flashvars 写在 URL 查询串里无效**
Ruffle 不会把 `swf?allowScriptAccess=always` 的查询串当 FlashVars。必须走 API：

```js
player.load({ url, parameters: { allowScriptAccess: 'always', ... } })
```

**(b) `playerVersion` 在 0.7.1 里收的是数字，不是字符串**
wasm 侧绑定长这样：

```js
setPlayerVersion(e){ __.ruffleinstancebuilder_setPlayerVersion(this.__wbg_ptr, Ue(e) ? 16777215 : e) }
```

`Ue(e)` 就是 `e == null`。传 `"32.0.0.465"` 字符串进去，JS→wasm 数字转换得到 `NaN → 0`，于是游戏读到的版本是 `WIN 0.0.0.0`，正好触发「版本过旧」。**结论：别设这一项**，Ruffle 的默认值能让 11.0/11.6 的检查通过。

**(c) 壳会克隆并替换 embed 元素**
过了校验之后黑屏。CDP 里抓到：

```
[FM] real size: 62108048                    ← 壳正在解包 62MB
[PAGE] replaceChild RUFFLE-PLAYER RUFFLE-PLAYER
Ruffle instance destroyed.
```

壳通过自己注入的 JS 做 `fl_obj.cloneNode(true)` → 改 `<PARAM>` → `parentElement.replaceChild(new_obj, fl_obj)`，本意是让浏览器带着新参数重新拉起影片。在 Ruffle 里这等于把播放器元素换掉 → 实例销毁 → 黑屏。

当前的应对（`play.html` 里）：`MutationObserver` 监听 `#stage`，元素被换掉后把克隆元素上的属性回灌成 `parameters` 再 `load()` 一次。壳会反复替换，所以有 4 次上限。

## 6. 还没解决的

需要让壳认为「参数已就绪」而不再替换。剩下的方向：

1. 把克隆后的全部属性（含壳自己塞的 `forceSH` / `easys` 之类）原样回灌，形成稳定收敛
2. 在页面里放一个同名的假 `<object id="flashgame" name="flashgame">`，让壳的 DOM 操作作用在假元素上
3. 直接改 ABC：定位 `com.green.utils` 里的替换逻辑并 patch 掉（工作量最大，最彻底）

## 7. 复现命令

```powershell
# 抓页面（GB18030）
$wc = New-Object System.Net.WebClient
$html = [Text.Encoding]::GetEncoding(54936).GetString($wc.DownloadData('https://www.4399.com/flash/199408_3.htm'))

# 带 Referer 拿真身
curl.exe -A "Mozilla/5.0" -e "https://www.4399.com/flash/199408_3.htm" -o 13.swf `
  "https://sxiao.4399.com/4399swf/upload_swf/ftp29/haibo/suwei/13.swf"

# 解压 + 列 tag
python tools/unswf.py 13.swf
python tools/tags.py

# 观察渲染（需要无头 Edge 开 CDP）
node tools/probe.js http://127.0.0.1:8765/play.html 45000 shot.png tools/eval_state.js 9222
```
