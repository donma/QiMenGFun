# 來源與版本 ledger

| ID | 來源 | 版本／日期 | 用途 | 授權／備註 |
|---|---|---|---|---|
| SRC-01 | 施工規格 `qimengfun-pwa-spec-v1.md` | v1.0 / 2026-11-25 | 產品與 UI 決策 | 本 repo 內 `ai-guide/` |
| SRC-02 | BaziGFun 母本 https://github.com/donma/BaziGFun | commit `2e7cedb9a90fe62b3026646a56335ceb910c01ba` (2026-11-23) | compass/sensors/camera/PWA/測試腳本重用 | 未修改原 repo |
| SRC-03 | 白話命理〈奇門拆補法〉https://baihuamingli.com/qimen/chaibu/ | 2026-11-19 | 拆補規則、2026-01-05 16:23/16:24 錨點、UTC+8、子初換日、中五寄坤 | 電子整理 CC BY-SA 4.0；網站表面值為例，不代表已實跑 |
| SRC-04 | 白話命理排盤工具 https://baihuamingli.com/tools/qimen/ | 2026-11 版本（頁面擷取 2026-11-25） | 2024-12-25 12:00 陽四、2026-06-15 12:00 陽九、2026-07-15 12:00 陰五逐宮驗證 | 同上；陰遁神序與中五寄坤雙干由此確認 |
| SRC-05 | tyme4ts (6tail) https://github.com/6tail/tyme4ts | npm 1.5.6 | 24 節氣精確 UTC 時刻、lunar/干支參考 | MIT；鎖版於 package-lock.json |
| SRC-06 | NOAA Solar Calculator https://gml.noaa.gov/grad/solcalc/ | 公式版本：Standard | 均時差 EoT 與真太陽時 | 公有領域；公式於 `solarTime.ts` |
| SRC-07 | 《欽定古今圖書集成》〈二至還鄉圖〉電子轉錄 | 固定 oldid（見 SRC-03 頁面引用） | 局數歌 1-7-4 / 9-3-6 等 | 電子整理 CC BY-SA 4.0 |
| SRC-08 | 《奇門法竅》卷六〈遁甲論〉丁未交冬至例 | 殆知閣電子轉錄，原刊底本未標 | 拆補「拆」的分段語義 | 僅作規則閱讀，未提供西元時刻 |
| SRC-09 | 設計參考圖 `ai-guide/design-references/*` | 使用者提供 2026-11-25 | 視覺方向 | 圖中文字／局數／方位為概念示意，非演算法真值 |
| SRC-10 | zeshu.app/qimen.html、min.ckmu.co/qimen | 2026-11 初步研究入口 | 通用轉盤參考 | 未用於覆蓋 SRC-03/04 的具名規則 |
| SRC-11 | 周道十分钟刻家（二手綜述 https://qimen.yi958.com/qmdj/3095） | 2026-11 擷取 | 刻家候選研究 | 資料不足，未實作；見 ke-rulebook-v1.md |

## 節氣資料版本與差異記錄

- tyme4ts `SolarTerm.fromName(2026,'小寒').getJulianDay()` → 2026-01-05 16:23:10（北京鐘面 JDN）；換算真正 UTC = 08:23:10Z。
- SRC-03 明載「小寒在台灣時間下午 16:23:10 交節」，與上述完全一致（臺灣 UTC+8 == 北京 UTC+8）。
- 2026-01-05 16:23（整分）在交節前，採冬至；16:24 已交小寒。引擎行為與來源一致。
- 節氣誤差窗保守設 60 秒；接近交節時 UI 提示不確定。尚待與香港天文台等官方曆表正式量化比對。
