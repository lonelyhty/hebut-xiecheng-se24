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
duration_ms 279.6782
```

| # | 测试 | 覆盖点 | 结果 |
|---|---|---|---|
| 1 | full flight lifecycle | 搜索（8 城/5 航司/5 班）、报价、鉴权、1–6 位乘机人、库存扣减、支付出票、180 座座位图、48h–45min 值机窗口、PNR/票号登机牌、非法重复支付、已值机取消 | PASS |
| 2 | cancellation, hotel and ticket orders, roles and access control | 取消与模拟退款、重复取消、酒店订单金额、门票数量金额、旅客 scope=all 403、旅行社跨用户读取、行程 API、404 | PASS |
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
| p50 | 0.130 ms | 0.846 ms |
| p95 | **0.255 ms** | **1.584 ms** |
| p99 | 0.499 ms | 2.234 ms |
| max | 2.120 ms | 2.234 ms |

测试为单机、确定性模拟库存，不代表生产容量。HTTP 测试包含本地网络与 JSON 序列化开销；阈值分别设为 p95 < 50 ms 与 p95 < 250 ms，均远低于阈值。生产环境仍需针对并发、冷启动、数据库与外部供应商延迟单独压测。

## 3. 浏览器全流程验证（REA）

所有场景使用真实本地 HTTP 服务、真实 DOM 交互和真实后端持久化；未 mock 前端 API。原始 REA 场景和证据 JSON 保留在本地证据包中，不随公开仓库发布；下表保留证据编号并提供最终截图。

| 场景 | 关键动作 | Evidence ID | 截图 | 结果 |
|---|---|---|---|---|
| 首页 | 加载、等待 API 状态与首屏推荐 | `ev_193071324081e18f12e2068948552aa20bdfb2b0d93c97dc2f04e60959e10afe` | [homepage.png](screenshots/homepage.png) | 2 步完成，页面错误 0 |
| 航班搜索与低价日历 | 搜索上海→北京、等待智能推荐、动态票价与低价日期栏 | `ev_babcc206f80ce0ab1b713fafad1882f790cf9a9af5ab12bcd27ba21fa7ee2ff3` | [flight-search.png](screenshots/flight-search.png) | 5 步完成，页面错误 0 |
| 日期切换与航司筛选 | 切换低价日期、选择东方航空、验证结果数量与筛选面板 | `ev_9384382ced052c753bf1c36996ab9f5ecd4bba118b4439a80e305081afe21691` | [flight-filters.png](screenshots/flight-filters.png) | 8 步完成，页面错误 0 |
| 登录补全 | 未登录点击预订 → 登录 → 自动回到包含乘机人字段的订票表单 | `ev_1db9af05a6f1755c8bd21fb22ee802f735ae0bb27df6a351664c92beb33fdece` | [login-to-booking.png](screenshots/login-to-booking.png) | 12 步完成，页面错误 0 |
| 机票全流程 | 搜索 → 选航班 → 填乘机人 → 下单 → 支付出票 → 值机 → PNR/票号登机牌 | `ev_2fe1e908e2a91ddb43751567d5110bc4ea33a4ab1d4464c436aa95f513eab7eb` | [boarding-pass.png](screenshots/boarding-pass.png) | 16 步完成，页面错误 0 |
| 酒店 | 酒店搜索 → 详情 → 房型 → 下单 → 支付 | `ev_aec52eea10932b949588698cdf1250bbcac9d06bc8f7879726fe138016d2781f` | [hotel-payment.png](screenshots/hotel-payment.png) | 15 步完成，页面错误 0 |
| 门票 | 门票搜索 → 详情 → 下单 → 支付 | `ev_426667350c61838c2a92bc8772e2a695c2c99c64582c1c82f6ea725617038ef8` | [ticket-payment.png](screenshots/ticket-payment.png) | 15 步完成，页面错误 0 |
| 行程规划 | 打开 AI 行程助手 → 调用后端生成 3 日行程 | `ev_3e2ba1f62b54c26f6241dd3a484da1eeac328cfabeabc3f3e656aa7d5c2b17ae` | [itinerary-planner.png](screenshots/itinerary-planner.png) | 7 步完成，页面错误 0 |
| 订单管理页 | 打开订单中心 → 加载 3 个不同状态订单 | `ev_02ecccb8134e532e055da7a6f1c4e2972596e1f2441f1e34a2ea389b8f0322f5` | [orders.png](screenshots/orders.png) | 6 步完成，页面错误 0 |

详细索引见 [evidence.md](evidence.md)。

## 4. 需求覆盖对照

| 要求 | 实现与验证 |
|---|---|
| 智能航班推荐 | 后端 48/24/16/12 权重评分；domain 测试验证推荐 ID/最低价一致性；REA 覆盖推荐卡片和理由 |
| 动态票价模拟 | 5 分钟价格桶 + 临近调整/需求扰动/舱位因子 + 80 元税费；domain 测试验证确定性与时间敏感性；页面显示动态价格、原价、余票与理由 |
| 在线值机 | 支付出票后 30 排 A–F 座位图、48h–45min 窗口、单人订单、后端座位冲突校验、PNR/票号/登机口/登机时间；API 测试 + REA 全流程 |
| 行程规划 | 后端按城市/天数/偏好生成逐日行程；API 测试 + REA |
| 多角色（旅客/旅行社） | 登录角色选择；旅客订单隔离；旅行社 `scope=all` 与跨用户读取；API 测试覆盖 |
| 真实机场/航司目录 | 8 城真实三字码、机场/航站楼、5 家航司、基于距离的 5 班时刻；页面与 API 使用同一目录 |
| 余票库存 | 搜索过滤余票不足、下单扣减、取消/超时释放；API 与 REA 覆盖 |
| 乘机人信息与出票 | 1–6 位乘机人姓名/演示证件号；支付后票号与 PNR；订单页与登机牌展示 |
| 航班搜索与展示 | 真实 API 搜索、排序、动态价格；domain/API/REA 均覆盖 |
| 用户订单管理核心页面与后端接口 | 独立订单页面、状态筛选、详情、支付、取消、值机、登机牌；API 测试与 REA |
| 查询到订单创建完整流程 | REA 机票全流程，从搜索结果到支付、值机和登录补全均有证据 |
| 搜索性能 | 400 次进程内 + 40 次 HTTP 性能测试（含 7 日低价日历），均有阈值断言 |
| 订单状态流转 | 状态机单元测试 + API 生命周期 + 15 分钟过期/取消/已值机拒绝取消 |
| 前后端分离 | 静态 SPA + Node JSON API；浏览器通过 `fetch` 调用 `/api` |
| 外部模拟 API 集成方案 | MockPay 适配器已实现；航信/DCS 的替换点与生产方案见设计文档 |

## 5. 未验证或仍有限制

1. **没有真实供应商验证**：支付、航信/DCS、短信与实名系统均为本地模拟，不能据此声称真实交易可用。
2. **没有生产并发/容量验证**：JSON 文件存储和内存报价只适用于单进程演示。
3. **没有真实支付回调与幂等 webhook**：仅有本地同步支付和支付锁。
4. **旅行社前端视角未单独截图**：角色与权限由 API 测试覆盖；UI 只通过同一订单页渲染 all scope。
5. **多人值机未实现**：与 GPT 版一致，支付出票支持 1–6 人，但当前在线值机仅支持单人订单。
6. **航班仅覆盖 8 个城市**：其余城市在航班搜索中会返回“暂无可模拟航班”，酒店/门票不受此限制。
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
