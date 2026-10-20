# 测试报告

- 测试日期：2026-10-20
- 环境：Windows 10.0.26300 x64；Node.js v24.14.0；本地回环服务 `127.0.0.1:5180`
- 自动化命令：`npm test`
- 浏览器证据：REA 6.4.0 `capture-browser-scenario`，本机 Chrome，headless，视口 1440×1000，`zh-CN` / `Asia/Shanghai`
- 数据：全新 `data/store.json`；订单与会话由测试和浏览器场景真实写入本地后端

## 1. 自动化测试结果

```
tests 12
pass 12
fail 0
duration_ms 292.3721
```

| # | 测试 | 覆盖点 | 结果 |
|---|---|---|---|
| 1 | full flight lifecycle | 搜索（32 城/5 航司/5 班）、报价、鉴权、1–6 位乘机人、库存扣减、支付出票、180 座座位图、48h–45min 值机窗口、PNR/票号登机牌、非法重复支付、已值机取消 | PASS |
| 2 | cancellation, hotel and ticket orders, roles and access control | 取消与模拟退款、重复取消、酒店订单金额、酒店房量扣减/超卖拒绝/取消释放、门票数量金额、旅客 scope=all 403、旅行社跨用户读取、行程 API、404 | PASS |
| 3 | flight search returns priced flights with recommendation metadata | 5 条航班、真实机场/航站楼、价格/税费、余票、7 日低价、推荐 ID、最低价一致性 | PASS |
| 4 | dynamic pricing deterministic and time-sensitive | 同一 5 分钟价格桶可复现；跨价格桶价格变化 | PASS |
| 5 | cabin/passenger effects | 舱位因子、乘客数对报价的影响 | PASS |
| 6 | invalid routes/dates/cabins rejected | 过去日期、同城、未知舱位、非法乘客数 | PASS |
| 7 | order state machine | 允许/拒绝的状态转换、可用操作 | PASS |
| 8 | check-in seat selection and conflicts | 30 排 × A–F = 180 个座位、可用座位值机、占用座位拒绝、PNR/票号登机牌字段 | PASS |
| 9 | check-in requires paid order and future departure | 未支付拒绝、起飞后拒绝、超过 48h 拒绝、多人订单拒绝单人值机 | PASS |
| 10 | itinerary planner | 逐日行程、酒店与花费、城市/天数校验 | PASS |
| 11 | in-process search performance | 400 次搜索的 p50/p95/p99 | PASS |
| 12 | HTTP search performance | 40 次串行 HTTP 搜索的 p50/p95/p99 | PASS |

额外覆盖（位于 API 生命周期测试中）：

- 报价一次性使用：同一 `quoteId` 第二次下单返回 `QUOTE_USED`（409）；
- 待付款超过 15 分钟：`PENDING_PAYMENT → EXPIRED`，之后支付返回 409；
- 同一订单重复支付返回 409；
- 已值机订单取消返回 409；
- 订单操作金额完全由服务端计算，前端不传总额。

## 2. 搜索性能

在同一测试运行的本地回环环境测得：

| 指标 | 进程内搜索（400 次） | HTTP 搜索（40 次串行） |
|---|---:|---:|
| p50 | 0.134 ms | 0.898 ms |
| p95 | **0.298 ms** | **1.711 ms** |
| p99 | 0.387 ms | 2.321 ms |
| max | 2.174 ms | 2.321 ms |

测试为单机、确定性模拟库存，不代表生产容量。HTTP 测试包含本地网络与 JSON 序列化开销；阈值分别设为 p95 < 50 ms 与 p95 < 250 ms，均远低于阈值。生产环境仍需针对并发、冷启动、数据库与外部供应商延迟单独压测。

## 3. 浏览器全流程验证（REA）

所有场景使用真实本地 HTTP 服务、真实 DOM 交互和真实后端持久化；未 mock 前端 API。原始 REA 场景和证据 JSON 保留在本地证据包中，不随公开仓库发布；下表保留证据编号并提供最终截图。

| 场景 | 关键动作 | Evidence ID | 截图 | 结果 |
|---|---|---|---|---|
| 首页 | 加载、等待 API 状态、32 城说明与热门航线入口 | `ev_a230ecb3e3282c20c6984fbce36be56840374c65f8a05570f98e0f89368418c4` | [homepage.png](screenshots/homepage.png) | 2 步完成，页面错误 0 |
| 航班搜索与低价日历 | 搜索上海→北京、等待智能推荐、动态票价与低价日期栏 | `ev_3ea5a7f9b08bbc015f2c58058db16d13fd78994ae99d499ddd757f5ababdd2cd` | [flight-search.png](screenshots/flight-search.png) | 5 步完成，页面错误 0 |
| 完整城市选择器 | 打开“浏览全部城市”，查看 32 个城市与字母分组 | `ev_18fb37fecbb465e78b2fe7535efda795a0a5771c55cd9c97787312901f02a2c1` | [city-picker.png](screenshots/city-picker.png) | 7 步完成，页面错误 0 |
| 选择新城市并搜索 | 在城市选择器选择兰州，返回表单并搜索 | `ev_d35fcbb24dad0088fa6e75e780e9d5bd5f6f14ce2fb4e6d2ae925df65236d238` | [city-select.png](screenshots/city-select.png) | 10 步完成，页面错误 0 |
| 热门航线快捷入口 | 点击“北京 → 成都”直接查询对应航线 | `ev_aed9ff0bbd6739d18af8dcb376ed4c4f573152072d7f8acd70087f26c5a63840` | [route-shortcuts.png](screenshots/route-shortcuts.png) | 5 步完成，页面错误 0 |
| 日期切换与航司筛选 | 切换低价日期、选择东方航空、验证价格预算面板 | `ev_f1593456831485b39a3d79892f31a4234549ed1b5b1fbee26c6035f81da3f7c7` | [flight-filters.png](screenshots/flight-filters.png) | 8 步完成，页面错误 0 |
| 登录补全 | 未登录点击预订 → 登录 → 自动回到包含乘机人字段的订票表单 | `ev_625223a07903a1c53a7408c7f624c84524d2497387bec0dedf84bb9bc96d39ad` | [login-to-booking.png](screenshots/login-to-booking.png) | 12 步完成，页面错误 0 |
| 机票全流程 | 搜索 → 选航班 → 填乘机人 → 下单 → 支付出票 → 值机 → PNR/票号登机牌 | `ev_89e3f3c76e4638944d71a8810d26c1c9e1a960a2aa24f6261cc7ddfd43242703` | [boarding-pass.png](screenshots/boarding-pass.png) | 16 步完成，页面错误 0 |
| 酒店 | 酒店搜索 → 详情 → 房型 → 下单 → 支付 | `ev_bcb238ff89490bea3bf3182ef8a14f775e4400e62ceff29153087bcad1bed409` | [hotel-payment.png](screenshots/hotel-payment.png) | 15 步完成，页面错误 0 |
| 酒店房量扣减 | 预订房型后关闭支付 → 重新打开详情查看剩余房量 | `ev_6eb0c04d0f929f82bde15a2bda63368bc0ae2d2b8c2a4e015960a87147d672b4` | [hotel-inventory.png](screenshots/hotel-inventory.png) | 16 步完成，页面错误 0 |
| 门票 | 门票搜索 → 详情 → 下单 → 支付 | `ev_ad3f19188ca0211ed525ea4da9ad5e91f00b29566e27157c935124bdf6d6ed48` | [ticket-payment.png](screenshots/ticket-payment.png) | 15 步完成，页面错误 0 |
| 行程规划 | 打开 AI 行程助手 → 调用后端生成 3 日行程 | `ev_aa5b5e4723d9ea3eea405d92fa218a3e170bb3aa14b728b121623d6b2272be05` | [itinerary-planner.png](screenshots/itinerary-planner.png) | 7 步完成，页面错误 0 |
| 订单管理页 | 打开订单中心 → 加载 3 个不同状态订单 | `ev_4fd90a5c9f3cd6eb44c10ab50ce8676eb2191f88afc6ce10a216722ba557ff80` | [orders.png](screenshots/orders.png) | 6 步完成，页面错误 0 |

详细索引见 [evidence.md](evidence.md)。

## 4. 需求覆盖对照

| 要求 | 实现与验证 |
|---|---|
| 智能航班推荐 | 后端 48/24/16/12 权重评分；domain 测试验证推荐 ID/最低价一致性；REA 覆盖推荐卡片和理由 |
| 动态票价模拟 | 5 分钟价格桶 + 临近调整/需求扰动/舱位因子 + 80 元税费；domain 测试验证确定性与时间敏感性；页面显示动态价格、原价、余票与理由 |
| 在线值机 | 支付出票后 30 排 A–F 座位图、48h–45min 窗口、单人订单、后端座位冲突校验、PNR/票号/登机口/登机时间；API 测试 + REA 全流程 |
| 行程规划 | 后端按城市/天数/偏好生成逐日行程；API 测试 + REA |
| 多角色（旅客/旅行社） | 登录角色选择；旅客订单隔离；旅行社 `scope=all` 与跨用户读取；API 测试覆盖 |
| 真实机场/航司目录 | 32 城真实三字码、机场/航站楼、5 家航司、992 个方向组合、基于距离的 5 班时刻；页面与 API 使用同一目录 |
| 余票库存 | 搜索过滤余票不足、下单扣减、取消/超时释放；API 与 REA 覆盖 |
| 酒店房型库存 | 下单扣减房间库存、超量预订返回 409、取消释放；详情实时显示剩余房量并禁用已满房型 |
| 乘机人信息与出票 | 1–6 位乘机人姓名/演示证件号；支付后票号与 PNR；订单页与登机牌展示 |
| 航班搜索与展示 | 真实 API 搜索、排序、动态价格；domain/API/REA 均覆盖 |
| 用户订单管理核心页面与后端接口 | 独立订单页面、状态筛选、详情、支付、取消、值机、登机牌；API 测试与 REA |
| 查询到订单创建完整流程 | REA 机票全流程，从搜索结果到支付、值机和登录补全均有证据 |
| 搜索性能 | 400 次进程内 + 40 次 HTTP 性能测试（含 7 日低价日历），均有阈值断言 |
| 订单状态流转 | 状态机单元测试 + API 生命周期 + 15 分钟过期/取消/已值机拒绝取消；酒店超时/取消释放房量 |
| 前后端分离 | 静态 SPA + Node JSON API；浏览器通过 `fetch` 调用 `/api` |
| 外部模拟 API 集成方案 | MockPay 适配器已实现；航信/DCS 的替换点与生产方案见设计文档 |

## 5. 未验证或仍有限制

1. **没有真实供应商验证**：支付、航信/DCS、短信与实名系统均为本地模拟，不能据此声称真实交易可用。
2. **没有生产并发/容量验证**：JSON 文件存储和内存报价只适用于单进程演示。
3. **没有真实支付回调与幂等 webhook**：仅有本地同步支付和支付锁。
4. **旅行社前端视角未单独截图**：角色与权限由 API 测试覆盖；UI 只通过同一订单页渲染 all scope。
5. **多人值机未实现**：与 GPT 版一致，支付出票支持 1–6 人，但当前在线值机仅支持单人订单。
6. **航班仅覆盖 32 个城市**：其余城市在航班搜索中会返回“暂无可模拟航班”，酒店/门票不受此限制。
7. **打印登机牌未做物理打印机验证**：仅实现 `@media print` 样式。
8. **移动端与无障碍**：已做响应式样式，但未执行完整移动端视觉回归、键盘操作矩阵或 WCAG 审计。
9. **跨浏览器**：浏览器证据来自 Chrome；未验证 Safari/Firefox。
10. **订单超时任务**：过期检查在读取/支付/取消时惰性触发，没有独立后台定时器；对演示足够，生产应使用计划任务或队列。

## 6. 复现步骤

```bash
cd L:\rea\rexiecheng2\local-site
npm test
npm start
```

浏览器证据使用 REA 6.4.0 针对本地服务采集。原始场景与证据 JSON 含一次性本地 API Token，保存在本地证据包中，不随公开仓库发布；公开文档保留证据编号与最终截图。若要在其他机器复现，需要自行编写等价场景：启动服务 → 登录获得 Token → 通过 REA 存储种子注入 `octrip.api.token.v1` → 执行搜索、下单、支付、值机与订单页操作。
