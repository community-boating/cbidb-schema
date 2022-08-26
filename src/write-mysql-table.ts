import { DecimalLookup, Table } from "index";

function mapDataType(oracleType: string, length: number) {
	switch (oracleType) {
		case "NUMBER":
			return "INT"
		case "VARCHAR2":
			return `VARCHAR(${length})`
		case "DATE":
			return "DATETIME"
		case "CHAR":
			return `CHAR(${length})`
		case "CLOB":
			return "TEXT"
	}

}

const compositePrimaryKeys = {
	"FLAGS_GLOBALS": "FLAG_ID, GLOBAL_ID",
	"MEM_TYPES_AP_CLASS_TYPES": "MEMBERSHIP_TYPE_ID, AP_CLASS_TYPE_ID",
	"SHOPPING_CART_APPL_GC": "CERT_ID, ORDER_ID",
	"USERS_IPS": "USER_ID, IP_ADDRESS",
	"FO_CLOSE_USERS": "CLOSE_ID, USER_ID, OPEN_CLOSE",
	"SIGNOUT_SNAPSHOTS": "SNAPSHOT_DATETIME, PROGRAM_ID, BOAT_ID"
}

export default ({tableName, rows}: Table, pk: string, decimals: DecimalLookup) => {
	let out = "";

	out += "create table " + tableName + " (\n"
	let delim = "";

	const compositePk = compositePrimaryKeys[tableName]

	rows.forEach(row => {
		//TODO: mysql reserved word, drop this column
		if (row.columnName == "LIMIT") return;


		const isPk = row.columnName == pk
		const isDecimal = decimals[tableName] && decimals[tableName][row.columnName];
		const miscOverride = {
			"PERSONS:ALLERGIES": "TEXT",
			"PERSONS:MEDICATIONS": "TEXT",
			"PERSONS:SPECIAL_NEEDS": "TEXT",
			"PERSONS_TEMP:ALLERGIES": "TEXT",
			"PERSONS_TEMP:MEDICATIONS": "TEXT",
			"PERSONS_TEMP:SPECIAL_NEEDS": "TEXT",
			"DEVELOPER_SESSIONS:SESSION_ID":"BIGINT",
			"PERSONS:DISCORD_USER_ID": "BIGINT",
			"STRIPE_BALANCE_TRANSACTIONS:TRANSACTION_ID": "VARCHAR(50)"
		}
		const override = miscOverride[`${tableName}:${row.columnName}`]
		const dataType = (function() {
			
			if (override != undefined) return override;
		//	else if (isPk) return "INT";
			else if (isDecimal) return "DECIMAL(8,2)";
			else return mapDataType(row.columnType, row.columnSize)
		}()) 
		const autoIncrement = (isPk && !compositePk && override == undefined && dataType == "INT") ? "AUTO_INCREMENT" : "";
		const pkStatement = (isPk && !compositePk && override == undefined ) ? "PRIMARY KEY" : "";
		out += `${delim} ${row.columnName} ${dataType} ${row.nullable ? "" : "NOT NULL"} ${autoIncrement} ${pkStatement}\n`
		delim = ","
	})
	if (compositePk) {
		out += delim + "PRIMARY KEY (" + compositePk + ")\n"
	}
	out += ");\n\n"
	return out;
}

// Table 11.1 Required Storage and Range for Integer Types Supported by MySQL

// Type	Storage (Bytes)	Minimum Value Signed	Minimum Value Unsigned	Maximum Value Signed	Maximum Value Unsigned
// TINYINT	1	-128	0	127	255
// SMALLINT	2	-32768	0	32767	65535
// MEDIUMINT	3	-8388608	0	8388607	16777215
// INT	4	-2147483648	0	2147483647	4294967295
// BIGINT	8	-263	0	263-1	264-1


