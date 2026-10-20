# 面接担当者別ページ — 実装仕様

## 基本原則
- 本番 `staff/mobile/index.html` は全店マスターとして維持する。
- 個人ページは共通UIの設定違いとし、マスター修正を全員に自動反映する。HTMLのコピーを増やさない。
- 店舗別フィルタはログインユーザーの認可情報に基づく。URLクエリだけで閲覧権限を決めない。
- 各担当者のログイン user_id と owner/president/ota の対応を管理者が確定するまで本番公開しない。

## 既存DBの確認結果 (2026-10-20)
- staff_interviews: shop, interview_date, interview_time は存在するが担当者ID列はない。
- staff_schedule_blocks: block_date, all_day, start_time, end_time は存在するが担当者ID列はない。
- staff_push_events: recipient_user_id は存在する。
- recruit_staff_profiles: user_id, display_name, role, stores は存在する。

## 実装上の必須作業
1. 担当者紐づけテーブルと面接担当者参照を追加し、既存面接データの扱いを定義する。
2. 対応不可設定を担当者ごとに分離し、面接登録の時間選択ロジックも同じ情報を参照させる。
3. RLSとサーバー側RPCで本人の担当店舗だけにアクセスを制限する。マスターは全店参照可能にする。
4. 既存マスターの表示・通知・音・テスト・面接シートを共通コンポーネント化する。
5. recruit-line の面接管理ボタンはログイン中の認証ユーザーから個人ページへルーティングする。
6. 通知イベントの recipient_user_id を担当者に正しく設定し、購読・配信を端末ごとにテストする。
7. 本番反映前にマスターと3担当者の4権限で回帰テストする。

## 未実施
- 個人ページ本体の公開
- DB変更 / RLS更新 / 通知配信変更
- ログインユーザーIDの3担当者への割当

これらが完了するまで既存マスターは変更しない。
