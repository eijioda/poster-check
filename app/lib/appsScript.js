// AIが考えた質問データから、本物のGoogleフォームを自動生成するApps Scriptを組み立てる。
// このスクリプトを script.google.com に貼って実行すると、ユーザーのGoogleアカウントに
// 「事前申込フォーム」と「事後アンケート」の2つが作られる（回答者はログイン不要で回答可）。

export function buildFormsAppsScript(registration, survey) {
  const data = JSON.stringify({ registration, survey }, null, 2);
  return `// ===== 南魚沼みらい塾 Googleフォーム自動作成スクリプト =====
// 【使い方】
// 1. https://script.google.com を開き「新しいプロジェクト」を作成
// 2. 最初から入っているコードを消し、このコードを全部貼り付けて保存（Ctrl/⌘+S）
// 3. 上部の関数一覧で「createForms」を選び「実行」ボタンを押す
// 4. 初回だけ「承認が必要」と出るので、自分のGoogleアカウントで許可する
// 5. 下部の「実行ログ」に、2つのフォームのURL（回答用・編集用）が表示される

const FORM_DATA = ${data};

function createForms() {
  const results = [];
  results.push(buildForm(FORM_DATA.registration));
  results.push(buildForm(FORM_DATA.survey));
  results.forEach(function (r) {
    Logger.log('■ ' + r.title);
    Logger.log('　回答用URL: ' + r.publishedUrl);
    Logger.log('　編集用URL: ' + r.editUrl);
    Logger.log('');
  });
  Logger.log('完成しました。回答用URLをQRコードや案内に使ってください。');
}

function buildForm(spec) {
  const form = FormApp.create(spec.title);
  if (spec.description) form.setDescription(spec.description);

  (spec.questions || []).forEach(function (q) {
    let item;
    switch (q.type) {
      case 'paragraph':
        item = form.addParagraphTextItem();
        break;
      case 'choice':
        item = form.addMultipleChoiceItem();
        if (q.options && q.options.length) item.setChoiceValues(q.options);
        break;
      case 'checkbox':
        item = form.addCheckboxItem();
        if (q.options && q.options.length) item.setChoiceValues(q.options);
        break;
      case 'scale':
        item = form.addScaleItem();
        item.setBounds(1, q.scaleMax || 5);
        if (q.scaleLabels) item.setLabels(q.scaleLabels[0], q.scaleLabels[1]);
        break;
      default:
        item = form.addTextItem();
    }
    item.setTitle(q.title || '');
    if (q.help) item.setHelpText(q.help);
    if (q.required && typeof item.setRequired === 'function') item.setRequired(true);
  });

  return {
    title: spec.title,
    publishedUrl: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
  };
}
`;
}
