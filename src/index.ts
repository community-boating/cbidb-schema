import * as fs from 'fs'
import {readColumns, readDecimals, readPKs} from './read-file'
import writeStorable from './write-neptune-storable'
import writeDto from './write-dto'
import {fromUpperSnake, toCamelCaseLeadCap, depluralize} from "./format"
import writeMysqlTable from './write-mysql-table'

// run to generate data
// select table_name, column_name, data_type, data_length, nullable from user_tab_columns order by table_name, column_id

// get PKs
// SELECT cols.table_name, cols.column_name
// FROM user_constraints cons, user_cons_columns cols
// WHERE cons.constraint_type = 'P'
// AND cons.constraint_name = cols.constraint_name
// AND cons.owner = cols.owner
// ORDER BY cols.table_name, cols.position;

export type Column = {
	tableName: string,
	columnName: string,
}

export type Row = Column & {
	columnType: string,
	columnSize: number,
	nullable: boolean
}

export type Table = {
	tableName: string,
	rows: Row[]
}

export type DecimalLookup = {
	[K: string]: {[K: string]: true}
}

Promise.all([readColumns(), readPKs(), readDecimals()]).then(([columns, pks, decimals]) => {
	const decimalLookup = decimals.reduce((hash, {tableName, columnName}) => {
		hash[tableName] = hash[tableName] || {};
		hash[tableName][columnName] = true;
		return hash;
	}, {} as DecimalLookup)

	const groupedByTable: {[K: string]: Row[]} = columns.reduce((hash, row) => {
		hash[row.tableName] = (hash[row.tableName] || []).concat([row]);
		return hash;
	}, {});

	const tables: Table[] = Object.keys(groupedByTable).map(tableName => ({
		tableName,
		rows: groupedByTable[tableName]
	}));

	fs.writeFileSync(`out/mysql-ddl.sql`, "");

	tables.forEach(table => {
		const pkRecord = pks.find(pk => pk.tableName == table.tableName)
		const pk = pkRecord && pkRecord.columnName
		const fileName = "Put" + toCamelCaseLeadCap(fromUpperSnake(depluralize(table.tableName))) + "Dto"
		fs.writeFileSync(`out/entities/${fileName}.scala`, writeStorable(table, pk));
		fs.writeFileSync(`out/dtos/${fileName}.scala`, writeDto(table, pk));
		fs.appendFileSync(`out/mysql-ddl.sql`, writeMysqlTable(table, pk, decimalLookup));
	});
})
