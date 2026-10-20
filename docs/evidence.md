# REA 浏览器证据索引

本文件索引本地航空平台的运行时验证结果。最终场景均在 `http://127.0.0.1:5180/` 上对真实 SPA 与真实 Node API 执行，使用 REA 6.4.0、本机 Chrome、headless、1440×1000 视口、`zh-CN` / `Asia/Shanghai`。所有最终场景页面错误为 0，证据工件完整性为 `complete`。

公开仓库只包含最终截图与证据编号；原始 REA 场景和证据 JSON 保留在本地证据包中，不随源码发布。

## 1. 最终浏览器验证

| # | 场景 | Evidence ID | 截图 | 验证要点 |
|---|---|---|---|---|
| 1 | 桌面首页 | `ev_dd8debbe8b9af38559322935b534e5c401ab781685f8796de31f175c098180f7` | [homepage.png](screenshots/homepage.png) | API 已连接；机票默认入口；酒店推荐与目的地卡片 |
| 2 | 航班搜索与智能推荐 | `ev_2dc9bfc3c74fec5ada781f0250df242c8fc29ad814b5985a03ddbccde1df3ab6` | [flight-search.png](screenshots/flight-search.png) | 动态票价、智能推荐卡片、6 个航班、推荐标签 |
| 3 | 登录补全与跨模态恢复 | `ev_5ae1c87b6b120dbe0a1da8fb4d6c2c25da094c657ee6733680c13be37ae2f73b` | [login-to-booking.png](screenshots/login-to-booking.png) | 未登录点击预订 → 登录 → 自动回到订票表单 |
| 4 | 机票完整生命周期 | `ev_9f912551cdf58abc0d893c7f1012cefffbd5079fe31efc0858e81f1f99f3f6c3` | [boarding-pass.png](screenshots/boarding-pass.png) | 搜索 → 下单 → 支付 → 值机选座 → 登机牌 |
| 5 | 酒店预订 | `ev_3e43624672dee001e003ba20b900a5865fc4c27a23fd32039dc8a7ce5c2b6886` | [hotel-payment.png](screenshots/hotel-payment.png) | 酒店搜索 → 详情 → 房型 → 下单 → 支付 |
| 6 | 门票预订 | `ev_33030fa908628a2ac29049b01499153f951b51ee0e6a3be2337ed0541d9119f0` | [ticket-payment.png](screenshots/ticket-payment.png) | 门票搜索 → 详情 → 下单 → 支付 |
| 7 | 行程规划 | `ev_bff7c7f3f5a72a502509277eb245f768521100c093073c39ba938f492bcefffa` | [itinerary-planner.png](screenshots/itinerary-planner.png) | AI 行程助手调用后端生成 3 日行程 |
| 8 | 订单管理页 | `ev_cf3186fb8788b57945f5c32c7bf768c6be255ef0044f1ac74c2dc0cb33e9a83d` | [orders.png](screenshots/orders.png) | 3 个不同状态订单：门票已支付、酒店已支付、机票已值机 |

场景规模：机票完整流程 15 步、酒店 15 步、门票 15 步、登录补全 12 步，其余 2–7 步；全部执行完成，无失败步骤。

每个原始证据 JSON 包含：

- 场景输入与浏览器环境；
- 每步动作、耗时、URL 与状态；
- 最终 DOM、可访问性树、截图与 URL；
- console 与 page-error 事件；
- 工件完整性声明。

原始证据保存在本机 `captures/` 目录；场景定义保存在本机 `scenarios/` 目录，包含一次性本地 API Token，因此未发布到公开仓库。

## 2. 本地复现方式

启动服务：

```bash
cd L:\rea\rexiecheng2\local-site
npm start
```

本地证据包中的场景可以继续用 REA 复跑：

```bash
rea capture-browser-scenario scenarios/scenario-flight-checkin.json --format json > captures/final-flight-checkin.json
```

说明：

- 场景要求本机存在 `C:/Program Files/Google/Chrome/Application/chrome.exe`；其他机器需调整 `browser.executable_path`。
- 带登录态的场景通过 `storage.local_storage` 注入本地 API Token。Token 过期后，先调用 `POST /api/auth/login` 获取新 Token，再替换场景中的 `octrip.api.token.v1`。
- 场景只访问 `127.0.0.1:5180`，不连接外部网站。

## 3. 参考站点的历史证据包

此前对公开首页的只读分析产物、REA Evidence ID 和报告保留在项目根目录（`L:\rea\rexiecheng2`），作为设计参考与本地证据背景，不属于本平台的运行证据，也不随本仓库发布。它们不代表与参考站点存在任何关联。

本平台只继承该分析中的版式与交互目标；品牌、图片、文案、数据与后端均为原创或本地生成，且没有接入参考站点的服务端接口。
