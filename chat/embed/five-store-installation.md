# 5店舗｜お客様用チャットボタン共通仕様（2026-11-09）

確定仕様：通知バッジ（赤丸数字）を右上に固定。スマホ版右余白30px、バッジ位置 top:-12px/right:-13px。各店同じ余白・大きさ。店名・店舗カラー・未読件数・トークンは店舗別。

## 外部HP設置（EXA管理会社対応が必要）
公式ホームページ共通フッターの </body> 直前に対象店舗の1行を追加。別店舗のタグと混在させない。HTTPSページ上でのみ使用。

- Grand Luxe (`grandluxe-osaka.com`)
  `<script defer src="https://officialendstaff.github.io/therapist-profile/chat/embed/grand-luxe.js"></script>`
- LUXY OSAKA (`luxy-spa.com`)
  `<script defer src="https://officialendstaff.github.io/therapist-profile/chat/embed/luxy-osaka.js"></script>`
- Un Secret (`unsecret-osaka.com`)
  `<script defer src="https://officialendstaff.github.io/therapist-profile/chat/embed/un-secret.js"></script>`
- 薔薇と紳士 (`rose-gentleman.com`)
  `<script defer src="https://officialendstaff.github.io/therapist-profile/chat/embed/rose.js"></script>`
- BUSTY OSAKA (`busty-osaka.com`)
  `<script defer src="https://officialendstaff.github.io/therapist-profile/chat/embed/busty-osaka.js"></script>`

## 公開フラグ
各店舗 `chat/embed/<slug>-state.js` の `enabled:false` は初期OFF。プレビューでは `data-preview="1"` でON扱い。
**本番HPへのタグ設置と送受信テストが完了し、公開承認があるまでOFFのまま維持すること。**
各店ごとのプレフィックス付き localStorage キーで訪問者を分離。
Web側CSPは `script-src` と `frame-src` に `https://officialendstaff.github.io` を限定許可。既存ポリシーを無差別に緩めない。

## GitHub上で確認できるプレビュー
- /therapist-profile/chat/embed/rose-preview.html
- /therapist-profile/chat/embed/grand-luxe-preview.html
- /therapist-profile/chat/embed/luxy-osaka-preview.html
- /therapist-profile/chat/embed/un-secret-preview.html
- /therapist-profile/chat/embed/busty-osaka-preview.html

## 制限
実HPのソースはこのGitHubリポジトリの外。設置・公開確認は未実施。GitHub上のプレビューでの表示は実サイトの設置を意味しない。
