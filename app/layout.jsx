import "./globals.css";

export const metadata = {
  title: "ポスターチェックAI",
  description: "ポスター・チラシの修正箇所をAIがピックアップします",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
