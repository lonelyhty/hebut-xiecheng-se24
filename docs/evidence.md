# REA 浏览器证据索引

本文件索引本地航空平台的运行时验证结果。最终场景均在 `http://127.0.0.1:5180/` 上对真实 SPA 与真实 Node API 执行，使用 REA 6.4.0、本机 Chrome、headless、1440×1000 视口、`zh-CN` / `Asia/Shanghai`。所有最终场景页面错误为 0，证据工件完整性为 `complete`。

公开仓库只包含最终截图与证据编号；原始 REA 场景和证据 JSON 保留在本地证据包中，不随源码发布。

## 1. 最终浏览器验证

| # | 场景 | Evidence ID | 截图 | 验证要点 |
|---|---|---|---|---|
| 1 | 桌面首页 | `ev_a230ecb3e3282c20c6984fbce36be56840374c65f8a05570f98e0f89368418c4` | [homepage.png](screenshots/homepage.png) | 32 城/992 条航线说明、热门航线快捷入口、机票默认入口、酒店推荐与目的地卡片 |
| 2 | 航班搜索与低价日历 | `ev_3ea5a7f9b08bbc015f2c58058db16d13fd78994ae99d499ddd757f5ababdd2cd` | [flight-search.png](screenshots/flight-search.png) | 5 个航班、东方/国航/南航/吉祥/川航、真实机场与航站楼、5 分钟动态票价、智能推荐、7 日低价栏 |
| 3 | 完整城市选择器 | `ev_18fb37fecbb465e78b2fe7535efda795a0a5771c55cd9c97787312901f02a2c1` | [city-picker.png](screenshots/city-picker.png) | 32 个可飞城市、热门城市、字母分组、搜索框 |
| 4 | 热门航线快捷入口 | `ev_aed9ff0bbd6739d18af8dcb376ed4c4f573152072d7f8acd70087f26c5a63840` | [route-shortcuts.png](screenshots/route-shortcuts.png) | 点击“北京 → 成都”直接进入对应航线结果 |
| 5 | 日期切换与航司筛选 | `ev_f1593456831485b39a3d79892f31a4234549ed1b5b1fbee26c6035f81da3f7c7` | [flight-filters.png](screenshots/flight-filters.png) | 切换低价日期重新查询；选择东方航空；价格预算筛选面板 |
| 6 | 登录补全与跨模态恢复 | `ev_625223a07903a1c53a7408c7f624c84524d2497387bec0dedf84bb9bc96d39ad` | [login-to-booking.png](screenshots/login-to-booking.png) | 未登录点击预订 → 登录 → 自动回到含乘机人姓名/证件号的订票表单 |
| 7 | 机票完整生命周期 | `ev_89e3f3c76e4638944d71a8810d26c1c9e1a960a2aa24f6261cc7ddfd43242703` | [boarding-pass.png](screenshots/boarding-pass.png) | 搜索 → 选航班 → 填乘机人 → 下单扣库存 → 支付出票（票号/PNR）→ 30 排选座 → 登机牌 |
| 8 | 酒店预订 | `ev_bcb238ff89490bea3bf3182ef8a14f775e4400e62ceff29153087bcad1bed409` | [hotel-payment.png](screenshots/hotel-payment.png) | 酒店搜索 → 详情 → 房型 → 下单 → 支付 |
| 9 | 酒店房量扣减 | `ev_6eb0c04d0f929f82bde15a2bda63368bc0ae2d2b8c2a4e015960a87147d672b4` | [hotel-inventory.png](screenshots/hotel-inventory.png) | 下单后关闭支付，重新打开酒店详情，房型剩余量减少；释放逻辑见 API 测试 |
| 10 | 门票预订 | `ev_ad3f19188ca0211ed525ea4da9ad5e91f00b29566e27157c935124bdf6d6ed48` | [ticket-payment.png](screenshots/ticket-payment.png) | 门票搜索 → 详情 → 下单 → 支付 |
| 11 | 行程规划 | `ev_aa5b5e4723d9ea3eea405d92fa218a3e170bb3aa14b728b121623d6b2272be05` | [itinerary-planner.png](screenshots/itinerary-planner.png) | AI 行程助手调用后端生成 3 日行程 |
| 12 | 订单管理页 | `ev_4fd90a5c9f3cd6eb44c10ab50ce8676eb2191f88afc6ce10a216722ba557ff80` | [orders.png](screenshots/orders.png) | 3 个不同状态订单；机票订单显示乘机人、PNR、票号、座位与登机口 |
| 13 | 选择新城市并搜索 | `ev_d35fcbb24dad0088fa6e75e780e9d5bd5f6f14ce2fb4e6d2ae925df65236d238` | [city-select.png](screenshots/city-select.png) | 通过完整城市选择器选择兰州 → 返回表单 → 搜索到兰州→北京航班 |
| 14 | 火车票支付并查看已支付 | `ev_2c011714e388a50edd28bcec2764ba58fff0cb0df9be4d4af91b250e68e5f6bd` | [train-paid.png](screenshots/train-paid.png) | 火车票下单、支付后，在“已支付”标签显示 |
| 15 | 已支付标签（酒店 + 火车票） | `ev_9fa80ba9cdf3a38b04c50db44c5c7afc68456e265e349b08702c3328b013efbf` | [orders-paid.png](screenshots/orders-paid.png) | 已支付酒店与火车票订单同时显示在“已支付”标签 |
| 16 | 已值机标签（机票） | `ev_0ab061107fee6fbb2779caec3534911bf10c4de9a1d4fcf4038e7b14928de93f` | [orders-checked-in.png](screenshots/orders-checked-in.png) | 已值机机票订单显示在“已值机”标签 |
| 17 | 提交订单后的确认支付页 | `ev_313924027212e5a75d73e0fe44620a6e0a684e246447f2fa202443cb62dfe8d7`（确认页）、`ev_3e5f196e6cc34523119f18e65602a48d10e67d13e3ae1c9a1edd0a9273beacc9`（稍后支付→待付款） | [order-confirm.png](screenshots/order-confirm.png)、[orders-pending.png](screenshots/orders-pending.png) | 提交订单后先展示订单号、乘机人、金额与支付截止时间；选择“稍后支付”后自动进入“待付款”标签，未支付订单可见 |
| 18 | 支付页取消订单与二次确认 | `ev_8784c9d81e8bd35e117f6a914a37ff2b872faca356b02839f9949548b22c84ad`（取消确认层）、`ev_f4b7144f1e9dc47cb1aebf95057c265fda9c93e817ba3e213149ba09f5b6885b`（确认取消） | [cancel-confirm.png](screenshots/cancel-confirm.png)、[order-cancelled.png](screenshots/order-cancelled.png) | 确认支付页提供“取消订单”；二次确认后订单取消、占用库存释放，取消结果以 toast 提示 |
| 19 | 好友助力砍价（发起人） | `ev_167aca5010ed5bdd5d7918df6f67d14fbc7402cb417d5c550d956e44f12b111b` | [bargain-success.png](screenshots/bargain-success.png) | 下单 → 确认页砍价入口 → 转盘 → 模拟好友 → 砍成 ¥99，订单应付从原价更新为折后价 |
| 20 | 分享链接帮砍（好友） | `ev_0285dcb3833a30c5669915823168675ab1c8f22cf2bcd2daf37fb8625130f80b` | [bargain-helper.png](screenshots/bargain-helper.png) | 分享链接登录 → 帮 TA 砍一刀 → 每位好友限一次，已助力后按钮禁用 |

场景规模：机票完整流程/火车票流程各 16 步、酒店/门票各 15 步、酒店房量扣减 16 步、确认页 9 步、确认页→稍后支付→待付款 14 步、取消确认层 13 步、支付页取消与二次确认 17 步、好友砍价 15 步、分享帮砍 7 步、登录补全 12 步、筛选 8 步、城市选择器 7 步、选择并搜索 10 步，其余 2–6 步；全部执行完成，无失败步骤。

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
- 航班目录为 32 个主要城市的本地模拟数据；真实机场/航司名称用于目录辨识，时刻、价格、余票、票号、PNR、登机口与订单均为模拟。

## 3. 参考站点的历史证据包

此前对公开首页的只读分析产物、REA Evidence ID 和报告保留在项目根目录（`L:\rea\rexiecheng2`），作为设计参考与本地证据背景，不属于本平台的运行证据，也不随本仓库发布。它们不代表与参考站点存在任何关联。

本平台只继承该分析中的版式与交互目标；品牌、图片、文案、数据与后端均为原创或本地生成，且没有接入参考站点的服务端接口。
