# Claude Code Action RPG - Project Goals

## 言語設定
ユーザーの母国語は日本語です。会話は常に日本語で行ってください。

## プロジェクト概要
楽しいトップダウン2Dアクションリアルタイム戦闘RPGをブラウザで動かす。
GitHub Pages (github.io) でプレイできるようにする。
**スマートフォンでの快適なプレイを最優先に設計する。**

## 技術スタック
- **ゲームエンジン**: PixiJS
- **ビルドツール**: Vite
- **言語**: TypeScript
- **ビルド出力**: `docs/` ディレクトリ（GitHub Pages用）

## ゲームデザイン

### 視点・操作
- トップダウン（2D俯瞰視点）
- **スマホ**: 画面内の仮想パッド・ボタンで操作（タッチ対応）
  - 左側: バーチャルジョイスティック（移動）
  - 右側: 攻撃ボタン / スキルボタン
- **PC**: キーボード（WASD / 矢印キー）で移動、スペース/クリックで攻撃

### スマホ最適化
- viewport meta タグで拡大縮小を無効化
- タッチイベント（touchstart / touchmove / touchend）を適切に処理
- ゲーム画面を画面サイズに合わせてリサイズ（レスポンシブ対応）
- UIボタンは指で押しやすいサイズ（最低44x44px）
- ダブルタップズーム・スクロール等のデフォルト動作を無効化
- iOS Safari / Android Chrome での動作確認を意識

### マップ・探索
- スクロール可能なワールド（複数エリア構成）
- 草原・ダンジョン・城など複数のエリアタイプ
- エリア間の移動（ドア・通路など）

### 戦闘システム
- リアルタイムアクション戦闘
- 敵を倒すと経験値＆アイテムドロップ
- ボスは特殊な攻撃パターンを持つ（HP半分で形態変化など）

### 成長要素
- レベルアップによるステータス強化
- 装備収集（武器・防具）

### ゴール
- マップのどこかにいるボスを倒す
- ボス部屋では専用演出（HPバー・BGM変化など）

## BGM（バックグラウンドミュージック）

すべて **CC0 / 無料** ライセンスのトラック。OpenGameArt.org から取得。

| シーン | トラック名 | ライセンス | URL |
|--------|-----------|-----------|-----|
| フィールド探索 | JRPG Pack 1 Exploration（"Grasslands" など） | CC0 | https://opengameart.org/content/jrpg-pack-1-exploration |
| ボス戦 | Intense Boss Battle | CC0 | https://opengameart.org/comment/111766 |
| ボス戦（サブ候補） | Zelda Style 8-bit Boss Theme | CC0 | https://opengameart.org/content/zelda-style-8-bit-boss-theme |

> 実装時は OGG 形式を優先し、fallback として MP3 を使用する（ブラウザ互換性のため）。

## ディレクトリ構成（予定）
```
/
├── src/
│   ├── main.ts          # エントリーポイント
│   ├── game/            # ゲームロジック
│   │   ├── scenes/      # シーン管理
│   │   ├── entities/    # プレイヤー・敵・ボス
│   │   ├── maps/        # マップ・エリア
│   │   └── systems/     # 戦闘・経験値などのシステム
│   ├── ui/              # 仮想パッド・HUD など
│   └── assets/
│       ├── images/
│       └── audio/       # BGM（ogg / mp3）
├── docs/                # Viteビルド出力（GitHub Pages）
├── vite.config.ts
└── package.json
```

## 開発方針
- コードはシンプルに保つ（過剰な抽象化を避ける）
- PixiJS の機能を最大限活用する
- GitHub Pages で動作することを常に意識する（相対パス、静的ファイルのみ）
- **スマホファースト**: 先にスマホで動作確認してからPCを調整する
