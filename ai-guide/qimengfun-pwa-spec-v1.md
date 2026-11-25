# QiMenGFun 奇門吉方 — Coding Agent 施工規格 v1.0

- 日期：2026-11-25
- 狀態：產品需求定版；專業規則驗證為發布前必要關卡
- 母本：https://github.com/donma/BaziGFun （main；施工時記錄 commit SHA）
- 目標：獨立 GitHub repository `QiMenGFun`，部署 GitHub Pages，提供可安裝、離線、本機優先的實景奇門時空羅盤。
- GFun 為吉方諧音。介面使用臺灣繁體中文。

## 0. Agent 執行契約

1. 先讀母本 README、`ai-guide/bazigfun-pwa-spec-v1.md`、原始碼、測試及部署設定；建立重用清單與基準測試結果。不得修改原 BaziGFun repo 或既有部署。
2. 在新 repo 實作完整產品，不只製作靜態展示。按本文階段執行、測試、修正、部署；有授權才建立遠端 repo／推送。不得假報部署或實機測試成功。
3. 已定 UI 不擅自更改；專業細節可依具名資料來源決策，但必須記錄版本、差異及驗證證據。若刻家規則證據不足，繼續研究、完成其餘功能，禁止以示意資料冒充正式盤。未通過完整發布關卡，不得標記 v1 正式完成。
4. 禁止以 LLM 即時計算命盤、假 API、隨機吉凶、任意旋轉生成盤局。圖像僅供視覺設計，不得將其文字、局數或方位當演算法真值。
5. 無帳號、後端、廣告、分析 SDK 或付費 API；所有出生資料、位置、相機畫面、事件、紀錄皆本機處理。外部 AI 僅使用者主動複製資料，先預覽並明示隱私。
6. 傳統文化參考，非科學驗證的預測或物理能量量測；禁止承諾求財、健康、投資等結果。

## 1. 範圍及決策表

| 題 | 已定決策 |
|---|---|
| 1 | 時家＋刻家雙盤，單盤／雙盤及交集 |
| 2 | 轉盤體系，不做飛盤 |
| 3 | 時家拆補，不做置閏、茅山 |
| 4 | 10 分鐘刻家，12 刻／時辰；獨立具名規則 |
| 5 | 裝置當地標準鐘面時間預設；可選真太陽時、GPS 或經度手填 |
| 6 | 簡易／專業／自訂盤層；預設專業（委託決策） |
| 7 | 2.5D 感應全息盤 |
| 8 | 底部時間軸＋可拖外圈，雙向同步 |
| 9 | 三種光效，預設吉方聚焦 |
| 10 | 混合式左右功能欄 |
| 11 | 上方分層可展開資訊列 |
| 12 | 宮位浮動卡＋底部詳細抽屜 |
| 13 | 固定冷灰藍遮罩，暫定 18%；無控制、無自適應 |
| 14 | 摺疊展開左實景右多功能分析 |
| 15 | 羅盤、分析、時光、紀錄、工具五分頁 |
| 16 | 選用人物管理＋年命；首次不強制建人 |

不做年/月/日家、飛盤、完整八字綜合判斷、雲端同步、登入、匯入還原、SLAM／物件朝向辨識。事件擇時、熱力圖、AI 複製為本文件委託決策的 v1 功能，前提是規則可驗證。未確認的實作細節以簡單、可讀、低耗電為原則。

## 2. 架構與重用

React + TypeScript strict + Vite + vite-plugin-pwa；沿用母本測試工具與鎖定依賴。不得引入重型 3D 引擎。SVG + CSS transform + requestAnimationFrame；必要時 Web Worker 進行區間分析。純函式 domain 不依賴 DOM、React、系統當前時間。

```text
src/
  app/                 # router/state/onboarding/layout/panels
  domain/calendar/     # timezone, solarTerms, ganzhi, solarTime
  domain/qimen/        # types, tables, hourEngine, keEngine, profileRegistry
  domain/analysis/     # patterns, rules, eventProfiles, yearLife, overlap
  domain/compass/      # 母本 heading 幾何
  sensors/             # 母本 orientation/processor/hooks
  camera/              # 母本 cameraManager/coverCrop/composite
  components/          # QimenDial, PalaceCard, NinePalaceGrid, TimeFlowBar
  time/                # TimeController, boundaryScheduler, playback, cache
  animation/           # layer transition, pose, light effects
  storage/             # schema, migration, repository
  export/              # JPEG, JSON, ZIP, AI prompt
  pwa/                 # registerSW
  styles/              # design tokens, mobile, foldable, accessibility
scripts/               # 母本 browser checks + qimen fixtures
ai-guide/              # 本文、rulebook、source ledger、acceptance report
```

重用 `src/domain/compass/heading.ts`、`src/sensors/*`、`src/camera/cameraManager.ts`、`coverCrop.ts`、`src/app/layout.ts`、`src/pwa/registerSW.ts`、部署與測試腳本；調整 `composite.ts`、storage/export、App/panels、SVG。母本 `lichun.ts` 僅可作天文計算參考，不能把立春單一節氣實作當完整曆法。移除八宅命卦與大遊年產品邏輯。新 manifest、icon、base、SW scope、資料庫及 localStorage key 必須獨立。

## 3. 曆法與時間契約

- 內部時刻使用 UTC epoch milliseconds；顯示和輸入有 IANA timezone。即時模式預設裝置當地民用鐘面時間（包含適用的 DST），標示 UTC offset。歷史／未來可指定時區，不能依目前 offset 推算其他日期。
- DST 重複時間要求使用者選早／晚 offset；不存在的時間提示修正，不默默挪動。真太陽時依 UTC、經度（東正西負）、均時差計算：UTC 分鐘 + 4×經度 + EoT，再正規化日期。明確標示修正量與日期跨界；不把夏令時間當經度修正。GPS 只在使用者要求時取得一次，顯示精度與時間；拒絕時允許手填經度，無有效經度時不得宣稱真太陽時。
- 交節以太陽視黃經每 15° 的實際 UTC 時刻為準；真太陽時只改干支鐘面判定，不移動天文交節瞬間。選有授權的本機曆法庫／天文資料，鎖版並比對官方曆表。第一版建議支援 1900–2100，僅發布已驗證範圍，超出則拒絕排盤。節氣誤差須量化，接近誤差窗提示交界不確定。
- 委託決策：時家採子初 23:00 換干支日、立春換干支年、十二節換月；時支子 23:00–01:00，其後每兩小時一支；以有效鐘面時間判定。日干支算法須有獨立錨點、儒略日與 Gregorian 日期測試，不可直接使用本機 Date 隱含時區。
- 刻盤時間區間：[時辰起點+10k 分鐘, 起點+10(k+1) 分鐘)，k=0..11；這是時間索引，不等同刻干支／定局。真太陽時模式以修正後時間求邊界，逆求對應 UTC；DST、交節等額外事件由排盤 profile 決定。144 是名義鐘面日區間數，不能假設所有 DST 日實際均 24h。
- 計時調度：下一邊界取所有相關規則事件最早 UTC 時刻，不僅每兩小時；含交節、換日、刻邊界。背景返回／系統時鐘跳變／時區變更重新計算，不補播已過動畫。

## 4. 時家轉盤拆補核心

以下為委託選定的 v1 profile 草案 `hour-zhuan-chaibu-v1`；中五寄坤、子初換日，與參考站設定對齊。施工先落成可審核 rulebook，核對全部例外後才標記 verified。

固定宮位：1 坎北 0°、8 艮東北 45°、3 震東 90°、4 巽東南 135°、9 離南 180°、2 坤西南 225°、7 兌西 270°、6 乾西北 315°、5 中宮無水平角。順時針環序 `[1,8,3,4,9,2,7,6]`，數序 1–9 與環序不得混用。九宮方格傳統上南下北：`4,9,2 / 3,5,7 / 8,1,6`。實景盤按北0東90映射；不得使用概念圖錯誤方位。

定局：冬至起陽遁、夏至起陰遁；向前找含當日的最近甲日或己日為符頭，地支子午卯酉上元、寅申巳亥中元、辰戌丑未下元。實際交節即改節氣，元依日柱。局數表（上中下元，施工需逐項核對古籍／同 profile 來源）：

| 陽遁節氣 | 上中下 | 陰遁節氣 | 上中下 |
|---|---|---|---|
| 冬至 | 1 7 4 | 夏至 | 9 3 6 |
| 小寒 | 2 8 5 | 小暑 | 8 2 5 |
| 大寒 | 3 9 6 | 大暑 | 7 1 4 |
| 立春 | 8 5 2 | 立秋 | 2 5 8 |
| 雨水 | 9 6 3 | 處暑 | 1 4 7 |
| 驚蟄 | 1 7 4 | 白露 | 9 3 6 |
| 春分 | 3 9 6 | 秋分 | 7 1 4 |
| 清明 | 4 1 7 | 寒露 | 6 9 3 |
| 穀雨 | 5 2 8 | 霜降 | 5 8 2 |
| 立夏 | 4 1 7 | 立冬 | 6 9 3 |
| 小滿 | 5 2 8 | 小雪 | 5 8 2 |
| 芒種 | 6 3 9 | 大雪 | 4 7 1 |

演算順序：
1. 確定干支、節氣、元、遁、局；地盤自局數宮起，按戊己庚辛壬癸丁丙乙，陽順陰逆數序布入九宮。
2. 時柱旬首六甲對應甲子戊、甲戌己、甲申庚、甲午辛、甲辰壬、甲寅癸；由旬首遁干在地盤位置取得原值符星與值使門。原星按宮 1..9 為天蓬、天芮、天沖、天輔、天禽、天心、天柱、天任、天英；原門 1..9 為休、死、傷、杜、無、開、驚、生、景。
3. 值符星隨時干地盤落宮（甲時使用旬首遁干），其餘星依外八宮環序同步轉動；天盤干與星原地盤來源同步，天禽／中五依寄坤規則處理，保留主寄雙干，不覆蓋資料。
4. 值使門由旬首宮按旬內步數陽順陰逆數序走宮，再把八門依環序配置。八神依值符星位置起值符，陽順陰逆排列值符、螣蛇、太陰、六合、白虎、玄武、九地、九天；陰陽神名差異採 profile 明示。中五值使／時干入中／天禽寄宮的具體例外須以同流派例盤核對，禁止靠一般 modulo 猜測。
5. 旬空、驛馬、日干／時干落宮獨立推導；空亡映射地支方位（含相鄰雙支宮）須明示。年命另計，不參與上述步驟。
6. 每盤提供 calculationTrace、source/profile version、有效起局時間、九宮完整資料。確認同條件重算結果一致。

最低參考錨點：參考 [白話命理拆補法](https://baihuamingli.com/qimen/chaibu/) 的 2026-01-05 台灣 16:23 與 16:24 例，兩者己卯日、壬申時，上元；前陽一局、值符天蓬落坤二、值使休落離九，後陽二局、值符天芮落乾六、值使死落坎一。此為來源例，不代表已實跑測試；須記錄其節氣資料版本與差異。

## 5. 十分鐘刻家：發布阻斷關卡

研究已確認十分钟刻家存在多個不同體系。候選採周道十分钟刻家（冬至／夏至分遁，174／936 序列）；現有綜述未公開足夠完整的刻干支、局數映射及轉盤例盤，因此不把候選直接寫成正式算法，也不把 12 分鐘張闐法硬改成 10 分鐘。此為本規格目前唯一主要專業阻斷項，Agent 必須優先處理。

- 查原著或完整傳承教材、完整公式與可核對例盤；若周道不具足夠資料，可選另一具名 10 分鐘轉盤體系，但需在 decision log 說明並維持 12 刻時間索引。
- 產出 `ai-guide/ke-rulebook-v1.md`：每刻干支／起始對照、遁別、局數、三元或其他規則、旬首、值符值使、星門神天地干、中宮、跨時辰／日／節氣、至少兩個獨立依據或原著例盤＋獨立手算。不能引用來源沒有提供的公式。
- 独立 `keEngine`、獨立版本與 fixtures；可共用已證實相同的轉盤純函式，不得用時家盤偏移、循環八門或亂數替代。
- 未核對完成時，正式資料回傳 `unverified`，刻家 UI 顯示「刻家規則尚待驗證」，不顯示虛假吉方、不做雙盤推薦、不保存假盤；開發 fixture 僅 dev build 使用，production 禁止。
- 驗收：每刻邊界前後、12 刻全覆蓋、子時跨日、冬夏至、陰陽遁、各局與寄宮；至少 30 具名全盤 fixture，含兩種遁別及中宮例外，來源、設定、期望值和核對者可追溯。驗證不足須在交付報告列明，不能宣布完整 v1 上線。

## 6. 型別與分析規格

```ts
type PalaceId = 1|2|3|4|5|6|7|8|9;
type ChartKind = 'hour'|'ke';
type TimeBasis = 'civil'|'apparent-solar';
interface ChartInput { instantMs:number; timezone:string; basis:TimeBasis; longitude?:number; profileId:string; }
interface Palace { id:PalaceId; earthStems:string[]; heavenStems:string[]; stars:string[]; door:string|null; deity:string|null; hostedFrom:PalaceId[]; markers:string[]; }
interface Chart { kind:ChartKind; input:ChartInput; profileVersion:string; validFromMs:number; validUntilMs:number; dun:'yang'|'yin'; ju:number; yuan?:'upper'|'middle'|'lower'; term:string; pillars:Record<string,string>; xunHead:string; dutyStar:string; dutyDoor:string; palaces:Palace[]; trace:RuleTrace[]; }
interface RuleTrace { ruleId:string; sourceId:string; inputs:Record<string,unknown>; outcome:string; }
type ChartResult = {status:'ok';chart:Chart}|{status:'unverified'|'unsupported'|'invalid'|'error';reason:string};
```

- 分析引擎與排盤分離。每條規則有 id、版本、具名來源、條件、適用情境、方向及解釋；返回 favorable / mixed / caution / unknown，無有效規則則 unknown。不得以八門單獨決定綜合吉凶，也不以任意分數冒充機率。
- 基礎象意：八門、九星、八神、宮五行；進階門迫、擊刑、入墓、伏吟、反吟、旺衰、干加臨、空亡、馬星等，逐條驗證後啟用，未驗證者明確不支援。規則衝突保留正反理由。
- 事件分類：一般、求財／經營、談判／合作、出行、拜訪、學習考試、休息。各自具名取用神及規則，顯示依據，不提供絕對預測。時家、刻家可獨立分析。
- 雙盤共振是產品自訂交集，不是傳統定律：同方位、同事件、兩盤均 favorable 才標雙盤交集；任一 unknown 則不推共振，衝突顯示混合。不得稱能量加倍。排序以規則優先順序及理由為準，並列不強選唯一吉方。
- 擇時掃描預設今日／明日／7日、自訂最多 31 日；使用真實邊界逐段計算，合併相同分析結果，支援取消，長區間 worker／分批運算；熱力圖 8 方×時間，點格切換到對應時刻。顯示計算方法、時區、有效區間、unknown；不將當前相機朝向誤認出行路線。

## 7. 人物與首次流程

首次歡迎頁簡要文化用途、相機與方向權限說明，使用者手勢觸發權限；直接進入一般模式。拒絕相機仍可使用純盤；拒絕感測可手動方位。GPS 真太陽時另行授權，不綁首次啟動。

人物選用：工具→人物→新增／編輯／切換／刪除；名稱建立時必填，生日、出生時辰（精確時分／時辰／未知）、性別（可不填）、出生地與時區選填。年命分析至少需可信出生年干；立春附近缺時間提示不確定，不猜年干；依已驗證 profile 將年干（甲需具名遁甲處理）映射天盤或指定盤層，顯示所有候選宮及理由，不以八字喜用神代替。切換人物不得改變基礎 Chart hash。生日未知時不顯示年命結果。完整八字不計算、不判喜忌。

## 8. UI 強制視覺基準

以使用者確認的藍白星象圓盤及 2.5D 客廳實景概念為母版，參考圖不等於真實盤。主色深海軍藍 #041323、線條 #72D5FF、文字 #D9F3FF、吉方 #36EBC0、凶方 #DD6675、中性 #7293B0。色值是工程起始值。使用可離線的合法繁中文字體（沿用母本 Noto Serif TC 授權／重新產生字型子集）；數字採等寬數字；長文用易讀 sans。拒絕黃金主題、紫色遊戲風、過度粒子與不透明圓盤。

視覺層序：video → 固定冷灰藍遮罩（例如 rgba(30,45,60,.18)，pointer-events none）→ 局部徑向柔霧 → 星象裝飾 → SVG 方位／盤層 → 光效 → UI 浮層。遮罩覆蓋相機但不覆蓋盤面及文字，不提供控制滑桿／自動亮度。資訊卡用半透明深藍底、細亮邊及有限 blur，低效能時用實色透明底替代。

### 8.1 手機主畫面

```text
┌───────────────────────────────┐
│ ☰    QiMenGFun 奇門吉方   ⚙   │
│ 13:26:38 未時三刻｜陰陽遁 局數⌄ │
│ LIVE／預覽時間標記  感測 相機   │
│       即時相機背景             │
│ 模式    藍白全息圓盤     朝向   │
│ 實景   多層同心圓太極    45°   │
│ 流轉   360° 方位與吉方   宮位   │
│ 盤層                    宜忌   │
│       宮位浮動卡（選中才有）     │
│ ▶ ──────●────── NOW  速度     │
│ 羅盤   分析   時光   紀錄   工具 │
└───────────────────────────────┘
```

直式手機側欄採小型圖示／可收合；最小觸控區 44 CSS px；盤面優先，不得文字溢出、側欄遮蔽主要宮位。上方展開顯示公曆農曆、節氣、四柱、時家及刻家各自局數/值符值使、時間基準、修正量、經度（如取得）、方法版本、有效時間。雙盤資訊不混成同一局。點外部／收合箭頭可關閉。

### 8.2 圓盤與圖層

固定九宮／八方向、外刻度、地盤、天盤、九星、八門、八神、刻家摘要、中央太極、時間外光軌、吉凶提示各自可渲染。專業預設呈現八門九星八神與天地干；窄螢幕自動降低非必要文字密度、點宮可見全資料。簡易模式突出方位、八門、提示；自訂模式勾選盤層、設定透明度（只限盤層，不含固定遮罩），保留方位與可信狀態。雙盤模式以分離同心環及明確時／刻標識呈現；詳細雙盤可切分析頁並列九宮，不擠滿主圓盤。

實景北0東90，指南針跟實際鏡頭朝向旋轉，文字始終正立；九宮方格可採傳統南上北下並標註。中心中五無實景方位，點太極查看中宮，不給虛假方向。點宮浮動卡含門星神、時刻區間、評價與依據摘要；展開 bottom sheet 完整天地干、格局、時／刻切換、年命與事件解釋。底部抽屜支援滑動、關閉鍵、點外、Esc；鍵盤焦點管理；選中方位與實際朝向分別標示。

### 8.3 光效主題

A 全盤：青綠／藍／低亮紅＋文字或符號；B 純藍：亮度、線型、文字區分；C 吉方聚焦（預設）：有利方位青綠呼吸光與引導線，其他低亮藍，必要警示文字。unknown 使用中性線型與未知標識，不誤顯吉凶。光暈、波紋為裝飾，不能遮住數字、不能代表物理能量。減少動態模式停止呼吸／粒子／太極轉動，保留狀態更新。

### 8.4 五大分頁

| 分頁 | 內容 |
|---|---|
| 羅盤 | 即時／預覽實景、盤層、校正、鎖定、拍照、宮位卡 |
| 分析 | 九宮盤、時刻雙盤比較、事件、格局、年命、複製 AI 解盤資料 |
| 時光 | 日期時間、雙控制、播放、熱力圖、擇時結果 |
| 紀錄 | 照片與盤局快照、標題備註、查看／分享／刪除／匯出 |
| 工具 | 人物、時間基準、經度、感測校正、光效、動態／省電、資料容量、關於 |

分頁切換保留選定時間、人物、方位狀態。離開實景頁可關閉相機節電；時間探索在羅盤頁時可持續開啟。選擇照片／詳細分析不需重建 App 狀態。

### 8.5 RWD 與摺疊

沿用母本 safe-area、container queries、Viewport Segments 判斷；不按裝置型號硬編。窄直式單欄、橫式左盤右資訊、寬屏雙欄。展開左右雙螢幕：左實景，右側九宮／時光／吉方／紀錄 tabs；上下分屏：上實景、下分析；彈窗不得跨鉸鏈。無 segments API 時以 viewport 寬度自適應。測試 iPhone Safari/Chrome/PWA、Android Chrome、桌面 Chrome/Edge、平板與摺疊模擬；真實摺疊裝置另行驗收。

## 9. 時間與動畫引擎

單一 TimeController：`mode: live|preview|playing`、`instantMs`、`rangeStart/End`、`speed`、`direction`、`basis`。真實時間與模擬時間標示不同；NOW 立即回 live。日期選擇、橫軸、外圈旋轉、上一／下一分鐘及刻、播放控制都寫同一狀態。橫軸精度 1 分鐘，外圈拖曳按 120 分鐘跨度映射角度，跨 0° 可累積，手勢需明確命中外圈並 pointer capture；手機轉向不得改時間。提供鍵盤與非拖曳替代。

播放 1×／10×／60×／600×，正反向、暫停、今日／自訂範圍，終點停止。用單調時鐘映射模擬時間而非 setInterval 累加；跳過中間盤時清楚標記，不排隊播放過時動畫。時鐘每秒，光軌連續，刻盤每有效邊界，時盤每相關邊界。拖曳節流約 80–120ms，放手即精算最終值。快速操作採 latest-wins／取消舊 worker 任務。

渲染使用固定宮位坐標、盤層元素的 from/to 映射。正常換盤 350–750ms；跨節氣／遁別最多 1200ms；元素沿圓弧移到計算出的目標（需寄宮例外則淡出入），不能假設每層永遠同角度。動畫僅 presentation，資料在邊界原子提交；過渡期點擊／拍照以已提交新盤為準，必要時先完成視覺過渡。手機 pose 只加微幅 CSS 透視（建議 ±5°、小量視差），與方位角／盤局／時間獨立。太極慢轉與光粒子是純裝飾；不影響中宮。

效能：不在每個 rAF 重算排盤或觸發 React 全樹 render；CSS transform/opacity、memo SVG、限制 blur 與粒子（初始上限 30），低效能降至靜態或 30fps，前景目標 60fps；隱藏頁面停止 rAF、相機與 wake lock。支援 prefers-reduced-motion 及手動省電。用實測 frame timings、長任務、耗電觀察決定是否再降級。

## 10. 方位與相機

沿用母本姿態幾何、圓形濾波、扇區遲滯（1.5°）、交界 ≤2°、手動校正、鎖定方位、精度與資料來源語義。iOS `webkitCompassHeading` 必須實機驗證；Android absolute orientation、relative orientation 分開；相對資料不冒充絕對北。鏡頭接近垂直（母本 >65°）凍結最後有效讀數並暫停判定；無資料顯示示範而不當量測，stale 顯示最後讀數。預設磁北；真太陽時不等同真北。若未有可靠磁偏角模型，第一版不提供真北自動轉換，UI 清楚標記磁北。使用者手動校正不等同已知真北。

相機後鏡頭、HTTPS、手勢授權、生命週期沿用母本；背景停止 tracks，返回恢復，競態取得的過期 stream 立即關閉。外力中斷／拒絕／不支援皆有重試及純盤模式。照片拍攝保存畫面實際 cover crop、遮罩、盤局與時間資訊，使用快照而不是畫面截圖猜測；若方向無效禁止記錄為已量測，可另存純盤截圖。照片須區分 capturedAt 與 chartInstant，預覽盤加「模擬時間」標示。不得把鏡頭朝向等同門／床本身朝向，不聲稱 SLAM 或精密測量。

## 11. 儲存、匯出與 PWA

localStorage `qimengfun.v1` 存設定、人物索引；IndexedDB `qimengfun-v1` 存人物、records、photos（Blob）、chart snapshots；資料版本 migration 可測試，失敗保留舊資料並提示，不自動清除。Record 含 UUID、personId nullable、title、note、capturedAt、chartInstant、時／刻 snapshot、profile/rule version、時間基準、時區、經度（必要時且使用者同意）、heading raw/display、quality、source、northReference、nearBoundary、photoId。JSON 不內嵌 base64；JPEG 合成預設品質 .88；ZIP 包含 `qimengfun-data.json`、`photos/<uuid>.jpg`；分享支援 Web Share API，失敗下載。容量估計與 quota 提示；資料僅本機可能因系統清除遺失，提示定期匯出。第一版無匯入／還原。

AI 複製：先預覽完整盤面 JSON 或人可讀文字＋問題＋方法版本，預設排除名稱、精確位置及生日，勾選後才包含；不自動送出。Prompt 要求 AI 不重新算盤、指出不確定、依提供盤局及傳統規則解釋，不承諾結果。

PWA manifest `id/start_url/scope`、icons 192/512/maskable、standalone、theme color、safe area；GitHub Pages base `/QiMenGFun/`，SW precache app shell、字體、規則／曆法資料及 chunk；首次完整快取後才標離線可用。版本更新在完整快取後接管，拍照／匯出等工作中延後重載，避免更新循環；不得清 IndexedDB。無網路仍可計算已驗證範圍、時間回放、分析、手動方位、拍照（權限及裝置允許時）、匯出。沒有外部 CDN runtime 依賴。首次安裝需 HTTPS 與網路。

## 12. 驗收矩陣與交付

| 關卡 | 最低驗收 |
|---|---|
| 曆法 | 24 節氣、立春、冬夏至、閏日、換日 22:59/23:00、子時跨日、DST 重複／跳時、經度與均時差、跨日期；至少 3 個時區獨立比對 |
| 時家 | 18 局、六旬、12 時支、中五例外、交節前後；至少 36 個來源全盤 fixture，核對九宮每欄，不只局數 |
| 刻家 | 第5節全部條件、至少30全盤 fixture；未驗證阻斷完整發布 |
| 性質測試 | 地盤九干不重複；八門八神各一次；星／天盤寄宮資料完整；同輸入 hash 一致；換人物不改基礎盤；不合法資料拒絕 |
| 分析 | 每規則正反例、衝突／未知、雙盤交集真值表、事件切換；未驗證規則不得出推薦 |
| 感測 | 北東南西與斜向、0/360、roll/pitch、交界、相對北、過期、鎖定／校正、真實設備磁干擾 |
| 時間 | live/preview/playing、拖動雙控同步、正反向、倍速、NOW、跨交節、背景恢復、快速取消、時區變更；動畫不改盤 hash |
| 相機 | 拒絕／中斷／恢復、背景 tracks=0、啟動競態、裁切與合成 JPEG、照片盤局時間一致 |
| UI | 360×640、375×667、390×844、橫式、iPad、桌面、左右／上下摺疊；無裁切、觸控區≥44px、safe area、鍵盤、減少動態 |
| 效能 | 代表性真機 live 與600×播放測 frame timings；不積壓動畫／worker；10分鐘持續使用無持續記憶體成長；記錄實測，不宣稱未測指標 |
| 離線 | 安裝後斷網重啟、全盤與匯出、SW 更新、資料保留、quota 錯誤 |
| 隱私 | 網路檢查無個資、照片、位置外送；獨立 scope、db 與母本互不影響 |

CI：`npm ci`、`npm test`、`npm run build`；瀏覽器腳本沿用 `test:layout/sensor/camera/sw`，新增 `test:qimen`、`test:timeflow`；對不同 TZ 環境跑單測。GitHub Actions 通過必要測試才部署。真機不可用時記錄未測，不以 DevTools 模擬冒充。正式發布需刻家／曆法／時家規則、實景及實機關卡通過；可先部署明示 preview 的開發版但不得假稱完整功能。

交付：新 repo 完整 source、lockfile、README、本文、`hour-rulebook-v1.md`、`ke-rulebook-v1.md`、`analysis-rulebook-v1.md`、`sources.md`、`decisions.md`、fixtures、CI、PWA icons、視覺基準圖（有提供才放入，標示非真盤）、測試／實機報告、已知限制、實際部署網址與 commit SHA。README 明示使用方法、時間基準、profile、資料隱私與限制。

施工順序：P0 母本審查及刻家來源研究；P1 曆法＋時家＋刻家純函式及 fixtures；P2 相機／方向／新視覺；P3 時光／動畫／雙盤；P4 分析／人物／紀錄；P5 PWA/RWD/效能/測試；P6 preview、真機驗收與正式發布。各階段保留可重現 commit；專業阻斷不妨礙其他模組施工，但必須阻止假資料進 production。

## 13. 研究來源與可信度

以下為本文件初步研究及比對入口，不是已完成驗證的程式庫，也不是對術數預測有效性的證據。Agent 必須保留原始文獻版本、授權、例盤與計算 trace。

- 母本：https://github.com/donma/BaziGFun/blob/main/README.md — 架構與已報告測試；不得把母本測試當新專案驗收。
- https://baihuamingli.com/qimen/chaibu/ — 拆補與交節例盤、古籍追溯、中五寄宮差異。
- https://zeshu.app/qimen.html — 時家定局、天地盤、值符值使及轉盤步驟參考。
- https://min.ckmu.co/qimen — 拆補、中五寄坤、曆法庫比對候選。
- https://qimen.yi958.com/qmdj/3095 — 多種刻家時間尺度與流派差異的二手綜述；周道十分钟候選，不足以獨立實作。
- https://qimen.yi958.com/qmff/2292 — 十二分鐘刻家資料；不能當十分鐘刻家規則。
- https://www.hko.gov.hk/tc/gts/time/calendar.htm — 官方曆法／節氣比對入口，施工確認涵蓋年份與精度。
- https://gml.noaa.gov/grad/solcalc/ — 均時差與太陽時參考，施工驗證公式、符號和有效範圍。
- https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent — 感測能力與限制。
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia — 相機權限與安全上下文。

本文件不聲稱刻家及格局演算法已通過驗證。規格完成不等於程式完成；99.95% 為先前需求訪談主觀估計，不是科學精確度或施工進度。
