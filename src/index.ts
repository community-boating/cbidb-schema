import * as fs from 'fs'
import {readColumns, readPKs} from './read-file'
import writeStorable from './write-neptune-storable'
import {fromUpperSnake, toCamelCaseLeadCap, depluralize} from "./format"

// run to generate data
// select table_name, column_name, data_type, data_length, nullable from user_tab_columns order by table_name, column_id

// get PKs
// SELECT cols.table_name, cols.column_name
// FROM user_constraints cons, user_cons_columns cols
// WHERE cons.constraint_type = 'P'
// AND cons.constraint_name = cols.constraint_name
// AND cons.owner = cols.owner
// ORDER BY cols.table_name, cols.position;

export type PK = {
	tableName: string,
	columnName: string,
}

export type Row = PK & {
	columnType: string,
	columnSize: number,
	nullable: boolean
}



export type Table = {
	tableName: string,
	rows: Row[]
}

Promise.all([readColumns(), readPKs()]).then(([columns, pks]) => {
	const groupedByTable: {[K: string]: Row[]} = columns.reduce((hash, row) => {
		hash[row.tableName] = (hash[row.tableName] || []).concat([row]);
		return hash;
	}, {});

	const tables: Table[] = Object.keys(groupedByTable).map(tableName => ({
		tableName,
		rows: groupedByTable[tableName]
	}));

	tables.forEach(table => {
		const pkRecord = pks.find(pk => pk.tableName == table.tableName)
		const pk = pkRecord && pkRecord.columnName
		const fileName = toCamelCaseLeadCap(fromUpperSnake(depluralize(table.tableName)))
		fs.writeFileSync(`out/${fileName}.scala`, writeStorable(table, pk));
	});
})