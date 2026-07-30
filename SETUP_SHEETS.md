# スプレッドシート連携のセットアップ（mirai塾）

アンケートを作るたびに、mirai塾のGoogleスプレッドシートへ自動で2行（申込・アンケート）が追記されるようにします。Googleアカウントの認証キーは不要です。

## 手順

### 1. スプレッドシートとスクリプトを用意

1. 記録用のGoogleスプレッドシートを1つ作る（名前は「アンケート一覧」など）
2. 上部メニュー **拡張機能 → Apps Script** を開く
3. 最初のコードを消して、下のコードを貼り付けて保存

```javascript
// 任意の合言葉。Vercelの SHEETS_TOKEN と同じ文字列にすると、他人の書き込みを防げます。
const SECRET = '';

const HEADERS = ['記録日時', '種別', 'ワークショップ名', '実施日', '募集人数', '募集締切', '作成者名', '回答用URL', '編集用URL', '集計用URL'];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.token !== SECRET) return json({ ok: false, error: 'bad token' });
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    const now = new Date();
    (data.rows || []).forEach(function (r) {
      sheet.appendRow([
        now, r.種別 || '', r.ワークショップ名 || '', r.実施日 || '',
        r.募集人数 || '', r.募集締切 || '', r.作成者名 || '',
        r.回答url || '', r.編集url || '', r.集計url || '',
      ]);
    });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
```

### 2. ウェブアプリとして公開

1. 右上の **デプロイ → 新しいデプロイ**
2. 種類は **ウェブアプリ**
3. 「次のユーザーとして実行」= **自分**
4. 「アクセスできるユーザー」= **全員**
5. デプロイ → 表示される **ウェブアプリのURL**（`…/exec` で終わる）をコピー

### 3. VercelにURLを登録

1. Vercel → `poster-check` → Settings → Environment Variables
2. `SHEETS_WEBHOOK_URL` = コピーした `/exec` のURL（対象は Production）
3. （任意）`SHEETS_TOKEN` = 上のスクリプトの `SECRET` と同じ合言葉
4. Redeploy

以降、アンケートを作るたびにシートへ自動で行が増えます。`SHEETS_WEBHOOK_URL` が未設定の間は、この機能はスキップされ、他の機能は普通に使えます。
