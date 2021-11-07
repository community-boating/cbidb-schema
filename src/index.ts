import * as fs from 'fs'
import readFile from './read-file'
import writeStorable from './write-neptune-storable'
import {fromUpperSnake, toCamelCaseLeadCap, depluralize} from "./format"

// run to generate data
// select table_name, column_name, data_type, data_length, nullable from user_tab_columns order by table_name, column_id

export type Row = {
	tableName: string,
	columnName: string,
	columnType: string,
	columnSize: number,
	nullable: boolean
}

export type Table = {
	tableName: string,
	rows: Row[]
}

readFile().then(data => {
	const groupedByTable: {[K: string]: Row[]} = data.reduce((hash, row) => {
		hash[row.tableName] = (hash[row.tableName] || []).concat([row]);
		return hash;
	}, {});

	const tables: Table[] = Object.keys(groupedByTable).map(tableName => ({
		tableName,
		rows: groupedByTable[tableName]
	}));

	tables.forEach(table => {
		const fileName = toCamelCaseLeadCap(fromUpperSnake(depluralize(table.tableName)))
		fs.writeFileSync(`out/${fileName}.scala`, writeStorable(table));
	})

	
})