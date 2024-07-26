const express = require("express");
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const favicon = require("serve-favicon");
// User定義
const { PORT, log4jsConfig } = require("./config.js");
const mysqlHandler = require("./handlers/mysql.js");
const userid = "";
const { login, login2, loginCheck, csvwrite, sendMail, myOS } = require("./handlers/server.js");
// log4jsロガー設定
const log4js = require("log4js");
log4js.configure(log4jsConfig);

// Expressインスタンスを生成
const app = express();

const fs = require("fs");
const https = require("https");
const options = {
  key:  fs.readFileSync("./servercert/server.key"),
  cert: fs.readFileSync("./servercert/server.crt")
};
const server = https.createServer(options,app);

// テンプレートエンジンの設定
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ミドルウエアの設定
app.use(session({ secret: "YOUR SECRET SALT", resave: true, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/static", express.static("./public"));
app.use(favicon(`${__dirname}/public/images/favicon.ico`));

// Top Page
app.get( "/", (req, res) => res.redirect(`https://${req.hostname}/`));

// ユーザー認証
app.get( "/login", (req, res) => res.render("login.ejs", {err: "", userid}));
app.post("/login", (req, res) => login(req, res));
app.get("/logout", (req, res) => req.session.destroy(() => res.redirect(`https://${req.hostname}/`)));
app.get("/direct/:userid/:password/:nextaddr/:odcd", (req, res) => login2(req, res));
app.get("/directerror/:userid", (req, res) => {
    const userid = req.params.userid;
    res.render("login.ejs", {err: "自動ログイン設定を確認してください", userid})
});

// 全メーカー出荷指示書TopPage (wh-index)
app.get("/wh", async (req, res, next) => {
    const d = new Date();
//    const planday = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    const planday = "2024-07-15"; // デバッグ用
    res.redirect(`/wh/${planday}`);
});

// 全メーカー出荷指示書概要 (index.ejs)
app.get("/wh/:planday", async (req, res, next) => {
    const planday = req.params.planday;
    req.session.nextaddr = `/wh/${planday}`;
    if (!loginCheck(req, res)) return;
    try {
        // 一覧表示
        const kd8330 = await mysqlHandler.getKD8330overview(planday);
        res.render("index.ejs", {req, planday, kd8330});
    } catch (err) {
        next(err);
    }
});

// 出荷指示書明細 (delivery.ejs)
app.get("/wh/delivery/:planday/:tkcd/:xlssn/:disp", async (req, res, next) => {
    const planday = req.params.planday;
    const tkcd = req.params.tkcd;
    const xlssn = req.params.xlssn;
    const disp = req.params.disp;
    req.session.nextaddr = `/wh/delivery/${planday}/${tkcd}/${xlssn}/${disp}`;
    if (!loginCheck(req, res)) return;
    try {
        // 一覧表示
        const kd8330 = await mysqlHandler.getKD8330detail(planday, tkcd, xlssn, disp);
        res.render("delivery.ejs", {req, planday, kd8330, disp});
    } catch (err) {
        next(err);
    }
});

// iPhone専用Page (リーダー用)
// tkcd = C0105:クボタ枚方
app.get("/i/:tkcd", async (req, res, next) => {
    const d = new Date();
    const planday = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    try {
        // 一覧表示
        const tkcd = req.params.tkcd.toUpperCase();
        const kd8330 = await mysqlHandler.getKD8220iPhone(planday, tkcd);
        res.render("iphone.ejs", {req, planday, kd8330});
    } catch (err) {
        next(err);
    }
});

// 洩れ検査日報データ検索画面
app.get("/essearch", async function (req, res, next) {
    try {
        const kd8220dic = await mysqlHandler.getKD8220dic();
        res.render("search.ejs", {req, kd8220dic});
    } catch (err) {
        next(err);
    }
});

// 洩れ検査日報データ取得 API
app.get("/es/search/:hmcd", async function (req, res, next) {
    try {
        const hmcd = req.params.hmcd;
        const kd8220hmcd = await mysqlHandler.getKD8220hmcd(hmcd);
        res.status(200).json(kd8220hmcd);
    } catch (err) {
        next(err);
    }
});

// 包括的エラーハンドリング
app.use((err, req, res, next) => {
    console.log("包括的エラーハンドリング")
    console.error(err);
    res.status(500).send(`サーバーの動作が失敗しました．:${err.code} `);
});

// データベース接続した後にサーバーを起動
mysqlHandler.connect
.then(() => {
    console.log(`MySQL Database [${mysqlHandler.database}] Connected!`);
    server.listen(PORT, () => {console.log(`Koken APP listen on Port:${PORT}`)});
}).catch((err) => {
    console.log("MySQL Database Connection Error!");
    console.log(err);
});
