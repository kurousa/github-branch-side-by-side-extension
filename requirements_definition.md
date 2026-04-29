# 要件定義書: GitHub Branch Side-by-Side

Chromeのサイドパネル機能を活用し、GitHubのファイル閲覧画面から「別ブランチの同名ファイル」を即座に横並びで比較するためのChrome拡張機能。

---

## 1. 開発の目的
GitHub標準のUIでは、別ブランチのファイルを確認するために画面遷移が必要であり、現在のコードとのコンテキストが途切れてしまう。本拡張機能は、**「現在のファイルを閉じることなく、サイドパネルに別ブランチの同ファイルを展開する」**ことで、直感的なオンデマンド比較を実現する。

## 2. ターゲット画面
- **対象URL:** `https://github.com/[owner]/[repo]/blob/[branch_or_commit]/[file_path]`
- **動作条件:** GitHubのリポジトリ内、ファイル詳細画面（Blobビュー）を表示している時のみ有効化。

## 3. 機能要件

### MVP (Minimum Viable Product)
1. **URL解析機能**
   - 現在のタブのURLから `owner`, `repo`, `branch`, `file_path` を抽出する。
2. **比較先入力UI**
   - ポップアップにて、比較対象となるブランチ名（またはコミットハッシュ）を入力・指定できる。
3. **サイドパネル連携**
   - Chrome `sidePanel` APIを使用。
   - `blob/[current_branch]/` を `blob/[target_branch]/` に置換したURLを生成し、サイドパネルに表示する。
4. **表示モード**
   - サイドパネル内でもGitHub標準のFiles画面を表示。特別なオーバーレイや差分抽出エンジンは実装せず、ブラウザの分割表示機能を活用する。

### 発展機能 (Phase 2: API連携)
1. **GitHub PAT (Personal Access Token) 対応**
   - ユーザーが自身のPATを設定できる「BYOK（Bring Your Own Key）」方式を採用。
   - `chrome.storage.local` を使用してトークンを安全に保存。
2. **ブランチ一覧の自動取得**
   - GitHub REST API (`GET /repos/{owner}/{repo}/branches`) を使用。
   - 入力の手間を省くため、比較先をプルダウン形式で選択可能にする。
3. **ファイル実在確認**
   - 比較先ブランチに同名ファイルが存在するか事前に確認し、存在しない場合はリポジトリルートを表示する等のフォールバックを行う。

## 4. 非機能要件
- **シンプル設計:** リッチな差分表示機能はGitHub標準機能に任せ、本ツールは「並べて表示する枠組み」の提供に徹する。
- **パフォーマンス:** ポップアップ起動時の解析を高速化し、APIレスポンスの適切なキャッシュ管理を行う。
- **セキュリティ:** PATは `repo` スコープのみを要求し、外部サーバー等への送信は一切行わない。

## 5. 技術スタック（推奨）
- **Manifest Version:** 3
- **Permissions:** `sidePanel`, `tabs`, `activeTab`, `storage`
- **Host Permissions:** `https://github.com/*`
