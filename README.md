# ポスターチェックAI

ポスター・チラシ（PNG / JPG / PDF）をアップロードすると、南魚沼市イベント向けのチェックルールに従って修正箇所をAIがピックアップするWebアプリです。

## 使い方

1. `.env.local` を開き、OpenAIのAPIキーを記入する

   ```
   OPENAI_API_KEY=sk-...
   ```

2. 起動する

   ```
   cd poster-check
   npm install   # 初回のみ
   npm run dev
   ```

3. ブラウザで http://localhost:3000 を開く

## チェックルールの変更

画面右上の「チェックルールを編集」（http://localhost:3000/rules ）から、フォーム形式で追加・編集・削除できます。保存すると次のチェックからすぐ反映されます（コード修正・再起動は不要）。

## アンケート機能（Google不要）

ポスターをアップロードして「このポスターからアンケートを作成」を押すと、AIが「事前申込フォーム」と「事後アンケート」を作り、3つのリンクを発行します。Googleアカウントもログインも不要です。

- 回答用リンク `…/s/{id}` — 中高生などがこれを開いて回答（アカウント不要）
- 編集用リンク `…/s/{id}/edit` — このURLを知っている人なら誰でも質問を編集できる
- 集計リンク `…/s/{id}/results` — 回答数・質問別集計の表示、CSVダウンロード

各フォームには**回答用QRコード**も表示されます。PNG（配布用）と印刷用SVGで保存でき、ポスターやチラシに貼ればスマホで読み取ってそのまま回答できます。

## 本番公開（Vercel + Upstash Redis）

ローカルではアンケートを `data/surveys/` にファイル保存しますが、Vercel等ではファイルが消えるため、回答保存に Upstash Redis を使います。環境変数 `KV_REST_API_URL` / `KV_REST_API_TOKEN`（または `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`）があれば自動でRedis保存に切り替わります。

**手順:**

1. このフォルダをGitHubリポジトリにpush
2. [vercel.com](https://vercel.com) でGitHubアカウント連携し、このリポジトリをImport
3. Import時の「Environment Variables」に `OPENAI_API_KEY` を追加
4. デプロイ後、プロジェクトの **Storage** タブ →「Upstash for Redis」を Create/Connect（無料枠でOK）。接続すると `KV_REST_API_URL` などが自動で入ります
5. 再デプロイ（Redeploy）すれば、回答がRedisに保存される本番モードになります

> ローカルでRedisの動作を試したいときは、`.env.local` に `KV_REST_API_URL` と `KV_REST_API_TOKEN` を書けば同じ動作を確認できます。

## 構成

- `app/page.jsx` — メイン画面（アップロード・チェック結果・アンケート作成）
- `app/rules/page.jsx` — チェックルール編集フォーム
- `app/s/[id]/page.jsx` — アンケート回答ページ
- `app/s/[id]/edit/page.jsx` — アンケート編集ページ
- `app/s/[id]/results/page.jsx` — 集計・CSV
- `app/components/QrBlock.jsx` — 回答用QRコードの表示・保存
- `app/api/check/route.js` — ポスターチェック（サーバー側でOpenAI APIを呼ぶ）
- `app/api/survey/…` — アンケートの生成・取得・更新・回答・集計・QRコード
- `app/lib/rules.js` — チェックルールの読み書きとプロンプト組み立て
- `app/lib/survey.js` — 質問データの正規化
- `app/lib/surveyStore.js` — アンケート保存（ローカル=ファイル / 本番=Redis 自動切替）
- `rules.json` — チェックルール本体（フォームから編集されるデータ）
