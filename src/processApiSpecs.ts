import * as YAML from 'yaml';
import * as fs from 'fs';
import * as path from 'path'
import { exit, Table } from './index';
import { depluralize, fromUpperSnake, toCamelCaseLeadCap } from './format';

const SPEC_DIR = "./data/api"

type TableLookup = {[K: string]: Table};

export const CUSTOM_ATTR_GENERAL_TYPE = "$$generalType";

const CUSTOM_ATTRS = [CUSTOM_ATTR_GENERAL_TYPE]

function scanDirectory(pathPrefix: string, tableLookup: TableLookup) {
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
		files: files.map(f => processFile(path.join(pathPrefix, f.relativePath), tableLookup))
	}].concat(subDirs.flatMap(f => scanDirectory(path.join(pathPrefix, f.relativePath), tableLookup)))
}

function processFile(filePath: string, tableLookup: TableLookup) {
	const yaml = YAML.parse(fs.readFileSync(path.join(SPEC_DIR, filePath), 'utf8'))
	// console.log(yaml)
	return {
		...performStorableSubstitutions(yaml, tableLookup),
		path: "/" + filePath.split(".")[0]
	}
}

function performStorableSubstitutions(yaml: object, tableLookup: TableLookup) {
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
							schema: processSchema(tableLookup)(contentObject.schema)
						}
					})
				}
			})
		}
	})
}

const processSchema = (tableLookup: TableLookup) => (schema: any) => {
	// console.log("schema: ", schema)
	if (schema.type && schema.type == "object") {
		return {
			...schema,
			properties: mapObjectProps(schema.properties, processSchema(tableLookup))
		}
	} else if (schema.type && schema.type == "array") {
		return {
			...schema,
			items: processSchema(tableLookup)(schema.items)
		}
	} else if (schema["$$$objectRef"]) {
		return performSchemaSubstitution(schema["$$$objectRef"], tableLookup)
	} else return schema;
}

function performSchemaSubstitution(objectSchema: any, tableLookup: TableLookup) {
	// console.log("OBJ SCHEMA: ", objectSchema);
	const table = tableLookup[objectSchema.object]
	if (table === undefined) exit(`Could not find object named "${objectSchema.object}"`);
	// console.log(table)
	const ret = {
		type: "object",
		properties: {
			...objectSchema.fieldSet.reduce((agg, f) => {
				const row = table.rows.find(r => r.apiFieldName == f)
				if (row === undefined) exit(`No column match for ${table.tableName}.${f}`)
				agg[f] = mapObjectColumnToYaml(table.tableName, row);
				return agg;
			}, {}),
			...(objectSchema.references || []).reduce((agg, r) => {
				agg["$$" + r.referenceKey] = performSchemaSubstitution(r, tableLookup)
				return agg;
			}, {})
		}
	}
	// console.log(ret);
	return ret;
}

function mapObjectProps(o: object, f: (value: any) => any) {
	return Object.keys(o).reduce((agg, k) => {
		agg[k] = f(o[k]);
		return agg;
	}, {});
}

function mapObjectColumnToYaml(tableName: string, col: any) {
	var ret = {} as any;
	// console.log(col)
	switch(col.columnType) {
		case "VARCHAR2":
		case "CHAR":
			ret[CUSTOM_ATTR_GENERAL_TYPE] = "string";
			break;
		case "DATE":
			ret[CUSTOM_ATTR_GENERAL_TYPE] = "datetime";
			break;
		case "NUMBER":
			ret[CUSTOM_ATTR_GENERAL_TYPE] = "int";
			break;
		default:
			exit(`Unmapped data type ${col.columnType} found for ${tableName}.${col.columnName}`);
	}
	switch(col.columnType) {
		case "VARCHAR2":
		case "CHAR":
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

export default function(tables: Table[], nameOverrides: {[K: string]: string}) {
	const tableLookup = tables.reduce((agg, t) => {
		const mappedTableName = nameOverrides[t.tableName]
		const entityFileName = toCamelCaseLeadCap(fromUpperSnake(depluralize(t.tableName)))
		agg[mappedTableName || entityFileName] = t;
		return agg;
	}, {} as TableLookup);

	const paths = scanDirectory("", tableLookup).flatMap(d => d.files).reduce((agg ,e) => {
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