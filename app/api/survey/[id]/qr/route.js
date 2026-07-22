import QRCode from "qrcode";
import { getSurvey } from "../../../../lib/surveyStore";

export const runtime = "nodejs";

// 回答用URLのQRコードを返す。
//   /api/survey/{id}/qr            → PNG（ブラウザ表示用）
//   /api/survey/{id}/qr?download=1 → PNG（ダウンロード）
//   /api/survey/{id}/qr?format=svg → SVG（印刷用の高画質）
export async function GET(request, { params }) {
  const { id } = await params;
  const survey = await getSurvey(id);
  if (!survey) {
    return Response.json({ error: "アンケートが見つかりません。" }, { status: 404 });
  }

  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("host") || url.host;
  const respondUrl = `${proto}://${host}/s/${id}`;

  const format = url.searchParams.get("format");
  const download = url.searchParams.get("download");

  try {
    if (format === "svg") {
      const svg = await QRCode.toString(respondUrl, {
        type: "svg",
        margin: 2,
        width: 512,
      });
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          ...(download
            ? { "Content-Disposition": `attachment; filename="qr-${id}.svg"` }
            : {}),
        },
      });
    }

    const buffer = await QRCode.toBuffer(respondUrl, {
      type: "png",
      margin: 2,
      width: 512,
      errorCorrectionLevel: "M",
    });
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        ...(download ? { "Content-Disposition": `attachment; filename="qr-${id}.png"` } : {}),
      },
    });
  } catch {
    return Response.json({ error: "QRコードの生成に失敗しました。" }, { status: 500 });
  }
}
