# 航空旅行一站式服务平台：分析与设计

- 文档版本：1.0
- 对应实现：`local-site/`（前端 SPA + Node 本地 API）
- 边界：本项目只使用本地模拟数据，不连接真实航信、支付、短信或身份证系统，也不会向第三方发起交易请求。

## 1. 项目定位

平台整合机票、酒店与景点门票，面向旅客和旅行社提供从搜索、动态报价、下单、模拟支付到值机/登机牌的一体化流程。核心目标是把“航班查询 → 智能推荐 → 报价 → 订单 → 支付 → 值机”这一复杂链路拆成可验证、可测试的前后端契约。

首屏以机票搜索为主入口，同时保留酒店、火车票与门票入口；酒店推荐、目的地卡片和商旅入口承担一站式平台的内容发现功能。

## 2. 角色与用例

| 角色 | 目标 | 已实现能力 |
|---|---|---|
| 访客 | 快速了解平台并搜索出行产品 | 首页、航班/酒店/门票搜索、详情、行程规划；预订时被引导登录 |
| 旅客 | 完成个人出行预订与值机 | 登录、创建订单、支付、取消、查看个人订单、在线值机与登机牌 |
| 旅行社 | 代旅客管理订单 | 以旅行社角色登录、查看全部旅客订单、查看订单详情和工作台统计；当前不提供企业协议价与批量出票 |
| 运营/管理员 | 商品与订单管理、风控 | 未实现，属于后续迭代 |

```mermaid
flowchart LR
  Visitor([访客])
  Traveler([旅客])
  Agency([旅行社])
  subgraph Platform[航空旅行一站式服务平台]
    UC1([搜索航班、酒店、门票])
    UC2([登录并选择角色])
    UC3([创建订单])
    UC4([模拟支付])
    UC5([在线值机与登机牌])
    UC6([订单管理])
    UC7([行程规划])
    UC8([查看全部订单])
  end
  Visitor --> UC1
  Visitor --> UC7
  Traveler --> UC2
  Traveler --> UC1
  Traveler --> UC3
  Traveler --> UC4
  Traveler --> UC5
  Traveler --> UC6
  Traveler --> UC7
  Agency --> UC2
  Agency --> UC8
  Agency --> UC6
```

关键业务规则：

- 匿名用户可以搜索和查看详情，但不能创建订单。
- 订单创建后处于「待付款」；15 分钟未支付自动失效。
- 只有已支付的机票订单可以值机；酒店与门票订单在支付后等待出行。
- 只有订单所有者或旅行社角色可以读取订单；旅行社可通过 `scope=all` 查看全量订单。
- 值机前再次校验订单状态、航班日期与座位占用，避免仅依赖前端状态。

## 3. 总体架构

```mermaid
flowchart TB
  subgraph Browser[浏览器端]
    UI["index.html / app.js<br/>交互与渲染"]
    API_CLIENT["api.js<br/>fetch + Bearer Token"]
    SHARED["data.js<br/>共享模拟目录"]
  end
  subgraph NodeServer[Node.js 本地服务]
    HTTP["server/app.mjs<br/>HTTP / 路由 / 静态托管"]
    AUTH["auth.mjs<br/>本地会话与角色"]
    SERVICE["service.mjs<br/>应用服务编排"]
    PRICING["pricing.mjs<br/>动态票价 / 低价日历 / 智能推荐"]
    AIRLINE["airline.mjs<br/>模拟航信出票 / PNR"]
    ORDER["order-machine.mjs<br/>订单状态机"]
    CHECKIN["checkin.mjs<br/>30 排选座 / 值机窗口 / 登机牌"]
    ITIN["itinerary.mjs<br/>行程规划"]
    PAYMENT["payments.mjs<br/>MockPay 适配器"]
    STORE["store.mjs<br/>JSON 持久化 / 航班库存 / 酒店房量"]
  end
  DATA[("data/store.json")]
  UI --> API_CLIENT
  API_CLIENT -->|"JSON over HTTP"| HTTP
  HTTP --> AUTH
  HTTP --> SERVICE
  SERVICE --> PRICING
  SERVICE --> AIRLINE
  SERVICE --> ORDER
  SERVICE --> CHECKIN
  SERVICE --> ITIN
  SERVICE --> PAYMENT
  AUTH --> STORE
  SERVICE --> STORE
  STORE --> DATA
  SHARED -. 服务端导入 .-> SERVICE
  UI -. 首页与离线视觉 .-> SHARED
```

分层职责：

| 层 | 模块 | 职责 |
|---|---|---|
| 前端交互 | `public/app.js` | 页面状态、表单、搜索结果、订单页、值机/登机牌、降级逻辑 |
| 前端 API 客户端 | `public/api.js` | 统一请求、Token 存储、错误映射 |
| 共享目录 | `public/data.js` | 32 个航班城市/机场/航站楼、5 家航空公司、酒店、门票的确定性模拟目录；浏览器与 Node 服务共用 |
| 出票适配 | `server/airline.mjs` | 支付成功后生成模拟票号与 PNR；生产替换为航信/GDS 出票适配器 |
| HTTP 层 | `server/app.mjs` | 静态文件、路由、鉴权、JSON 解析、错误响应、安全响应头 |
| 应用层 | `server/service.mjs` | 报价存储、订单编排、权限、支付、过期处理 |
| 领域层 | `pricing.mjs` / `order-machine.mjs` / `checkin.mjs` / `itinerary.mjs` | 动态定价、状态转换、值机规则、行程生成 |
| 集成层 | `payments.mjs` | 模拟支付网关，替换点清晰 |
| 持久化 | `store.mjs` + `data/store.json` | 用户、会话、订单的本地持久化 |

设计取舍：

- **无第三方依赖**：本地演示优先保证开箱即用；HTTP 与数据持久化都使用 Node 内置能力。
- **共享目录模块**：服务端与浏览器使用同一份模拟目录，避免前端展示与后端校验出现航线、机场、价格或库存不一致。航班目录覆盖 32 个主要城市，共 992 个方向组合，每个日期生成 5 个航班。
- **服务端权威**：订单金额、报价有效性、乘机人信息、余票、状态转换与座位占用均在后端重新校验；前端只负责展示与发起动作。
- **报价锁定**：动态票价按 5 分钟价格桶变化，因此搜索返回 10 分钟有效的 `quoteId`；下单只接受有效且未使用的报价。
- **库存扣减**：创建机票订单时扣减航班座位，创建酒店订单时扣减对应房型的房间库存；取消与超时释放。单进程 Node 事件循环保证“校验 + 扣减 + 写订单”在同一个同步段完成。
- **单进程适用**：报价保存在内存，订单与库存保存在 JSON 文件，适合演示与单机测试；生产应替换为数据库事务与分布式缓存。

## 4. 关键业务事件流

### 4.1 航班查询、动态报价与推荐

```mermaid
sequenceDiagram
  autonumber
  actor Traveler as 旅客
  participant Web as 浏览器
  participant API as HTTP API
  participant Service as 应用服务
  participant Pricing as 定价/推荐
  participant Catalog as 共享模拟目录
  participant Quotes as 报价存储

  Traveler->>Web: 输入出发地、目的地、日期、舱位、人数
  Web->>API: GET /api/flights/search
  API->>Service: searchFlights(query)
  Service->>Pricing: buildFlightSearch(...)
  Pricing->>Catalog: getFlights(from, to, date)
  Catalog-->>Pricing: 32 城机场/航站楼、5 家航司、5 班时刻与基础座位
  Pricing->>Pricing: 5 分钟价格桶 + 临近调整 + 需求扰动 + 舱位因子
  Pricing->>Pricing: 评分并生成推荐标签与 7 日低价日历
  Pricing-->>Service: 航班、价格、日历、推荐结果
  Service->>Service: 读取本地余票并过滤不足人数的航班
  Service->>Quotes: 保存每个可用航班的 10 分钟报价
  Service-->>API: results + quoteId + calendar + recommendation
  API-->>Web: 动态票价与智能推荐
  Web-->>Traveler: 推荐卡片、价格、余票、推荐理由
```

### 4.2 下单、支付、值机与登机牌

```mermaid
sequenceDiagram
  autonumber
  actor Traveler as 旅客
  participant Web as 浏览器
  participant Auth as 会话服务
  participant API as 订单 API
  participant Orders as 状态机
  participant Pay as MockPay
  participant Airline as 模拟航信
  participant DCS as 本地值机服务
  participant Store as JSON 存储

  Traveler->>Web: 选择航班并点击预订
  Web->>Auth: POST /api/auth/login（手机号 + 888888 + 角色）
  Auth->>Store: 创建/读取用户与会话
  Auth-->>Web: Bearer Token
  Web->>API: POST /api/orders（quoteId + 1–6 位乘机人 + 联系人）
  API->>API: 校验登录、报价有效期、报价未被使用、乘机人数与证件
  API->>Store: 校验余票并扣减航班库存
  API->>Orders: 创建 PENDING_PAYMENT 订单
  Orders->>Store: 持久化订单、状态历史与库存
  API-->>Web: 待付款订单
  Web->>API: POST /api/orders/:id/pay
  API->>Pay: charge(amount, method)
  Pay-->>API: SUCCESS + transactionId
  API->>Airline: 模拟出票并生成票号 / PNR
  Airline-->>API: ticketNumber / pnr
  API->>Orders: PENDING_PAYMENT → PAID（含出票事件）
  Orders->>Store: 持久化支付与出票信息
  API-->>Web: 已支付、已出票订单
  Web->>API: GET /api/orders/:id/seats
  API->>DCS: 读取 30 排 A–F 座位图与占用状态
  DCS-->>API: 180 个座位
  Web->>API: POST /api/orders/:id/checkin（seat）
  API->>DCS: 校验单客订单、48h–45min 窗口、座位可用
  DCS-->>API: PNR / gate / boardingTime / 登机牌
  API->>Orders: PAID → CHECKED_IN
  Orders->>Store: 持久化值机信息
  API-->>Web: 订单 + 登机牌数据
```

### 4.3 旅行社查看全部订单
```mermaid
sequenceDiagram
  autonumber
  actor Agency as 旅行社
  participant Web as 浏览器
  participant API as 订单 API
  participant Auth as 会话/权限
  participant Store as JSON 存储

  Agency->>Web: 选择“旅行社”角色登录
  Web->>API: POST /api/auth/login
  API-->>Web: Token（role=agency）
  Web->>API: GET /api/orders?scope=all
  API->>Auth: 校验 Token 与 role
  Auth-->>API: 允许读取全部订单
  API->>Store: 查询全部订单
  Store-->>API: 订单列表
  API-->>Web: scope=all + 全部订单
  Note over API,Web: 旅客请求 scope=all 返回 403
```

### 4.4 好友助力砍价

```mermaid
sequenceDiagram
  autonumber
  actor Owner as 发起人
  actor Friend as 好友
  participant Web as 浏览器
  participant API as 砍价 API
  participant Store as JSON 存储
  participant Orders as 订单

  Owner->>API: POST /api/orders/:id/bargain
  API->>Store: 创建砍价会话（发起人先砍一刀）
  API-->>Owner: token、已砍金额、目标 ¥99
  Owner->>Friend: 分享链接 ?bargain=token
  Friend->>API: GET /api/bargains/:token（登录）
  API-->>Friend: 活动进度与 canCut
  Friend->>API: POST /api/bargains/:token/cut
  API->>API: 校验非发起人、每人一次、未失效
  API->>API: 按剩余金额选择衰减档位并记录助力
  alt 达到隐藏成功阈值
    API->>Orders: 订单立减 ¥99 并写入砍价摘要
    API-->>Friend: 砍成 + 更新后的订单
  else 仍差 0.01
    API-->>Friend: 只砍 0.01，进度停滞
  end
  Owner->>API: POST /api/orders/:id/pay
  API->>API: 按折后金额收款并关闭砍价会话
```

规则：仅机票/酒店待付款订单可发起；发起人先砍一刀；好友每人限一次；金额按剩余金额分档衰减，接近目标时只掉 ¥0.01，最后 0.01 会停滞；隐藏成功阈值 18–35 人，另有小概率锦鲤提前成功；取消、支付或超时后活动关闭。演示接口 `/simulate` 仅发起人可用，用于单机体验。

## 5. 动态票价与智能推荐

### 5.1 航班目录与动态票价模型

航班目录覆盖上海、北京、广州、深圳、成都、杭州、三亚、西安、南京、重庆、武汉、长沙、昆明、厦门、青岛、天津、郑州、大连、哈尔滨、沈阳、贵阳、海口、兰州、乌鲁木齐、宁波、福州、济南、合肥、南昌、南宁、太原、长春 32 个主要城市，使用真实城市三字码、机场名称与航站楼；每个方向组合按日期生成 5 班时刻，由东方航空、中国国航、南方航空、吉祥航空、四川航空执飞。航程时长由城市坐标距离推导，基础座位数为 12–36 个。该目录与时刻是本地模拟，不对应真实航班计划。

前后端共用 `public/flight-pricing.js`，本地模式也应用所选舱位与含税动态价格。基础价由现有地图坐标距离、航线市场系数、航司航线系数与各航司的日期报价系数生成，去掉原来的「280 + 日期哈希 + 航司索引 × 81」固定价差。距离是模型输入代理，不是经纬度测算的真实公里数；所有系数都是演示设定，不是市场采样或航空公司公布运价。

每次搜索按 5 分钟为一个价格桶计算，账单价格与服务端报价保持一致：

```text
marketFare = round(baseFare × seasonalFactor × travelDateFactor × timeFactor)
proximityAdjustment = round(marketFare × (leadTimeFactor - 1))
demandAdjustment = round((marketFare + proximityAdjustment) × (demandFactor - 1))
ticketFare = round(max(120, marketFare + proximityAdjustment + demandAdjustment) × cabinFactor)
price = ticketFare + taxFee
```

| 因子 | 取值范围 / 说明 |
|---|---|
| `baseFare` | `round10((240 + 地图距离 × 24) × 航线系数 × 航司系数 × 日期报价系数)`；系数范围分别为 0.9–1.1、0.82–1.18、0.8–1.2 |
| `leadTimeFactor` | 距实际起飞不足 1/3/7/14/30 天分别为 1.48/1.30/1.12/1.00/0.90，30 天及以上为 0.82；按当前 5 分钟桶起点计算，桶内不变价 |
| `seasonalFactor` | 三亚/海口冬季 1.30、哈尔滨冬季 1.25、乌鲁木齐/昆明/贵阳暑期 1.20，其余暑期 1.12，否则 1.00 |
| `travelDateFactor` | 10 月 1–7 日、5 月 1–5 日为 1.40，其他周五/周日 1.10、周二/周三 0.94，其余 1.00；为固定演示高峰窗口，非官方放假安排 |
| `timeFactor` | 8 点前或 22 点后 0.88；8–11 点、17–21 点 1.10；其他时段 1.00 |
| `demandFactor` | 由「航班 + 5 分钟时间桶」确定性哈希得到 0.97–1.03，短时波动随票价规模变化 |
| `cabinFactor` | 经济舱 1.00、超级经济舱 1.35、商务舱 2.60、头等舱 3.80 |
| `taxFee` | 固定模拟税费 80 元 |

`originalPrice` 为模拟参考全价：`max(price, round(baseFare × 1.65 × cabinFactor) + taxFee)`，不是历史成交价。模拟税费与全部票价都不代表现实收费；若要求与实时售价一致，需要接入具备授权的航司或 GDS 报价接口。

每次搜索还会返回：

- `calendar`：所选日期前后 3 天的模拟最低含税价，供日期低价栏切换；
- `priceContext.bucket` / `validUntil`：5 分钟价格桶与当前桶结束时间；
- `pricing.reasons`：例如“临近出发价格上浮”“该时段需求较高”；
- `seatsLeft`：来自本地库存的真实可用座位数；
- `quoteId` / `quoteExpiresAt`：锁定 10 分钟的报价。

服务端只对“有足够余票且满足乘机人数”的航班创建报价。创建订单时重新检查报价、乘机人数、证件与余票，并扣减库存；报价被使用后不可复用。取消或 15 分钟支付超时会把座位释放回库存。

搜索日期限制为今天起 180 天；页面使用低价日期栏、航空公司筛选和价格预算筛选辅助选择。

### 5.2 智能推荐

推荐分由四个归一化指标加权：

| 指标 | 权重 | 说明 |
|---|---:|---|
| 价格 | 48% | 本次搜索中的相对价格 |
| 耗时 | 24% | 总飞行时长 |
| 出发时段 | 16% | 早班/晚高峰/红眼时段的舒适度 |
| 准点率 | 12% | 模拟准点率 |

输出字段：

- `bestId` / `bestFlightNo` / `bestPrice`：综合推荐；
- `cheapestId` / `cheapestPrice`：最低价；
- `fastestId` / `fastestDuration`：最短耗时；
- 每个航班的 `recommendation.score`、`labels`（综合推荐、最低价、最短耗时）和自然语言理由；
- 前端首屏的“智能航班推荐”卡片和每条航班的推荐理由。

## 6. 订单状态机

```mermaid
stateDiagram-v2
  [*] --> PENDING_PAYMENT: 创建订单并扣减余票
  PENDING_PAYMENT --> PAID: 支付成功并模拟出票
  PENDING_PAYMENT --> CANCELLED: 用户取消并释放库存
  PENDING_PAYMENT --> EXPIRED: 15 分钟未支付并释放库存
  PAID --> CHECKED_IN: 机票订单在值机窗口内逐人选座
  PAID --> CANCELLED: 取消并模拟退款/释放库存
  PAID --> COMPLETED: 出行完成（预留）
  CHECKED_IN --> COMPLETED: 出行完成（预留）
  CANCELLED --> [*]
  EXPIRED --> [*]
  COMPLETED --> [*]
```

| 当前状态 | 允许的下一状态 | 触发操作 | 业务校验 |
|---|---|---|---|
| `PENDING_PAYMENT` | `PAID` | 支付 | 金额由服务端生成；支付锁防止并发重复支付；成功后模拟出票并写入票号/PNR |
| `PENDING_PAYMENT` | `CANCELLED` | 取消 | 订单所有者或旅行社；释放已扣减余票 |
| `PENDING_PAYMENT` | `EXPIRED` | 超时任务 | 创建时间超过 15 分钟；释放余票 |
| `PAID` | `CHECKED_IN` | 在线值机 | 1–6 位乘机人逐人选座；起飞前 48 小时至 45 分钟；座位可用；生成 PNR/登机牌 |
| `PAID` | `CANCELLED` | 取消 | 生成模拟退款记录；释放余票 |
| `CHECKED_IN` | `COMPLETED` | 预留 | 当前未开放 |
| `CANCELLED` / `EXPIRED` / `COMPLETED` | 无 | — | 终态，不可支付或值机 |

不变量：

- 任意时刻只能通过状态机 API 改变状态；非法转换返回 409 `INVALID_ORDER_STATE`。
- 每次状态变化写入 `history`（状态、时间、原因）；支付成功额外追加模拟出票记录。
- 已值机订单不可取消；多乘机人订单要求一次提交相同数量的不同座位，并为每位乘机人生成登机牌。
- 支付成功但重复支付返回 409；同一报价只能创建一个订单。
- 航班库存只在创建订单时扣减，取消或超时释放；已值机订单保留占用。
- 值机窗口为起飞前 48 小时至 45 分钟，窗口外返回 409 `CHECKIN_WINDOW`。

## 7. 外部模拟 API 集成方案

当前实现和真实接入的替换点：

| 外部能力 | 当前实现 | 生产接入建议 |
|---|---|---|
| 支付网关 | `server/payments.mjs` 的 `charge({orderId, amount, method})`，本地延迟后返回成功流水 | 接入持牌支付服务；增加商户签名、幂等键、异步 webhook、退款接口、超时与重试 |
| 航信/航班库存 | `public/data.js` 的 32 城模拟航班目录 + `pricing.mjs` 动态价格 + `store.mjs` 本地库存 | 通过服务端供应商适配器访问持牌 GDS/航司 API；加入缓存、限流、舱位库存校验与报价过期处理 |
| 出票/航信 | `server/airline.mjs` 模拟出票，返回票号与 PNR | 接入航信/GDS 出票，保存真实票号、PNR、出票状态并对失败做补偿 |
| 值机/DCS | `server/checkin.mjs` 的 30 排座位图、值机窗口、登机口与登机牌 | 调用航司 DCS/离港系统；服务端保存 PNR/票号；座位锁定时效与登机牌签名 |
| 短信/身份认证 | 固定验证码 `888888` + 本地 Bearer Token | 短信服务 + OIDC/多因素认证 + 会话轮换；禁止生产使用固定验证码 |
| 酒店/门票库存 | 共享模拟目录 | 供应商适配器、库存缓存、价格与取消政策校验 |

集成原则：

- 外部调用只发生在服务端，浏览器不直接持有供应商密钥。
- 对支付与出票操作使用幂等键和订单状态锁，避免重复扣款/重复出票。
- 外部失败与内部失败分开建模；保留供应商流水号和可观测性字段。
- 所有金额在后端重新计算并校验，不接受前端传入的“应付金额”。
- 真实接入需要供应商授权、合规评估与相应的安全审计。

## 8. API 契约

所有 API 响应为 JSON；除登录、健康检查、搜索和生成行程（`POST /api/itineraries`）外，均需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 否 | 服务状态、功能列表与计数 |
| GET | `/api/cities` | 否 | 本地城市列表，可按 `region` 过滤 |
| POST | `/api/auth/login` | 否 | `{phone, code, role}`；演示验证码 `888888` |
| GET | `/api/auth/me` | 是 | 获取当前用户与角色 |
| POST | `/api/auth/logout` | 是 | 注销会话 |
| GET | `/api/flights/search` | 否 | `from,to,date,passengers(1–6),cabin`；往返时增加 `trip=roundtrip,returnDate`；可带 `airline,departWindow,maxPrice`；返回报价与推荐 |
| GET | `/api/trains/search` | 否 | `from,to,date,passengers,type`；返回本地模拟车次 |
| GET | `/api/hotels/search` | 否 | `city,checkin,checkout[,keyword,level]` |
| GET | `/api/attractions/search` | 否 | `city,date[,keyword]` |
| POST | `/api/itineraries` | 否 | `{city, days, preferences}` |
| GET | `/api/itineraries` | 是 | 当前用户保存的行程历史 |
| POST | `/api/itineraries/save` | 是 | `{city, days, preferences}`；生成并保存行程 |
| POST | `/api/orders` | 是 | `type=flight` 用 `quoteId + passengers[{name,document}] + contact`；`hotel` 用 `hotelId/roomIndex/checkin/checkout/rooms` 并扣减房量；`train` 用 `trainId/fromCity/toCity/date/passengers`；`ticket` 用 `ticketId/city/date` |
| GET | `/api/orders` | 是 | 当前用户订单；旅行社可加 `?scope=all` |
| GET | `/api/orders/:id` | 是 | 订单详情（所有者或旅行社） |
| POST | `/api/orders/:id/pay` | 是 | `{method: alipay|wechat|card}` |
| POST | `/api/orders/:id/cancel` | 是 | 待付款或已支付可取消 |
| POST | `/api/orders/:id/bargain` | 是 | 发起或获取该订单的砍价会话，发起人自动先砍一刀 |
| GET | `/api/orders/:id/bargain` | 是 | 订单的砍价进度与状态 |
| GET | `/api/bargains/:token` | 是 | 分享链接详情、进度与当前用户是否可砍 |
| POST | `/api/bargains/:token/cut` | 是 | 好友助力；发起人不能自砍，每位用户限一次 |
| POST | `/api/bargains/:token/simulate` | 是 | 演示模拟好友，仅发起人，`{count:1–10}` |
| GET | `/api/orders/:id/seats` | 是 | 已支付/已值机机票订单的座位图 |
| POST | `/api/orders/:id/checkin` | 是 | `{seats:[...]}`；已支付机票逐人选座；窗口 48h–45min；座位 1–30 排 A–F |
| GET | `/api/orders/:id/boarding-pass` | 是 | 已值机订单的登机牌数据 |
| GET | `/api/agency/dashboard` | 是 | 旅行社订单统计工作台 |

错误统一为：

```json
{ "error": { "code": "INVALID_ORDER_STATE", "message": "订单当前状态为「已值机」，不能取消", "details": null } }
```

常见状态码：`400` 参数错误、`401` 未登录/会话失效、`403` 角色越权、`404` 资源不存在、`409` 报价/状态/座位冲突、`413` 请求体过大、`422` 字段校验失败、`500` 内部错误。

## 9. 数据模型与持久化

- `users`：`id, phone, name, role, createdAt`
- `sessions`：`token, userId, role, createdAt, expiresAt`（7 天）
- `orders`：`id, userId, type, status, statusLabel, title, dateLabel, guestLabel, total, originalTotal?, bargain?, contact, passengers, items, details, payment, ticketing, checkin, history, createdAt, updatedAt`；`type` 支持 `flight/hotel/ticket/train`
- `bargains`：`id, token, orderId, ownerId, status, target, discount, remaining, helperCount, successAt（仅服务端）, helpers[], ownerCut, coupon, createdAt, expiresAt`；与待付款订单同生命周期
- `quotes`：仅内存保存，`id, flight, unitPrice, passengers, expiresAt, usedAt`，10 分钟 TTL
- `inventory`：按航班 ID 保存 `{ totalSeats, reservedSeats }`，用于余票校验与释放
- `hotelInventory`：按「酒店 ID → 房型索引」保存 `{ totalRooms, reservedRooms }`，用于酒店房量校验与释放

持久化策略：

- `data/store.json` 保存用户、会话、订单与航班库存；写入使用临时文件 + 原子重命名，避免部分写入。
- 测试使用临时目录，不污染演示数据。
- 报价只存在内存中，服务重启后旧报价失效；这符合“报价短时锁定”的业务语义。
- 单进程场景下 Node 事件循环与串行写入保证一致性；生产应使用数据库事务/行锁。

## 10. 安全、隐私与可靠性

已实现的基础措施：

- 订单读取与操作进行所有者/旅行社权限校验；
- 金额由后端计算，前端不传总额；
- 乘机人数、姓名与演示证件号由后端校验；
- 航班座位与酒店房量在创建订单时扣减，取消/超时释放，避免超卖；
- 值机座位可用性由后端校验，并校验乘机人数、座位数量与值机窗口；
- 请求体大小限制 1 MB；
- 静态文件路径防目录穿越；
- 响应头 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: no-referrer`；
- 支付使用状态锁防止并发重复支付；
- 报价一次性使用，订单状态机拒绝非法转换；
- 演示验证码不记录真实凭据，服务端不接收支付密码。

生产化缺口：真实认证、HTTPS、CSRF/速率限制、密钥托管、审计日志、真实支付回调验签、数据库与备份、合规与隐私评估、依赖与供应链安全。

## 11. 测试与证据

- 自动化测试：`npm test`。覆盖动态定价、推荐排序、日期/舱位校验、状态机、座位冲突、值机时间、行程规划、完整 HTTP 生命周期、取消/过期、角色权限与搜索性能。
- 浏览器验证：使用 REA 对本地服务执行云端无头 Chromium 场景，覆盖首页、航班搜索、登录补全、下单、支付、值机、登机牌、订单页、酒店、门票与行程规划；均无页面错误。
- 详细结果见 [test-report.md](test-report.md) 与 [evidence.md](evidence.md)。

## 12. 后续迭代

1. 接入数据库（订单事务、乘机人表、真实 PNR/票号与真实 DCS 值机）。
2. 增加管理端：航班/酒店库存、价格规则、订单调度与退款审核。
3. 增加旅行社批量下单、企业协议价和发票信息。
4. 引入真实航班库存、机队/机场数据，完善出发时段与行李规则；当前只支持 32 个城市的本地模拟航班。
5. 增加无障碍审计、移动端视觉回归、端到端跨浏览器测试。
