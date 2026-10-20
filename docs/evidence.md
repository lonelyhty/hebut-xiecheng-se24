# REA 浏览器证据索引

本文件索引本地航空平台的运行时验证结果。最终场景均在 `http://127.0.0.1:5180/` 上对真实 SPA 与真实 Node API 执行，使用 REA 6.4.0、本机 Chrome、headless、1440×1000 视口、`zh-CN` / `Asia/Shanghai`。所有最终场景页面错误为 0，证据工件完整性为 `complete`。

公开仓库只包含最终截图与证据编号；原始 REA 场景和证据 JSON 保留在本地证据包中，不随源码发布。

## 1. 最终浏览器验证

| # | 场景 | Evidence ID | 截图 | 验证要点 |
|---|---|---|---|---|
| 1 | 桌面首页 | `ev_193071324081e18f12e2068948552aa20bdfb2b0d93c97dc2f04e60959e10afe` | [homepage.png](screenshots/homepage.png) | API 已连接；机票默认入口；8 城航班搜索说明；酒店推荐与目的地卡片 |
| 2 | 航班搜索与低价日历 | `ev_babcc206f80ce0ab1b713fafad1882f790cf9a9af5ab12bcd27ba21fa7ee2ff3` | [flight-search.png](screenshots/flight-search.png) | 5 个航班、东方/国航/南航/吉祥/川航、真实机场与航站楼、5 分钟动态票价、智能推荐、7 日低价栏 |
| 3 | 日期切换与航司筛选 | `ev_9384382ced052c753bf1c36996ab9f5ecd4bba118b4439a80e305081afe21691` | [flight-filters.png](screenshots/flight-filters.png) | 点击低价日期重新查询；选择东方航空后结果缩减；价格预算筛选面板 |
| 4 | 登录补全与跨模态恢复 | `ev_1db9af05a6f1755c8bd21fb22ee802f735ae0bb27df6a351664c92beb33fdece` | [login-to-booking.png](screenshots/login-to-booking.png) | 未登录点击预订 → 登录 → 自动回到含乘机人姓名/证件号的订票表单 |
| 5 | 机票完整生命周期 | `ev_2fe1e908e2a91ddb43751567d5110bc4ea33a4ab1d4464c436aa95f513eab7eb` | [boarding-pass.png](screenshots/boarding-pass.png) | 搜索 → 选航班 → 填乘机人 → 下单扣库存 → 支付出票（票号/PNR）→ 30 排选座 → 登机牌 |
| 6 | 酒店预订 | `ev_aec52eea10932b949588698cdf1250bbcac9d06bc8f7879726fe138016d2781f` | [hotel-payment.png](screenshots/hotel-payment.png) | 酒店搜索 → 详情 → 房型 → 下单 → 支付 |
| 7 | 门票预订 | `ev_426667350c61838c2a92bc8772e2a695c2c99c64582c1c82f6ea725617038ef8` | [ticket-payment.png](screenshots/ticket-payment.png) | 门票搜索 → 详情 → 下单 → 支付 |
| 8 | 行程规划 | `ev_3e2ba1f62b54c26f6241dd3a484da1eeac328cfabeabc3f3e656aa7d5c2b17ae` | [itinerary-planner.png](screenshots/itinerary-planner.png) | AI 行程助手调用后端生成 3 日行程 |
| 9 | 订单管理页 | `ev_02ecccb8134e532e055da7a6f1c4e2972596e1f2441f1e34a2ea389b8f0322f5` | [orders.png](screenshots/orders.png) | 3 个不同状态订单；机票订单显示乘机人、PNR、票号、座位与登机口 |

场景规模：机票完整流程 16 步、酒店 15 步、门票 15 步、登录补全 12 步、筛选 8 步，其余 2–7 步；全部执行完成，无失败步骤。

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
- 航班目录为 8 个城市的本地模拟数据；真实机场/航司名称用于目录辨识，时刻、价格、余票、票号、PNR、登机口与订单均为模拟。

## 3. 参考站点的历史证据包

此前对公开首页的只读分析产物、REA Evidence ID 和报告保留在项目根目录（`L:\rea\rexiecheng2`），作为设计参考与本地证据背景，不属于本平台的运行证据，也不随本仓库发布。它们不代表与参考站点存在任何关联。

本平台只继承该分析中的版式与交互目标；品牌、图片、文案、数据与后端均为原创或本地生成，且没有接入参考站点的服务端接口。
