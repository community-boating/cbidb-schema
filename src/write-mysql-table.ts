import { Table } from "index";

function mapDataType(oracleType: string, length: number) {
	switch (oracleType) {
		case "NUMBER":
			return "DECIMAL(8,2)"; // TODO
			// return "INT"
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

export default ({tableName, rows}: Table, pk: string) => {
	let out = "";

	out += "create table " + tableName + " (\n"
	let delim = "";
	rows.forEach(row => {
		const isPk = row.columnName == pk
		const dataType = isPk ? "INT" : mapDataType(row.columnType, row.columnSize);
		out += `${delim} ${row.columnName} ${dataType} ${row.nullable ? "" : "NOT NULL"} ${isPk ? "AUTO_INCREMENT" : ""}\n`
		delim = ","
	})
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


