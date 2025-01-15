const express = require("express");
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const favicon = require("serve-favicon");
// User定義
const { PORT, log4jsConfig } = require("./config.js");
const mysqlHandler = require("./handlers/mysql.js");
const oracleHandler = require("./handlers/oracle.js");
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
app.get("/direct/:userid/:password/:nextaddr/", (req, res) => login2(req, res));
app.get("/directerror/:userid", (req, res) => {
    const userid = req.params.userid;
    res.render("login.ejs", {err: "自動ログイン設定を確認してください", userid})
});

// 全メーカー出荷指示書TopPage (wh-index)
app.get("/wh", async (req, res, next) => {
    const d = new Date();
    const today = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
//    const today = "2024-07-15"; // デバッグ用
    res.redirect(`/wh/${today}`);
});

// 全メーカー出荷指示書概要 (index.ejs)
app.get("/wh/:today", async (req, res, next) => {
    const today = req.params.today;
    req.session.nextaddr = `/wh/${today}`;
    if (!loginCheck(req, res)) return;
    try {
        // 一覧表示
        const ygws = await mysqlHandler.getYGWdates();
        const kd8330 = await mysqlHandler.getKD8330overview(today);
        for (let row of kd8330) {
            row.CNT = await mysqlHandler.getKD8330count(row.TKCD, row.SHIPDT, row.XLSSN);
        }
        res.render("index.ejs", {req, today, ygws, kd8330});
    } catch (err) {
        next(err);
    }
});

// 出荷指示書明細 (delivery.ejs)
app.get("/wh/delivery/:tkcd/:shipdt/:xlssn/:disp", async (req, res, next) => {
    const tkcd = req.params.tkcd;
    const shipdt = req.params.shipdt;
    const xlssn = req.params.xlssn;
    const disp = req.params.disp;
    req.session.nextaddr = `/wh/delivery/${tkcd}/${shipdt}/${xlssn}/${disp}`;
    if (!loginCheck(req, res)) return;
    Promise.all([
        mysqlHandler.getTKRNM(tkcd), 
        mysqlHandler.getKD8330Pages(tkcd), 
        mysqlHandler.getKD8330ttlcount(tkcd, shipdt, xlssn),
        mysqlHandler.getKD8330count(tkcd, shipdt, xlssn)])
    .then( async ([tkrnm, pages, ttl, cnt]) => {
        const kd8330 = await mysqlHandler.getKD8330detail(tkcd, shipdt, xlssn, disp);
        res.render("delivery.ejs", {req, tkcd, tkrnm, shipdt, xlssn, disp, pages, kd8330, ttl, cnt});
    }).catch((err) => {
        next(err);
    });
});

// [Oracle] 品目手順マスタと工程ごとの在庫数を取得する API
app.get("/wh/m0510zai/:hmcd", async (req, res, next) => {
    try {
        const hmcd = req.params.hmcd;
        const m0510zai = await oracleHandler.getM0510zai(hmcd);
        const m0500zai = await oracleHandler.getM0500zai(hmcd);
        m0510zai[0].HMNM = m0500zai.HMNM;
        // 実績あり最終工程の在庫数が０だった場合、在庫Fのnull工程の在庫数をセットし直す
        for (let i = 0; i < m0510zai.length; i++) {
            if (m0510zai[i].JIKBN == "1") {
                if (m0510zai[i].ZAIQTY == 0 && m0500zai.ZAIQTY != 0) {
                    m0510zai[i].ZAIQTY = m0500zai.ZAIQTY;
                    m0510zai[i].UPDTDT = m0500zai.UPDTDT;
                }
                break;
            }
        };
        // SV在庫があればSV在庫数をセットし直す
        if (m0500zai.SVQTY != 0) {
            m0510zai[0].SVQTY = m0500zai.SVQTY;
        }
        res.status(200).json(m0510zai);
    } catch (err) {
        next(err);
    }
});

// ステータス更新処理API
app.get("/wh/status/:autono/:sts", async function (req, res, next) {
    const autono = req.params.autono;
    const sts = req.params.sts;
    try {
        await mysqlHandler.updateKD8330status(autono, sts);
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

// iPhone専用Page (リーダー用)
// tkcd = C0105:クボタ枚方
app.get("/i/:tkcd", async (req, res, next) => {
    const d = new Date();
    const today = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    try {
        // 一覧表示
        const tkcd = req.params.tkcd.toUpperCase();
        const kd8330 = await mysqlHandler.getKD8220iPhone(today, tkcd);
        res.render("iphone.ejs", {req, today, kd8330});
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
    server.listen(PORT, () => {console.log(`Koken Delivery APP listen on Port:${PORT}`)});
}).catch((err) => {
    console.log("MySQL Database Connection Error!");
    console.log(err);
});
