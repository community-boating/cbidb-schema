import * as fs from 'fs';
import { parse } from 'csv';
import { Row, Column } from './index'
import { fromUpperSnake, toCamelCase } from './format';

export const readColumns = () => {
	return new Promise<Row[]>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.filter((e, i) => i > 0).map(row => ({
				tableName: row[0],
				columnName: row[1],
				columnType: row[2],
				columnSize: Number(row[3]),
				nullable: row[4] == 'Y',
				apiFieldName: toCamelCase(fromUpperSnake(row[1]))
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

export const readBooleans = () => {
	return new Promise<Column[]>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.map(row => ({
				tableName: row[0],
				columnName: row[1]
			})))
		});
		
		fs.createReadStream('data/boolean-cols.csv').pipe(parser);
	})
}

export const readTableNameOverrides = () => {
	return new Promise<{[K: string]: string}>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.map(row => ({
				tableName: row[0],
				className: row[1]
			})).reduce((agg, e) => {
				agg[e.tableName] = e.className;
				return agg;
			}, {} as {[K: string]: string}))
		});
		
		fs.createReadStream('data/table-name-overrides.csv').pipe(parser);
	})
}