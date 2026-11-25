# 分析 rulebook — `1.0.0`

## 原則

- 分析引擎與排盤分離；每條規則有 id、版本、具名來源、條件、適用情境、方向與解釋。
- 回傳 `favorable | mixed | caution | unknown`；無有效規則則 `unknown`。
- 不以八門單獨決定綜合吉凶；不以任意分數冒充機率。
- 規則衝突保留正反理由；並列不強選唯一吉方。

## 已啟用（基礎象意，傳統文化參考，非預測保證）

| ruleId | sourceId | 內容 |
|---|---|---|
| `image.door` | `ba-men-xiang-traditional-v1` | 開／生／休為 favorable；死／驚為 caution；其餘 mixed |
| `image.star` | `jiu-xing-xiang-traditional-v1` | 天心／天任／天輔／天禽 favorable；天蓬／天芮／天柱 caution；其餘 mixed |
| `image.deity` | `ba-shen-xiang-traditional-v1` | 值符／九天／九地／太陰／六合 favorable；白虎／玄武／螣蛇 caution |
| `marker.kong` | `xunkong-traditional-v1` | 旬空 → caution |
| `marker.yima` | `yima-traditional-v1` | 驛馬 → mixed（利出行變動，餘事不全作吉論） |
| `event.yongshen` | `yongshen-<event>-v1` | 事件取用神，依具名事件 profile |

事件類別：一般、求財／經營、談判／合作、出行、拜訪、學習考試、休息。各 profile 明列 favoredDoors / favoredStars 與說明。

## 明確不支援（未驗證，不參與推薦）

`pattern.menpo`、`pattern.jixing`、`pattern.rumu`、`pattern.fuyin`、`pattern.wangshuai`、`pattern.ganlin`。理由見 `UNSUPPORTED_RULES`。刻家任何吉凶判斷亦不支援。

## 雙盤共振（產品自訂交集，非傳統定律）

同方位、同事件、兩盤**皆 favorable** 才標「雙盤交集」；任一 `unknown` 不推共振；衝突顯示 `mixed` 並保留理由。不得稱能量加倍。目前因刻家阻斷，實際不會產生交集結果。

## 年命

只做年干映射（甲需依旬首遁干處理），列出所有候選宮及理由；立春附近缺出生時間不猜年干；不計算完整八字、不判喜用神；切換人物不改變基礎盤 hash。

## 熱力圖與擇時

使用真實邊界（時辰／刻／交節）逐段計算，合併相同分析結果；可取消、分批；分數為規則計數，不是機率。不將相機朝向誤認為出行路線。
