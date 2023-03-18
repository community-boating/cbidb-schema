import * as YAML from 'yaml';
import * as fs from 'fs';
import * as path from 'path'
import { BooleanLookup, ColumnLookup, exit, Table } from './index';
import { depluralize, fromUpperSnake, toCamelCaseLeadCap } from './format';

const SPEC_DIR = "./data/api"

type TableLookup = {[K: string]: Table};

export const CUSTOM_ATTR_GENERAL_TYPE = "$$generalType";
export const CUSTOM_ATTR_NULL_IMPLIES_FALSE = "$$nullImpliesFalse";

const CUSTOM_ATTRS = [CUSTOM_ATTR_GENERAL_TYPE, CUSTOM_ATTR_NULL_IMPLIES_FALSE]

function scanDirectory(pathPrefix: string, tableLookup: TableLookup, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) {
	const thisPath = path.join(SPEC_DIR, pathPrefix);
	const contents = fs.readdirSync(thisPath);
	// console.log(contents)

	const stats = contents.map(f => ({
		relativePath: f,
		stat: fs.statSync(path.join(SPEC_DIR, pathPrefix, f))
	}));

	const subDirs = stats.filter(f => f.stat.isDirectory());
	const files = stats.filter(f => !(f.stat.isDirectory()));

	return [{
		path: thisPath,
		files: files.map(f => processFile(path.join(pathPrefix, f.relativePath), tableLookup, decimalLookup, booleanLookup))
	}].concat(subDirs.flatMap(f => scanDirectory(path.join(pathPrefix, f.relativePath), tableLookup, decimalLookup, booleanLookup)))
}

function processFile(filePath: string, tableLookup: TableLookup, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) {
	const yaml = YAML.parse(fs.readFileSync(path.join(SPEC_DIR, filePath), 'utf8'))
	// console.log(yaml)
	return {
		...performStorableSubstitutions(yaml, tableLookup, decimalLookup, booleanLookup),
		path: "/" + filePath.split(".")[0]
	}
}

function performStorableSubstitutions(yaml: object, tableLookup: TableLookup, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) {
	return mapObjectProps(yaml, methodObject => {
		// e.g. get/post
		return {
			...methodObject,
			responses: mapObjectProps(methodObject.responses, responseObject => {
				// e.g. 200
				return {
					...responseObject,
					content: mapObjectProps(responseObject.content, contentObject => {
						// e.g. application/json
						return {
							...contentObject,
							schema: processSchema(tableLookup, decimalLookup, booleanLookup)(contentObject.schema)
						}
					})
				}
			})
		}
	})
}

const processSchema = (tableLookup: TableLookup, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) => (schema: any) => {
	// console.log("schema: ", schema)
	if (schema.type && schema.type == "object") {
		return {
			...schema,
			properties: mapObjectProps(schema.properties, processSchema(tableLookup, decimalLookup, booleanLookup))
		}
	} else if (schema.type && schema.type == "array") {
		return {
			...schema,
			items: processSchema(tableLookup, decimalLookup, booleanLookup)(schema.items)
		}
	} else if (schema["$$$objectRef"]) {
		return performSchemaSubstitution(schema["$$$objectRef"], tableLookup, decimalLookup, booleanLookup)
	} else return schema;
}

function performSchemaSubstitution(objectSchema: any, tableLookup: TableLookup, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) {
	// console.log(objectSchema)
	if (objectSchema.type == "array") {
		var objectSchemaRmArray = Object.assign({}, objectSchema)
		delete objectSchemaRmArray.type;
		return {
			type: "array",
			items: performSchemaSubstitution(objectSchemaRmArray, tableLookup, decimalLookup, booleanLookup)
		}
	}
	// console.log("OBJ SCHEMA: ", objectSchema);
	const table = tableLookup[objectSchema.object]
	if (table === undefined) exit(`Could not find object named "${objectSchema.object}"`);
	// console.log(table)
	var ret = {
		type: "object",
		properties: {
			...objectSchema.fieldSet.reduce((agg, f) => {
				const row = table.rows.find(r => r.apiFieldName == f)
				if (row === undefined) exit(`No column match for ${table.tableName}.${f}`)
				agg[f] = mapObjectColumnToYaml(table.tableName, row, decimalLookup, booleanLookup);
				return agg;
			}, {}),
			...(objectSchema.references || []).reduce((agg, r) => {
				agg["$$" + r.referenceKey] = performSchemaSubstitution(r, tableLookup, decimalLookup, booleanLookup)
				return agg;
			}, {})
		}
	} as any;
	if (objectSchema.nullable) ret.nullable = true;
	// console.log(ret);
	return ret;
}

function mapObjectProps(o: object, f: (value: any) => any) {
	return Object.keys(o).reduce((agg, k) => {
		agg[k] = f(o[k]);
		return agg;
	}, {});
}

function mapObjectColumnToYaml(tableName: string, col: any, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) {
	var ret = {} as any;
	// console.log(col)
	switch(col.columnType) {
		case "VARCHAR2":
		case "CLOB":
			ret[CUSTOM_ATTR_GENERAL_TYPE] = "string";
			break;
		case "CHAR":
			// console.log(col)
			// console.log(booleanLookup)
			if (booleanLookup[tableName] && undefined !== booleanLookup[tableName][col.columnName]) {
				ret[CUSTOM_ATTR_GENERAL_TYPE] = "boolean";
				const nullImpliesFalse = booleanLookup[tableName][col.columnName];
				ret[CUSTOM_ATTR_NULL_IMPLIES_FALSE] = nullImpliesFalse
			} else ret[CUSTOM_ATTR_GENERAL_TYPE] = "string";
			// console.log(ret[CUSTOM_ATTR_GENERAL_TYPE])
			break;
		case "DATE":
			ret[CUSTOM_ATTR_GENERAL_TYPE] = "datetime";
			break;
		case "NUMBER":
			if (decimalLookup[tableName] && decimalLookup[tableName][col.columnName]) ret[CUSTOM_ATTR_GENERAL_TYPE] = "double";
			else ret[CUSTOM_ATTR_GENERAL_TYPE] = "int";
			break;
		default:
			exit(`Unmapped data type ${col.columnType} found for ${tableName}.${col.columnName}`);
	}
	switch(col.columnType) {
		case "CHAR":
			if (ret[CUSTOM_ATTR_GENERAL_TYPE] == "boolean") {
				ret.type = "boolean";
				break;
			} // else fall through
		case "VARCHAR2":
		case "CLOB":
		case "DATE":
			ret.type = "string";
			break;
		case "NUMBER": 
			ret.type = "number";
			break;
		default:
			exit(`Unmapped data type ${col.columnType} found for ${tableName}.${col.columnName}`);
	}
	if (col.nullable) ret.nullable = true;
	return ret;
}

function removeCustomAttrs(input: any) {
	if (input instanceof Array) {
		return input.map(removeCustomAttrs)
	} else if (typeof input == 'object') {
		var prunedChildren = {};
		Object.keys(input).forEach(k => prunedChildren[k] = removeCustomAttrs(input[k]))
		var ret =  Object.assign({}, input, prunedChildren);
		CUSTOM_ATTRS.forEach(a => delete ret[a])
		return ret;
	} else return input;
}

export default function(tables: Table[], nameOverrides: {[K: string]: string}, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup) {
	const tableLookup = tables.reduce((agg, t) => {
		const mappedTableName = nameOverrides[t.tableName]
		const entityFileName = toCamelCaseLeadCap(fromUpperSnake(depluralize(t.tableName)))
		agg[mappedTableName || entityFileName] = t;
		return agg;
	}, {} as TableLookup);

	const paths = scanDirectory("", tableLookup, decimalLookup, booleanLookup).flatMap(d => d.files).reduce((agg ,e) => {
		agg[e.path] = e;
		delete agg[e.path].path;
		return agg;
	}, {})

	const oasDecorated = {
		...YAML.parse(fs.readFileSync("./data/api-header.yaml", 'utf8')),
		paths
	}

	const oasPure = removeCustomAttrs(oasDecorated)

	return {oasDecorated, oasPure}
}