const oracledb=require('oracledb');
const { oracleConfig } = require('../config.js');

// ORACLE 接続情報
const dbConfig = {
    user          : oracleConfig.USER,
    password      : oracleConfig.PASSWORD,
    connectString : `${oracleConfig.HOST}/${oracleConfig.SERVICENAME}`,
    externalAuth  : process.env.NODE_ORACLEDB_EXTERNALAUTH ? true : false
};
const options = {outFormat: oracledb.OUT_FORMAT_OBJECT};

// [Oracle] 品目手順マスタと在庫数を取得する API
const getM0510zai = async (hmcd) => {
    const sql = 
        "select * from (" + 
        "select null as HMNM, a.KTSEQ, a.KTCD, k.KTNM, a.ODCD, o.ODRNM, a.JIKBN" + 
        ", a.WKNOTE, a.WKCOMMENT, nvl(z.ZAIQTY,0) as ZAIQTY " + 
        "from M0510 a left join D0520 z on a.HMCD=z.HMCD and a.KTCD=z.KTCD, M0410 k, M0300 o " + 
        "where a.KTCD=k.KTCD and a.ODCD=o.ODCD " +
        "and a.VALDTF=(select max(tmp.VALDTF) from M0510 tmp where tmp.HMCD=a.HMCD) " + 
        "and mod(a.KTSEQ, 10) = 0 " + 
        "and a.HMCD=:hmcd " + 
        "order by a.HMCD, a.KTSEQ DESC" + 
        ") res"
        const connection = await oracledb.getConnection(dbConfig);
        const results = await connection.execute(sql, [hmcd], options);
        connection.release();
        return JSON.parse(JSON.stringify(results.rows));
};
exports.getM0510zai = getM0510zai;

// [Oracle] 品目マスタの品名と最終工程の在庫数を取得する API
// D0520:在庫Fは最終工程コードがnullで品目手順マスタからでは取得できない為
const getM0500zai = async (hmcd) => {
    const sql = 
        "select m.HMNM, z.ZAIQTY from M0500 m, D0520 z where m.HMCD=z.HMCD and z.KTCD is NULL " + 
        "and m.HMCD=:hmcd";
    const connection = await oracledb.getConnection(dbConfig);
    const results = await connection.execute(sql, [hmcd], options);
    connection.release();
    return JSON.parse(JSON.stringify(results.rows));
};
exports.getM0500zai = getM0500zai;
