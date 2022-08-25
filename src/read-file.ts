import * as fs from 'fs';
import { parse } from 'csv';
import { Row, Column } from './index'

export const readColumns = () => {
	return new Promise<Row[]>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.filter((e, i) => i > 0).map(row => ({
				tableName: row[0],
				columnName: row[1],
				columnType: row[2],
				columnSize: Number(row[3]),
				nullable: row[4] == 'Y'
			})))
		});
		
		fs.createReadStream('data/table-columns.csv').pipe(parser);
	})
}

export const readPKs = () => {
	return new Promise<Column[]>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.map(row => ({
				tableName: row[0],
				columnName: row[1]
			})))
		});
		
		fs.createReadStream('data/pks.csv').pipe(parser);
	})
}

export const readDecimals = () => {
	return new Promise<Column[]>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.map(row => ({
				tableName: row[0],
				columnName: row[1]
			})))
		});
		
		fs.createReadStream('data/decimal-cols.csv').pipe(parser);
	})
}