import * as fs from 'fs'
import {readColumns, readDecimals, readPKs, readTableNameOverrides} from './read-file'
import writeStorable from './write-neptune-storable'
import writeDto from './write-dto'
import {fromUpperSnake, toCamelCaseLeadCap, depluralize} from "./format"
import writeMysqlTable from './write-mysql-table'
import processApiSpecs from './processApiSpecs'
import mkdirp from 'mkdirp'
import writeApiTypescript from './writeApiTypescript'
import writeApiScala from './writeApiScala'
import * as YAML from 'yaml';

// run to generate data (data/table-columns.csv)
// select table_name, column_name, data_type, data_length, nullable from user_tab_columns order by table_name, column_id

// get PKs
// SELECT cols.table_name, cols.column_name
// FROM user_constraints cons, user_cons_columns cols
// WHERE cons.constraint_type = 'P'
// AND cons.constraint_name = cols.constraint_name
// AND cons.owner = cols.owner
// ORDER BY cols.table_name, cols.position;

export type TableNameMapping = {
	tableName: string,
	className: string
}

export type Column = {
	tableName: string,
	columnName: string,
}

export type Row = Column & {
	columnType: string,
	columnSize: number,
	nullable: boolean,
	apiFieldName: string
}

export type Table = {
	tableName: string,
	rows: Row[]
}

export type DecimalLookup = {
	[K: string]: {[K: string]: true}
}

export function exit(msg: string) {
	console.error(msg)
	process.exit(1)
}

function main() {
	mkdirp.sync("out/dtos");
	mkdirp.sync("out/entities");
	mkdirp.sync("out/ddl");
	mkdirp.sync("out/api/typescript");
	mkdirp.sync("out/api/scala");

	Promise.all([readColumns(), readPKs(), readDecimals(), readTableNameOverrides()])
	.then(([columns, pks, decimals, nameOverrides]) => {
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
	
		fs.writeFileSync(`out/ddl/mysql-ddl.sql`, "");
	
		tables.forEach(table => {
			const mappedTableName = nameOverrides[table.tableName]
			const pkRecord = pks.find(pk => pk.tableName == table.tableName)
			const pk = pkRecord && pkRecord.columnName
			const dtoFileName = "Put" + toCamelCaseLeadCap(fromUpperSnake(depluralize(table.tableName))) + "Dto"
			const entityFileName = toCamelCaseLeadCap(fromUpperSnake(depluralize(table.tableName)))
			fs.writeFileSync(`out/entities/${mappedTableName || entityFileName}.scala`, writeStorable(table, pk, mappedTableName));
			fs.writeFileSync(`out/dtos/${dtoFileName}.scala`, writeDto(table, pk));
			fs.appendFileSync(`out/ddl/mysql-ddl.sql`, writeMysqlTable(table, pk, decimalLookup));
		});
	
		const {oasPure, oasDecorated} = processApiSpecs(tables, nameOverrides);

		fs.writeFileSync(`out/api/combined.yaml`, YAML.stringify(oasPure));

		writeApiTypescript(oasDecorated);
		writeApiScala(oasDecorated);
	})

}

main();