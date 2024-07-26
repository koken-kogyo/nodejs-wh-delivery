# 物流出荷指示書表示システム  
- [KMD013JW] 40.nodejs-wh-delivery  

## 概要  
- 物流出荷指示書表示システム  

## 開発環境  
- Node.js v18.17.1  
- MySQL 8.0.32  
- nvm-windows 1.1.10  

## npmパッケージ
- body-parser@1.20.2                            # Expressミドルウェア  
- csv-stringify@6.5.0                           # CSVファイルの作成  
- ejs@3.1.10  
- express-session@1.18.0  
- express@4.19.2  
- iconv-lite@0.6.3                              # CSVファイルを [Shift_JIS] に変換  
- log4js@6.9.1  
- mysql2@3.10.3  
- nodemailer@6.9.14  
- serve-favicon@2.5.0  

## メンバー  
- y.watanabe  

## プロジェクト構成  
~~~
./
│  .gitignore                                  # ソース管理除外対象
│  config.js                                   # webアプリケーション設定ファイル (git対象外)
│  package.json                                # パッケージ管理ファイル
│  README.md                                   # このファイル
│  server.js                                   # メインとなるサーバー起動ファイル
│  
├─ handler                                    # ☆サーバー側で使用するハンドラー群
│          mysql.js                            # MySQL関連のハンドラー
│          server.js                           # サーバー側関連のハンドラー
│  
├─ public                                     # ☆クライアントに公開するモジュール群
│  ├─ css
│  │      style-basic.css                     # 共通で使用するスタイルシート
│  │      style-index.css                     # メインのスタイルシート
│  │
│  ├─ downloads                              # クライアントに提供するファイル群
│  │
│  ├─ imsges                                 # クライアントに提供するファイル群
│  │
│  └─ javascripts                            # 
│          _myfunctions.js                     # 各ページ共通で使用するjs  
│          JsBarcode.all.min.js                # １次元バーコードを表示するjs  
│          qrcode.js                           # QRコードを表示するjs  
│  
├─ views                                      # ☆EJSテンプレートエンジン群
│          _footer.ejs                         # フッター
│          _header.ejs                         # ヘッダー
│          _myfunctions.ejs                    # ejs用の自作関数
│          index.ejs                           # 洩れ検査日報TopPage
│          iphone.ejs                          # 洩れ検査日報携帯Page
│          login.ejs                           # ログイン画面
│          search.ejs                          # 日報検索画面
│  
└─ specification
        [KMD013JW] xxx 機能仕様書_Ver.1.0.0.0.xlsx
    
~~~

## データベース  

| Table    | Name                      |  
| :------: | :------------------------ |  
| kd8330   | 物流出荷指示書ファイル    |  

## アセンブリ情報  

- 著作権： © 2024 koken-kogyo CO,LTD.

