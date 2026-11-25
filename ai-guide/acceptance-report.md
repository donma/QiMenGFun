# 驗收報告（v0.1.0-preview）

日期：2026-11-25。所有結果均為本機 / 無頭瀏覽器實測；**未宣稱任何未執行的真機測試**。

## 已通過

| 關卡 | 結果 |
|---|---|
| 單元測試 `npm test` | 27/27 通過（歷法、時家、完整盤、分析、時間控制、刻家阻斷） |
| 型別與建置 `npm run build` | 通過；`tsc -b` strict + Vite build + SW precache 15 entries / 712 KiB |
| RWD `npm run test:layout` | 6 種尺寸（360×640、375×667、390×844、844×390、820×1180、1280×800）全部：盤面在視窗內、console 0 錯誤、直式與平板/桌面 0 溢出（橫式 1 項 SVG 透視 subpixel 警告） |
| 感測 `npm run test:sensor` | 8/8 方位（北／東北／東／東南／南／西南／西／西北）讀數誤差 0°，無 pageerror（合成 orientation 事件，非真機） |
| 相機 `npm run test:camera` | 假相機 960×540 播放中；拍照後 IndexedDB 1 record + 1 photo，JPEG magic `FF D8 FF` 正確，`keStatus=unverified`，無錯誤 |
| SW `npm run test:sw` | dist/sw.js 含 skipWaiting/clientsClaim；manifest scope `/QiMenGFun/`、theme color、app shell 與字型皆 precache |
| 節氣 | 小寒 2026 交節瞬間 08:23:10Z 與來源一致；24 節氣邊界由 tyme4ts 1.5.6 產生 |
| 干支 | JDN 錨點 1949-10-01 甲子、2000-01-01 戊午；2026-01-05 己卯；子初 23:00 換日；DST 重複／不存在時間正確判定；三時區 offset |
| 時家 | 5 組來源盤（1/2/4/9/5 局，含陰遁、中五寄坤雙干、時干入中、值使落坤二）；3 組逐宮完整比對；地盤九干不重複、八門八神各一次、同輸入 hash 一致 |
| 刻家 | 正式排盤正確回傳 `unverified`；12 刻索引完整覆蓋 |
| 分析 | 基礎象意規則、未驗證規則列為不支援、雙盤交集真值規則實作（因刻家阻斷不實際出結果） |
| PWA | manifest / icons 192/512/maskable / theme color / SW precache / scope 與母本獨立 |

## 未通過 / 未完成（不得標記 v1 正式完成）

- **刻家**：來源研究不足，30 全盤 fixture 關卡未達；發布阻斷維持。
- **時家 fixture 數量**：目前 5 組（其中 3 組逐宮），距離 36 組來源全盤、18 局全覆盖仍有差距。
- **節氣精度**：尚未與官方曆表（HKO 等）做正式量化誤差比對；目前以来源時間戳一致作初步錨定。
- **真機**：iOS Safari/Chrome/PWA 的 `webkitCompassHeading`、Android absolute/relative orientation、實際相機與摺疊装置皆未實機驗收；無頭瀏覽器模擬不能替代。
- **相機生命週期**：基本啟動／拍照／JPEG／IndexedDB 已通過無頭假相機；背景恢復、串流中斷、啟動競態尚未完整驗收。
- **效能**：未做代表性真機 10 分鐘 frame timing / 記憶體成長量測。
- **離線更新**：SW 基本要求已通過；新版接管與真正離線重重启尚未實測。

## 結論

可部署為**明示 preview** 的開發版。時家時盤可作為傳統文化參考；刻家與進階格局不提供結果。正式 v1 需先解除上述專業與實机关卡。
