"use client";

// 回答用URLのQRコードを表示し、PNG/SVGで保存できるようにする部品。
export default function QrBlock({ id }) {
  return (
    <div className="qr-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qr-img" src={`/api/survey/${id}/qr`} alt="回答用QRコード" width={160} height={160} />
      <div className="qr-side">
        <div className="qr-title">回答用QRコード</div>
        <p className="q-help">ポスターやチラシに貼れば、スマホで読み取ってそのまま回答できます。</p>
        <div className="qr-actions">
          <a className="secondary mini-copy" href={`/api/survey/${id}/qr?download=1`} download>
            PNGで保存
          </a>
          <a className="secondary mini-copy" href={`/api/survey/${id}/qr?format=svg&download=1`} download>
            印刷用SVGで保存
          </a>
        </div>
      </div>
    </div>
  );
}
