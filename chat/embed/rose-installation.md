# 薔薇と紳士｜HP内チャット 仮設置・確認・一時撤去・再設置
最終更新: 2026-11-07

## 前提・確認状態
- 対象: https://rose-gentleman.com/top.php および18歳確認通過後の公開ページ
- 表示方法: 画面右下の固定ボタンを押すと、HP内のチャットウィンドウが開く（別ページ遷移なし）
- 管理会社: EXA提供会社（公式HPソースへのアクセス権限はこのGitHubリポジトリ側にない）
- 現時点: ウィジェット・テスト用ページ・表示スイッチはGitHub側に実装済み。**実サイト側の埋め込みは未確認／未実施**
- 公開表示スイッチは初期OFF。仮設置前にONにしない。

## EXA管理会社に依頼する埋め込みタグ
HPの18歳確認通過後の全ページに共通する `</body>` 直前（共通フッターなど）に、下記**1行のみ**を追加:

```html
<script defer src="https://officialendstaff.github.io/therapist-profile/chat/embed/rose.js"></script>
```

このタグだけでボタン・ウィンドウ・閉じる操作を生成する。別のiframeやリンクは不要。

※HPのContent Security Policyが外部スクリプトやiframeを制限している場合は、HP管理側で次のオリジンを許可する必要がある：
- `script-src` : `https://officialendstaff.github.io`
- `frame-src` : `https://officialendstaff.github.io`

セキュリティ設定を無差別に緩和しないこと。既存のLINE・電話・ページ構成は変えない。

## 確認用URL
- HP埋め込みプレビュー: https://officialendstaff.github.io/therapist-profile/chat/embed/rose-preview.html
- スタッフ用チャット管理: https://officialendstaff.github.io/therapist-profile/staff/booking-chat/rose-push-v1.html
- 実際のHP: https://rose-gentleman.com/top.php

## 進行順
1. **HP仮設置**: EXAにタグを追加してもらう。初期状態はOFFのため公開客には表示されない。
2. **限定テスト開始**: https://officialendstaff.github.io/therapist-profile/chat/embed/rose-state.js の `enabled:false` を `enabled:true` に変更して公開。表示は45秒以内の再取得で切り替わる設計（ブラウザ・キャッシュや通信状況により遅延の可能性）。
3. **チャット画面とスタッフ画面の構成確認**: PC・スマホ表示、既存UIとの重なり、開閉、顧客側履歴、店舗名・色・返信欄を確認。
4. **双方向送受信・通知テスト**: HPから送信→スタッフ用一覧→スタッフ返信→HP内ウィンドウへ反映。スタッフ端末が通知登録済みなら新着プッシュも実機確認。
5. **HP表示の一時停止**: `enabled:false` に戻す。ウィジェットはHPから非表示となる。タグ自体を撤去する必要がある場合はEXAに削除依頼。
6. **社長確認**: 画面・動線・通知・運用ルールを確認。承認前は公開ONにしない。
7. **再設置**: 承認後にタグの存在を確認し、`enabled:true` に変更。実HP上で再テスト。

## 合格条件
- 公式HPの各主要ページで固定ボタンが視認でき、邪魔な重なりや位置ズレがない
- 同一HP内でチャットを開閉でき、別ページへ移動しない
- 顧客からの送信が指定店舗のスタッフ管理に入り、返信がHP内で確認できる
- 再表示時に同じブラウザで履歴が継続する（サイトデータ消去・別端末は除外）
- 顧客向けの実際の個人情報は通知に表示しない
- 一時停止後、HPにチャットボタン・ウィンドウが表示されない
- 社長確認後、同じタグで再表示できる

## 制限事項
- 埋め込み先ドメインは `rose-gentleman.com` / `www.rose-gentleman.com` のみ（プレビュー用にGithub Pagesオリジンも許可）
- テスト用プレビューは本番HPそのものではない。実サイトでのCSP・ポップアップとの競合は、タグ設置後に確認が必要
- ブラウザ・ネットワーク・キャッシュ・サーバーの状態により、チャットおよび通知の到達を保証するものではない
