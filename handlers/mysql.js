const mysql = require('mysql2/promise');
const { mysqlConfig } = require('../config.js');

// MySQL接続情報
const connectionString = {
      host: mysqlConfig.HOST
    , port: mysqlConfig.PORT
    , database: mysqlConfig.DATABASE
    , user: mysqlConfig.USER
    , password: mysqlConfig.PASSWORD
    , dateStrings: 'date' /*または'true'*/
};
exports.database = connectionString.database;

// コネクションプールの取得
const pool = mysql.createPool(connectionString);
const connect = pool.getConnection()
exports.connect = connect;


// Database から データを取得する
const getDatabase = async (sql, param) => {
    const conn = await pool.getConnection();
    const results = await conn.query(sql, param);
    conn.release();
    return JSON.parse(JSON.stringify(results[0]));;
};

// ユーザー情報の取得
const getM0010 = async (userid) => {
    const sql = "select TANNM, PASSWD from m0010 where TANCD=?"
    return getDatabase(sql, [userid]);
};
exports.getM0010 = getM0010;

// 今週月曜日から来週金曜日までの営業日を取得
const getYMDs = async () => {
    const sql = 
        "select YMD from (select DATE_FORMAT(YMD,'%Y-%m-%d') 'YMD' from s0820 where CALTYP='00001' and WKKBN='1' and YMD between " +
        "(CURRENT_DATE - interval WEEKDAY(CURRENT_DATE) day) " + 
        "and " + 
        "(CURRENT_DATE - interval WEEKDAY(CURRENT_DATE) day + interval 30 day)) T limit 10"
    const ymdobj = await getDatabase(sql, []);
    const ymd = [];
    for (let row of ymdobj) {ymd.push(row.YMD)};
    return ymd;
};
exports.getYMDs = getYMDs;

// 炉中洩れ検査日報取得
exports.getKD8220 = async (date, odcd, disp) => {
    const odcdlike = odcd + "%";
    let orderby = "";
    switch(disp){
        case "1":
            orderby = "order by a.INSTDT asc";
            break;
        case "2":
            orderby = "order by a.INSTDT desc";
            break;
        case "3":
            orderby = "order by a.HMCD asc";
            break;
        case "4":
            orderby = "order by a.HMCD desc";
            break;
        case "5":
            orderby = "order by a.OPERATOR asc";
            break;
        case "6":
            orderby = "order by a.OPERATOR desc";
            break;                         
    }
    const kd8220 = await getDatabase(
        "select a.*, ifnull(b.TKRNM, '-') as 'TKRNM', NAME as 'OPNAME' " + 
        "from kd8220 a left outer join m0200 b on a.TKCD=b.TKCD, km0010 c " +
        "where a.OPERATOR=c.EMPNO and ENTRYDT=? and ODCD like ? " + orderby
        , [date, odcdlike]
    );
    return kd8220;
};

// iPhone表示用の日報データ取得
exports.getKD8220iPhone = async (date, entryplace) => {
    let odcd = "";
    if (entryplace == "WL04") {
        odcd = "607%";
    } else if (entryplace == "WL01") {
        odcd = "605%";
    }
    const kd8220 = await getDatabase(
        "select a.*, ifnull(b.TKRNM, '-') as 'TKRNM', NAME as 'OPNAME' " + 
        "from kd8220 a left outer join m0200 b on a.TKCD=b.TKCD, km0010 c " +
        "where a.ODCD like '" + odcd + "' and a.OPERATOR=c.EMPNO and ENTRYDT=? order by a.HMCD"
        , [date]
    );
    return kd8220;
};

// 従業員マスタ(KM0010)存在チェック
exports.isKM0010 = async (userid) => {
    const km0010 = await getDatabase("select * from km0010 where EMPNO=?", [userid]);
    return km0010.length == 0 ? false : true;
};

// 品目マスタ(M0500)存在チェック
exports.isM0500 = async (hmcd) => {
    const m0500 = await getDatabase("select * from m0500 where HMCD=?", [hmcd]);
    return m0500.length == 0 ? false : true;
};

// 出荷指示書ファイルより概要取得
exports.getKD8330overview = async (date) => {
    const kd8330 = await getDatabase(
        "select " +
        "	a.TKCD, replace(b.TKRNM,'ｸﾎﾞﾀ','') as 'TKRNM', a.SHIPDT, a.DLVRDT, a.XLSSN" +
        "	, count(distinct a.TKHMCD) as 'TTL', count(if(a.HTJUQTY=0,null,HTJUQTY)) as 'CNT' " +
        "from kd8330 a, m0200 b " +
        "where a.TKCD=b.TKCD and " +
        "shipdt>=date(?) " +
        "group by " +
        "	a.TKCD, b.TKRNM, a.SHIPDT, a.DLVRDT, a.XLSSN"
        , [date]
    );
    return kd8330;
};

// 出荷指示書ファイル明細取得
exports.getKD8330detail = async (shipdt, tkcd, xlssn, disp) => {
    const kd8330 = await getDatabase(
        "select a.*, b.TKRNM from kd8330 a, m0200 b " +
        "where a.TKCD=b.TKCD and shipdt>=date(?) and a.tkcd=? and a.xlssn=?"
        , [shipdt, tkcd, xlssn]
    );
    return kd8330;
};
