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
duration_ms 225.0768
```

| # | 测试 | 覆盖点 | 结果 |
|---|---|---|---|
| 1 | full flight lifecycle | 搜索、报价、鉴权、下单、支付、座位图、值机、登机牌、非法重复支付、已值机取消 | PASS |
| 2 | cancellation, hotel and ticket orders, roles and access control | 取消与模拟退款、重复取消、酒店订单金额、门票数量金额、旅客 scope=all 403、旅行社跨用户读取、行程 API、404 | PASS |
| 3 | flight search returns priced flights with recommendation metadata | 6 条航班、价格/税费、余票、推荐 ID、最低价一致性、日期透传 | PASS |
| 4 | dynamic pricing deterministic and time-sensitive | 同一 30 分钟价格桶可复现；跨价格桶价格变化 | PASS |
| 5 | cabin/passenger effects | 舱位因子、乘客数对报价的影响 | PASS |
| 6 | invalid routes/dates/cabins rejected | 过去日期、同城、未知舱位、非法乘客数 | PASS |
| 7 | order state machine | 允许/拒绝的状态转换、可用操作 | PASS |
| 8 | check-in seat selection and conflicts | 48 个座位、可用座位值机、占用座位拒绝、登机牌字段 | PASS |
| 9 | check-in requires paid order and future departure | 未支付拒绝、航班起飞后拒绝 | PASS |
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
| p50 | 0.019 ms | 0.742 ms |
| p95 | **0.045 ms** | **1.679 ms** |
| p99 | 0.185 ms | 2.139 ms |
| max | 1.381 ms | 2.139 ms |

测试为单机、确定性模拟库存，不代表生产容量。HTTP 测试包含本地网络与 JSON 序列化开销；阈值分别设为 p95 < 50 ms 与 p95 < 250 ms，均远低于阈值。生产环境仍需针对并发、冷启动、数据库与外部供应商延迟单独压测。

## 3. 浏览器全流程验证（REA）

所有场景使用真实本地 HTTP 服务、真实 DOM 交互和真实后端持久化；未 mock 前端 API。原始 REA 场景和证据 JSON 保留在本地证据包中，不随公开仓库发布；下表保留证据编号并提供最终截图。

| 场景 | 关键动作 | Evidence ID | 截图 | 结果 |
|---|---|---|---|---|
| 首页 | 加载、等待 API 状态与首屏推荐 | `ev_dd8debbe8b9af38559322935b534e5c401ab781685f8796de31f175c098180f7` | [homepage.png](screenshots/homepage.png) | 2 步完成，页面错误 0 |
| 航班搜索与推荐 | 搜索上海→北京、等待智能推荐与动态票价 | `ev_2dc9bfc3c74fec5ada781f0250df242c8fc29ad814b5985a03ddbccde1df3ab6` | [flight-search.png](screenshots/flight-search.png) | 5 步完成，页面错误 0 |
| 登录补全 | 未登录点击预订 → 登录 → 自动回到订票表单 | `ev_5ae1c87b6b120dbe0a1da8fb4d6c2c25da094c657ee6733680c13be37ae2f73b` | [login-to-booking.png](screenshots/login-to-booking.png) | 12 步完成，页面错误 0 |
| 机票全流程 | 搜索 → 选航班 → 下单 → 支付 → 值机 → 登机牌 | `ev_9f912551cdf58abc0d893c7f1012cefffbd5079fe31efc0858e81f1f99f3f6c3` | [boarding-pass.png](screenshots/boarding-pass.png) | 15 步完成，页面错误 0 |
| 酒店 | 酒店搜索 → 详情 → 房型 → 下单 → 支付 | `ev_3e43624672dee001e003ba20b900a5865fc4c27a23fd32039dc8a7ce5c2b6886` | [hotel-payment.png](screenshots/hotel-payment.png) | 15 步完成，页面错误 0 |
| 门票 | 门票搜索 → 详情 → 下单 → 支付 | `ev_33030fa908628a2ac29049b01499153f951b51ee0e6a3be2337ed0541d9119f0` | [ticket-payment.png](screenshots/ticket-payment.png) | 15 步完成，页面错误 0 |
| 行程规划 | 打开 AI 行程助手 → 调用后端生成 3 日行程 | `ev_bff7c7f3f5a72a502509277eb245f768521100c093073c39ba938f492bcefffa` | [itinerary-planner.png](screenshots/itinerary-planner.png) | 7 步完成，页面错误 0 |
| 订单管理页 | 打开订单中心 → 加载 3 个不同状态订单 | `ev_cf3186fb8788b57945f5c32c7bf768c6be255ef0044f1ac74c2dc0cb33e9a83d` | [orders.png](screenshots/orders.png) | 6 步完成，页面错误 0 |

详细索引见 [evidence.md](evidence.md)。

## 4. 需求覆盖对照

| 要求 | 实现与验证 |
|---|---|
| 智能航班推荐 | 后端 48/24/16/12 权重评分；domain 测试验证推荐 ID/最低价一致性；REA 覆盖推荐卡片和理由 |
| 动态票价模拟 | 30 分钟价格桶 + 需求/时间/周末/舱位因子；domain 测试验证确定性与时间敏感性；页面显示动态价格、原价、余票与理由 |
| 在线值机 | 支付后座位图、自动推荐可用座位、后端座位冲突校验、登机口/登机时间/登机牌；API 测试 + REA 全流程 |
| 行程规划 | 后端按城市/天数/偏好生成逐日行程；API 测试 + REA |
| 多角色（旅客/旅行社） | 登录角色选择；旅客订单隔离；旅行社 `scope=all` 与跨用户读取；API 测试覆盖 |
| 航班搜索与展示 | 真实 API 搜索、排序、动态价格；domain/API/REA 均覆盖 |
| 用户订单管理核心页面与后端接口 | 独立订单页面、状态筛选、详情、支付、取消、值机、登机牌；API 测试与 REA |
| 查询到订单创建完整流程 | REA 机票全流程，从搜索结果到支付、值机和登录补全均有证据 |
| 搜索性能 | 400 次进程内 + 40 次 HTTP 性能测试，均有阈值断言 |
| 订单状态流转 | 状态机单元测试 + API 生命周期 + 15 分钟过期/取消/已值机拒绝取消 |
| 前后端分离 | 静态 SPA + Node JSON API；浏览器通过 `fetch` 调用 `/api` |
| 外部模拟 API 集成方案 | MockPay 适配器已实现；航信/DCS 的替换点与生产方案见设计文档 |

## 5. 未验证或仍有限制

1. **没有真实供应商验证**：支付、航信/DCS、短信与实名系统均为本地模拟，不能据此声称真实交易可用。
2. **没有生产并发/容量验证**：JSON 文件存储和内存报价只适用于单进程演示。
3. **没有真实支付回调与幂等 webhook**：仅有本地同步支付和支付锁。
4. **旅行社前端视角未单独截图**：角色与权限由 API 测试覆盖；UI 只通过同一订单页渲染 all scope。
5. **打印登机牌未做物理打印机验证**：仅实现 `@media print` 样式。
6. **移动端与无障碍**：已做响应式样式，但未执行完整移动端视觉回归、键盘操作矩阵或 WCAG 审计。
7. **跨浏览器**：浏览器证据来自 Chrome；未验证 Safari/Firefox。
8. **订单超时任务**：过期检查在读取/支付/取消时惰性触发，没有独立后台定时器；对演示足够，生产应使用计划任务或队列。

## 6. 复现步骤

```bash
cd L:\rea\rexiecheng2\local-site
npm test
npm start
```

浏览器证据使用 REA 6.4.0 针对本地服务采集。原始场景与证据 JSON 含一次性本地 API Token，保存在本地证据包中，不随公开仓库发布；公开文档保留证据编号与最终截图。若要在其他机器复现，需要自行编写等价场景：启动服务 → 登录获得 Token → 通过 REA 存储种子注入 `octrip.api.token.v1` → 执行搜索、下单、支付、值机与订单页操作。
