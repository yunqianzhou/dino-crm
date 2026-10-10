# CRM 双外呼系统接入与通话数据同步需求

版本：V1.1｜日期：2026-09-28｜需求状态：待评审｜原型：GitHub Pages 五期版本

在线原型：[系统配置 · 五期](https://yunqianzhou.github.io/dino-crm/#/system-v5)｜[销售中心 · 五期](https://yunqianzhou.github.io/dino-crm/#/sales-v5)｜[管理看板](https://yunqianzhou.github.io/dino-crm/#/management-dashboard)

关联需求：[CRM 接入 Omicall（越南）外呼系统](https://qjphu5vphyf4.jp.larksuite.com/wiki/Pe4XwfM6li7pwokIl2RjxVNlpke)

## 一、背景与目标

CRM 已有 Sobot 外呼能力，越南业务需要增加 Omicall 本地外呼。销售继续从 CRM 联系客户；管理员为销售勾选绑定 Sobot、Omicall；CRM 页面不填写或选择坐席和线路；同时具备两套可用外呼能力时，由销售在每次起呼前选择本次使用哪套系统。

两套系统的通话数据统一转换成 CRM 的结构化记录，自动进入通话记录，并同步到现有 Dashboard、下钻明细与数据导出。

本期确认的范围：

1. 系统管理绑定外呼时，只勾选 Sobot、Omicall，无需填写或选择坐席和线路。
2. 同时配置两套可用外呼能力时，起呼前必须选择系统。
3. 补齐结构化通话数据，与现有 CRM 数据结构兼容。
4. 现有 Dashboard 合并统计两套系统的数据，明细和导出可核对。

不扩展自动群呼、呼入、供应商平台独立外呼的全量同步、历史通话迁移或 AI 分析。失败后不自动切换另一套系统重拨。

## 二、业务流程

管理员打开成员账号的“绑定外呼/管理外呼” → 勾选 Sobot / Omicall → 保存。

销售点击客户外呼按钮 → 校验可用能力 → 仅一套则自动选中、两套则由销售选择 → 点击“发起外呼” → 调用所选系统，坐席与线路由服务端对接配置及供应商能力自动解析 → 自动接收通话结果 → 保存结构化通话记录 → Dashboard 更新 → 销售可另行填写跟进。

“外呼请求被接受”“通话已结束”“客户已接通”分别表达，不将请求成功等同客户接通。

## 三、原型及页面交互

### 3.1 系统管理：选择要绑定的外呼系统（CALL-001）

入口：系统设置 → 成员账号 → 绑定外呼；已有绑定的成员显示“管理外呼”。沿用成员管理编辑权限。

| 配置项 | 交互与规则 |
| --- | --- |
| 外呼系统 | 可分别勾选“Sobot”和“Omicall”，允许同时绑定 |
| 保存绑定 | 按勾选结果一次保存外呼系统绑定；不校验页面坐席或线路输入 |
| 解绑 | 取消对应系统勾选并保存；只解绑该系统；全部取消则不再具备外呼能力 |
| 列表回显 | 已绑定系统名称（Sobot / Omicall）；刷新、编辑成员基本资料后仍保留 |

本期绑定页面仅包含两个外呼系统选项。不提供坐席/分机和线路输入或选择，起呼窗口也只选择系统。实际坐席和线路由后端解析，不能因去掉表单而伪造默认供应商编号；服务端配置不完整时返回明确失败原因。

保存时重新校验成员管理操作权限；起呼时由服务端校验供应商授权及实际配置。停用账号不可起呼。绑定不赋予用户原本没有的客户数据或拨号权限。修改和解绑记录操作人、时间、变更前后值；历史通话的系统、坐席和线路快照不随之修改。

历史仅存“已绑定”的账号继续沿用原系统既有配置；不能因为升级自动增加 Omicall 权限。旧系统真实坐席/线路缺失时由研发核对迁移，不伪造供应商编号。

### 3.2 销售中心：拨号前选择外呼系统（CALL-002）

入口：沿用客户列表现有外呼按钮。

| 当前账号对该客户的可用能力 | 页面行为 |
| --- | --- |
| 没有可用能力 | 阻止起呼，提示未绑定、绑定失效、账号停用、无权限或国家不支持的具体原因 |
| 仅一套可用 | 自动选中并显示该系统名称；点击发起外呼后才拨号 |
| 两套均可用 | 展示两张选择项；默认均不选；必须选定一套才能点击发起外呼 |

可用能力取以下条件交集：成员启用、拥有外呼权限、客户在可操作范围、系统已绑定、坐席有效、线路可用且支持该客户号码所属国家。

每张选择项只显示系统名称（Sobot / Omicall）。两套都配置但只有一套对当前客户可用时，按“一套可用”处理。每次打开新的起呼窗口重新选择，不默认沿用上一次系统。

发起时重新校验绑定，调用选定系统；实际坐席、线路自动解析。通话进行中不能改选系统；关闭/取消选择窗口不生成电话。防止重复点击、多标签页同时提交产生多次起呼。请求超时但供应商是否起呼不明时，先核实结果，不盲目重拨。

通话面板按真实事件显示发起中、响铃中、通话中、结束或失败。客户接通后才累计接通时长。挂断调用对应供应商能力；关闭页面不能代替挂断，浏览器离开后服务端仍接收结果。

### 3.3 通话记录与跟进

通话事实自动持久化，不依赖销售是否填写备注。销售关闭小结窗口后，已结束通话仍能在通话记录和 Dashboard 中查询；之后补写备注不新增电话。

通话列表补充“外呼系统/线路”，提供结构化详情。详情包含本次实际使用的系统、线路、外显号码、坐席、操作人、结果、起止时间、接通秒数、结束原因及录音状态。

结果、时长、系统与线路为系统只读事实；购买意向、备注、预约继续按现有销售规则填写。供应商回调不覆盖人工备注，不把忙线或技术拒接自动设成业务“无意向”。

录音状态至少区分待同步、可播放、无录音、同步失败；未返回录音不阻塞通话记录和指标更新。供应商源地址与 CRM 可播放地址分别处理，继续复用已有录音同步及访问权限。原型不提供假录音。

## 四、结构化数据（CALL-003，已通过测试库核验）

2026-09-28 通过 `dino_mysql` MCP 对测试库 `dino_english_mgt` 执行只读查询：`SHOW FULL COLUMNS`、`SHOW INDEX`、状态分组统计及跟进关联核对。核验表包括 `sales_call_record`、`sales_outbound_seat`、`sales_follow_log`、`admin_user`、`sales_outbound_audit_log`、`zhichi_callback_event`。未读取客户明细、录音内容或凭证，未执行数据库写入。以下区分已存在的结构与本期改造要求；数据库字段为事实，供应商 API 映射仍需联调。

### 4.1 已存在的通话表字段

两套系统统一落到现有 `sales_call_record`。以下字段均已实际查询确认，不能按前端演示模型另建同名字段。

| 数据 | 实际字段与类型 | 使用要求 |
| --- | --- | --- |
| 内部通话 ID | `id bigint`，自增主键 | 与第三方 ID 分开；前端按字符串传递大整数，避免精度丢失 |
| 客户关联 | `user_id bigint NOT NULL`；`customer varchar(128)`；`business_line varchar(32)` 可空 | `user_id` 关联 `dino_english.user.id`；业务线用于范围与隔离 |
| 被叫号码 | `phone varchar(64)`；`dial_code varchar(8)`、`national_number varchar(32)`、`e164_number varchar(32)` 可空 | 保存起呼时号码快照，供应商适配器负责格式转换 |
| 外呼系统 | `provider varchar(32) NOT NULL DEFAULT 'ZHICHI'` | Sobot 在现库中使用 `ZHICHI`，不改写为 `Sobot` 或 `existing`；本次查询未发现 Omicall 记录，新增值须后端明确，不能声称库内已有 `OMICALL` |
| 防重复与关联 | `correlation_id varchar(36)`、`idempotency_key varchar(64)` 可空 | 已有唯一约束，见 4.3；发起前建立关联 |
| 供应商标识 | `provider_call_id varchar(128)`、`provider_session_id varchar(128)` 可空 | Omicall 最终话单和实时会话 ID 的对应关系需联调 |
| 操作人、领取人 | `agent varchar(128) NOT NULL`；`owner_email varchar(128)` 可空 | `agent` 是起呼坐席/操作人邮箱；`owner_email` 注释是“拨号时的客户领取人快照”，不是操作人或当前 CC |
| 坐席标识 | `agent_uuid varchar(64)` 可空 | 现注释为智齿座席 UUID；Omicall 如何适配须明确，不能把分机号随意塞入 |
| 实际线路 | `route_id varchar(64)`、`route_name varchar(128)`、`caller_number varchar(64)`、`gateway_number varchar(64)` 均可空 | 无需在页面填写。由后端配置/话单提供实际值；未知保留 NULL，不生成默认线路编号；外显号码与网关号码不混用 |
| 流程状态 | `call_status varchar(32) NOT NULL DEFAULT 'COMPLETED'` | 实际值及注释不一致，见 4.2；不能仅依赖默认值或字段注释 |
| 最终结果 | `call_result varchar(32)` 可空 | 注释列出 `CONNECTED / NOT_CONNECTED / FAILED`；主话单到达前允许空；与流程状态组合判断 |
| 接通时长 | `duration_seconds int` 可空 | 注释明确无人接听为 NULL；保留现有存储语义。看板仅对有效已接通记录求和，显示时空值按 0 处理；不得把 NULL 当成零秒接通 |
| 通话时间 | `started_at`、`bridge_at`、`ended_at datetime` 可空 | 分别为 UTC 起呼、双方桥接、结束时间；不是 `answered_at`。是否已桥接客户由供应商事实确认 |
| 等待期限 | `expires_at`、`cdr_deadline_at datetime` 可空 | 分别为拨号意图过期和等待主话单截止时间，沿用现有机制 |
| 技术原值 | `provider_call_result int`、`early_detect_cause varchar(64)`、`reason_of_not_answer varchar(64)`、`hangup_disposition int` 可空 | 当前注释均指智齿语义；不能直接写入 Omicall 不同类型/含义的原值；无已确认通用 `end_reason` 字段 |
| 录音地址 | `provider_record_url varchar(1000)`、`audio_url varchar(1000)`、`recording_object_key varchar(512)` 可空 | 区分供应商地址、CRM 地址、私有对象 Key；不得泄露未授权录音 |
| 录音状态与同步 | `recording_status varchar(32)` 默认 `PENDING`；`recording_synced_at datetime` 可空 | 注释列出 `PENDING / SYNCING / AVAILABLE / FAILED / PROVIDER_EXPIRED`；还有 `recording_retry_count`、`recording_error`、`recording_next_retry_at` 等现成重试字段 |
| 人工备注 | `note varchar(1000) NOT NULL DEFAULT ''` | 自动通话允许空备注；后补备注更新同一记录，供应商回调不覆盖 |
| 记录更新时间 | `created_at`、`updated_at datetime` | 通话表没有通用 `synced_at`；`updated_at` 不是专属回调接收时间，`recording_synced_at` 仅表示录音同步 |

### 4.2 实际状态、空值与展示映射

本次分组查询只观察到 `provider = ZHICHI`。`call_status` 字段注释仍写 `PENDING/COMPLETED/FAILED`，但实际数据已存在 `DIALING / START_FAILED / EXPIRED / COMPLETED / FAILED`；这些列是 varchar，不是数据库 ENUM，观察值也不等于完整接口契约。

| 查询到的组合 | 产品处理要求 |
| --- | --- |
| `COMPLETED + CONNECTED` | 展示已接通，进入有效外呼、接通人数/次数与接通时长 |
| `COMPLETED + NOT_CONNECTED` | 展示未接通，进入有效外呼，不进入接通；具体无人接听/忙线等按原因字段判断 |
| `COMPLETED + FAILED` 或 `FAILED + FAILED` | 展示失败，不计本需求定义的有效外呼；禁止只按 COMPLETED 累计 |
| `START_FAILED + NULL` | 发起失败，保留尝试记录，不计有效外呼 |
| `EXPIRED + NULL` | 已过期/结果未确认，不伪装成无人接听；沿用补查策略 |
| `DIALING + NOT_CONNECTED` | 尚未完结，不因 result 已有值提前纳入统计 |

实际录音状态观察到 `PENDING / AVAILABLE / FAILED`，其余以字段注释为依据，仍需接口验证。“无录音”是产品展示状态，不能擅自新增数据库 `UNAVAILABLE` 值。原型当前中文结果及 `recordingStatus` 小写值只是演示视图模型，生产必须做显式映射。

Omicall 的 `provider` 表示运营商，不能直接覆盖 CRM 的 `provider`。其 `duration`、`answer_sec`、`bill_sec` 不能混用，需结合真实话单确认接通秒数。[官方话单说明](https://api.omicall.com/webhooks/call-hooks)

### 4.3 已存在的绑定、唯一约束与跟进关联

- `sales_outbound_seat` 已有 `admin_user_id`、`member_email`、`provider`、`agent_uuid`、`agent_no`、`agent_name`、`agent_phone`、`ext`、`phone_type`、`enabled`、`bound_by`、`created_at`、`updated_at`。没有 `route_id / route_name` 字段。`agent_uuid` 当前必填；只勾选系统的界面需由后端自动解析真实坐席，不能写空串或假 UUID 绕过。
- 绑定表的真实唯一索引为 `uk_seat_admin_user(admin_user_id)`、`uk_seat_member_email(member_email)`、`uk_provider_agent_uuid(provider, agent_uuid)`。前两个约束使一个成员目前只能有一条绑定；双系统需要有明确迁移方案，不能直接新增第二行，也不能覆盖第一套。
- `admin_user.outbound_seat_id varchar(64)` 注释为“外呼坐席账号（供应商侧 ID）”，不是已确认的 `sales_outbound_seat.id` 外键，也不能塞入系统数组；`admin_user.status` 为 `0=启用，1=禁用`。
- `sales_call_record` 已有 `uk_provider_call(provider, provider_call_id)`、`uk_correlation_id(correlation_id)`、`uk_agent_idempotency(agent, idempotency_key)`。第三方 ID 未返回时可空，需由内部关联防重复。
- `sales_follow_log.call_id varchar(128)` 注释为“外呼录音 callID”。本次全部非空样本都匹配 `sales_call_record.provider_call_id`，没有匹配内部 `id`；因此不能把它默认映射为原型 `callId` 的内部 ID。跟进表没有 `provider`，跨系统第三方 ID 重号的处理需要明确改造。
- `sales_outbound_audit_log` 有 `action`、`target_type`、`target_id`、`operator_email`、`detail_json`、`created_at`，可沿用记录绑定变更。
- 现有回调表是 `zhichi_callback_event`，有唯一 `event_key`、`company_id`、`call_id`、`received_at`、`processed_at`、`process_status`、`payload_json` 等；没有通用供应商字段。它是智齿专用现状，不是已经支持 Omicall 的通用回调表。

### 4.4 本期需评审的后端改造（尚未实施）

1. **双系统绑定**：建议将成员绑定唯一范围调整为“成员 + provider”，同时审查邮箱约束与坐席约束；保持每个成员每个系统一套可用绑定。迁移脚本、兼容读写及回滚由研发确认。本次未执行 DDL。
2. **后台自动关联**：明确勾选后如何按 CRM 成员匹配/创建供应商坐席及解析可用线路；自动关联失败应保存失败并说明原因，不能让用户补填已移除的表单。
3. **供应商标识与回调**：Sobot 继续用 `ZHICHI`；Omicall 标识、专用回调或通用回调适配方案待研发确定。没有证据的字段或表不列为现有结构。
4. **跟进关联**：保留既有 `call_id` 语义，评审是否增加供应商维度或显式内部通话关联，并迁移历史记录；本文不假定新增字段已存在。
5. **供应商原值与租户**：智齿专属整数/原因字段不直接复用为任意 Omicall 内容；原始话单落点及多租户去重范围待接口设计。当前通话表没有供应商租户字段，不能声称已具备租户级唯一约束。
6. **Dashboard 数据源**：复用通话事实及现有查询服务。仅凭库表不能确认看板接口、缓存或刷新时限；不得据此宣称生产看板已接通。


## 五、回调与一致性

1. 发起前建立内部关联，记录所选系统、线路、客户与操作人快照。回调必须能定位这次尝试；号码相同不代表是同一客户或同一次外呼。
2. 实时事件驱动页面状态，最终话单及历史查询负责确认最终事实。重复或乱序事件不会新增通话或令完结状态退回响铃。
3. 现库通话去重范围为 `provider + provider_call_id`，另有 `correlation_id` 与坐席幂等键唯一约束；多租户隔离是待评审改造，不是现有字段。实时事件单独去重。多段话单合并到整通电话，不能逐事件累计次数。
4. 客户已接通与坐席先接听须分开；只确认客户接通才写接通结果。
5. 缺回调、回调失败或话单晚到时进行补查；迟到录音补全同一条记录。正式接入约定补偿间隔、上限、失败告警和权威修正规则。
6. 限定接收并关联本期 CRM 发起的人工外呼；不把 inbound/local 或供应商平台独立起呼混入统计。
7. 回调需校验可信来源及租户。具体鉴权/签名机制以供应商实际能力确定；企业 API 密钥不进入普通业务表单或前端演示数据。
8. 人工备注、预约、转派、付费与掉库计时沿用既有规则。接入 Omicall 不自动改变“什么操作算有效跟进”。

## 六、Dashboard 同步与统计规则

### 6.1 同步位置

- 现有“外呼与跟进概况”的外呼人数、接通人数，使用两套系统统一后的通话记录。
- 现有注册批次转化视图中的已外呼、已接通证据同步读取该记录，继续沿用其注册批次时间口径。
- 外呼区块增加可展开的“外呼系统与线路明细”，按系统 + 线路显示通话次数、外呼人数、接通次数、接通人数和接通秒数；所有数字仅展示，通过“下载通话明细”获取对应通话记录。
- 通话原始明细与导出保留系统、线路、第三方通话标识、操作人、时间、结果和秒数，支持与供应商话单对账。

### 6.2 指标定义

| 指标 | 规则 |
| --- | --- |
| 有效完结通话次数 | 权限和筛选范围内，已完结且结果明确的电话去重数；包含客户未接通；排除发起失败、进行中及结果待核实 |
| 外呼人数 | 上述电话涉及的 CRM 用户 ID 去重数 |
| 接通次数 | 有效完结通话中确认客户接通的电话数 |
| 接通人数 | 已接通电话涉及的 CRM 用户 ID 去重数 |
| 接通时长 | 有效已接通电话的 duration_seconds 之和；未接通计 0，不累计响铃或计费时长 |
| 系统/线路合计 | 次数与秒数可以汇总；跨系统、跨线路的人数重新按用户去重，不将分组人数直接相加 |

例：同一客户先通过 Sobot 未接通，再通过 Omicall 接通 60 秒，则通话次数 2、外呼人数 1、接通次数 1、接通人数 1、时长 60 秒。另一次线路发起失败可以查到尝试记录，但不把通话次数变成 3。

### 6.3 时间、权限和历史

- 活动外呼按 started_at 落入统计日期；越南当地日期按 UTC+7 划分。回调到达日期不替代起呼日期，跨日晚到回调回补原发生日。
- 现有 Dashboard 按用户当前 CC 分组；通话事实保留实际起呼人。当前 CC 分组与坐席业绩不能混为同一口径。
- 当前阶段、注册批次与期间活动继续遵循现有页面定义，不能用新接入改变日期筛选含义。
- 系统/线路明细继承上方用户类型、当前 CC、日期及权限范围；下钻、下载使用同一集合。
- 历史记录没有供应商或线路字段时显示“历史记录/未记录”，保留原有有效统计，不推断为 Omicall。
- 保存备注、录音同步、重复回调、补偿更新不重复累计。权威话单更正事实时，相关人数、次数、秒数和明细一起重算。
- 目标为无需人工导入即可更新 Dashboard。在线原型同一浏览器演示数据仓即时联动；生产写入及 Dashboard 缓存刷新时限由研发在联调前明确，不将演示刷新速度当作已承诺 SLA。

## 七、验收标准

| 编号 | 场景 | 通过条件 |
| --- | --- | --- |
| A01 | 绑定一套 | 只勾选 Sobot 或 Omicall 即可保存，无坐席/线路输入；刷新、编辑成员后保留 |
| A02 | 绑定两套 | 可同时勾选 Sobot 与 Omicall；两个绑定独立保存，不互相覆盖 |
| A03 | 单套起呼 | 自动选中；点击发起后才调用；记录实际系统与线路 |
| A04 | 双套起呼 | 每次重新选择；未选择不可发起；分别选择两套都能走对应链路 |
| A05 | 解绑/停用/失效 | 单独解绑不影响另一套；全部解绑、停用或无权限不能起呼；提交时重新校验 |
| A06 | 真实拨号 | 授权测试号码可被叫通，双向语音正常，外显号码符合线路配置，挂断有效 |
| A07 | 接通/未接通/失败 | 状态、细分原因、时间、秒数正确；发起失败不污染外呼与接通指标 |
| A08 | 未填备注 | 挂断关闭小结仍保存电话并更新有效统计；之后补备注不新增电话 |
| A09 | 重复/乱序/延迟 | 同一电话只一条记录，状态不倒退；迟到录音和补查可更新已有记录 |
| A10 | Dashboard | 两套来源合并；跨系统用户去重；分系统线路明细、下钻、导出对账一致 |
| A11 | 跨日与权限 | UTC+7 日期边界正确，晚到回调回补原日期；越权请求和下载被拦截 |
| A12 | 既有数据回归 | 历史通话保留，其他市场原外呼正常；原有跟进、预约、归属与掉库规则不被改写 |

## 八、研发对接材料与交付边界

研发需要补齐：当前 CRM 外呼接口契约（库中实际值已核验）、已核验约束对应的绑定迁移方案、Omicall 租户/环境/SDK 版本、授权测试坐席和线路、成功与各失败场景的脱敏真实话单、回调校验及补查方案、录音有效期与同步规则、Dashboard 数据刷新时限。

[Omicall Web SDK](https://api.omicall.com/sdk/web-sdk/v2-integration) 支持 CRM 内嵌通话和指定热线；[线路接口](https://api.omicall.com/omicall-api/call-center)提供坐席可呼出线路；[历史查询](https://api.omicall.com/omicall-api/call-transaction/v2)可作为结果补查依据。实际能力与字段以当前租户联调为准。

本次原型交付用于验证绑定、选择、结构化记录、Dashboard 和导出联动；使用模拟通话；坐席、线路等未取得真实返回的字段保持为空，未接入真实供应商、未拨打真实电话。真实语音、供应商回调、录音回收及生产缓存刷新必须通过联调验收。
