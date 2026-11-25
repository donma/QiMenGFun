export interface OnboardingProps {
  onStart: () => void;
  onRequestCamera: () => void;
  onRequestSensor: () => void;
  cameraLabel: string;
  sensorLabel: string;
}

export function Onboarding({ onStart, onRequestCamera, onRequestSensor, cameraLabel, sensorLabel }: OnboardingProps) {
  return (
    <div className="onboarding">
      <div className="onboarding-card glass">
        <div className="brand-mark">QiMenGFun</div>
        <h1>奇門吉方</h1>
        <p className="lead">以实景方位呈現時家奇門盤局的傳統文化參考工具。所有資料只在本機處理，不上傳、不登入、無廣告。</p>
        <div className="onboard-items">
          <div className="onboard-item"><span className="onboard-icon">◉</span><div><b>实景相機（選用）</b><p>授權後可將盤面和真實環境疊合；拒絕時仍可使用純盤。</p><button className="btn" onClick={onRequestCamera}>{cameraLabel}</button></div></div>
          <div className="onboard-item"><span className="onboard-icon">🧭</span><div><b>方向感測（選用）</b><p>提供鏡頭朝向參考；iOS 需由手勢觸發。可稍後手動校正。</p><button className="btn" onClick={onRequestSensor}>{sensorLabel}</button></div></div>
          <div className="onboard-item"><span className="onboard-icon">◷</span><div><b>時間與離線</b><p>預設裝置當地標準鐘面時間；可選真太陽時與經度。安裝後可離線使用。</p></div></div>
        </div>
        <p className="disclaimer">本產品為傳統文化參考，非科學驗證的預測或物理能量量測；不承諾求財、健康、投資等結果。</p>
        <button className="btn primary wide" onClick={onStart}>開始使用（不需建立人物）</button>
      </div>
    </div>
  );
}
