import type { PhotoRecordMeta } from '../storage/storage';
import { exportZip, exportSinglePhotoJpeg, shareOrDownload } from '../export/exporter';
import { PALACES } from '../domain/qimen/tables';

export interface RecordsPanelProps {
  records: PhotoRecordMeta[];
  urls: Map<string, string>;
  onView: (r: PhotoRecordMeta) => void;
  onDelete: (r: PhotoRecordMeta) => void;
  onToast: (msg: string) => void;
}

export function RecordsPanel({ records, urls, onView, onDelete, onToast }: RecordsPanelProps) {
  if (!records.length) {
    return <div className="panel-scroll"><section className="panel-section glass empty-state">
      <h2>紀錄</h2>
      <p className="hint">尚無紀錄。在羅盤頁拍攝照片，會同時保存實際畫面裁切、盤局與時間資訊。</p>
    </section></div>;
  }
  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>紀錄（{records.length}）</h2>
        <div className="record-list">
          {records.map((r) => (
            <article className="record-card" key={r.id}>
              {r.photoId && urls.get(r.photoId) && <img src={urls.get(r.photoId)} alt={r.title} loading="lazy" />}
              <div className="record-body">
                <b>{r.title || '未命名紀錄'}</b>
                <div className="record-meta">{new Date(r.chartInstant).toLocaleString('zh-Hant')} · {r.basis === 'civil' ? '民用時' : '真太陽時'}</div>
                <div className="record-meta">{r.chart ? `${r.chart.term} · ${r.chart.dun === 'yang' ? '陽遁' : '陰遁'}${r.chart.ju}局 · ${PALACES.find((p) => p.id === Number(r.headingDisplay))?.short ?? ''}` : '無盤局快照'}</div>
                <div className="record-meta">方位 {r.headingDisplay === null ? '未知' : `${r.headingDisplay.toFixed(1)}°`} · 品質 {r.quality} {r.nearBoundary ? '· 近交界' : ''}</div>
                {r.note && <p className="record-note">{r.note}</p>}
                <div className="record-actions">
                  <button className="mini-btn" onClick={() => onView(r)}>查看</button>
                  <button className="mini-btn" onClick={async () => {
                    if (r.photoId) {
                      const res = await exportSinglePhotoJpeg(r.photoId);
                      if (res) await shareOrDownload(res.filename, res.blob);
                    } else onToast('此紀錄沒有照片');
                  }}>分享</button>
                  <button className="mini-btn danger" onClick={() => onDelete(r)}>刪除</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel-section glass">
        <h2>匯出</h2>
        <p className="hint">ZIP 包含 qimengfun-data.json 與 photos/&lt;uuid&gt;.jpg；JSON 不內嵌 base64。資料僅本機，可能因系統清除遺失，請定期匯出。第一版無匯入／還原。</p>
        <button className="btn primary" onClick={async () => {
          const res = await exportZip();
          await shareOrDownload(res.filename, res.blob);
          onToast('已匯出');
        }}>匯出全部（ZIP）</button>
      </section>
    </div>
  );
}
