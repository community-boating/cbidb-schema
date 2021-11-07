import * as fs from 'fs';
import { parse } from 'csv';
import { Row } from './index'

export default () => {
	return new Promise<Row[]>((resolve, reject) => {
		const parser = parse({delimiter: ','}, function(err, data){
			resolve(data.map(row => ({
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
