import { Table } from './index'
import {fromUpperSnake, toCamelCaseLeadCap, toCamelCase, depluralize} from "./format"

const INDENT = '\t'
const NL = '\n'

const ind = (n: number) => n > 0 ? INDENT + ind(n-1) : "";

const getFieldType = (fieldType: string, isField: boolean) => {
	switch (fieldType){
	case "VARCHAR2":
		return isField ? "StringDatabaseField" : "StringFieldValue";
	default:
		return "UnknownFieldType";
	}
}

export default ({tableName, rows}: Table) => {
	let out = "";

	const className = toCamelCaseLeadCap(fromUpperSnake(depluralize(tableName)));

	out += "package org.sailcbi.APIServer.Entities.EntityDefinitions" + NL;
	out += NL;
	out += "import com.coleji.neptune.Storable.FieldValues._" + NL;
	out += "import com.coleji.neptune.Storable.Fields._" + NL;
	out += "import com.coleji.neptune.Storable._" + NL;
	out += "import com.coleji.neptune.Util.Initializable" + NL;
	out += NL;
	out += `class ${className} extends StorableClass(${className}) {` + NL
	out += ind(1) + "object values extends ValuesObject {" + NL;
	rows.forEach(row => {
		const fieldName = toCamelCase(fromUpperSnake(row.columnName));
		const fieldClass = (row.nullable ? "Nullable" : "") + getFieldType(row.columnType, false)
		out += ind(2) + `val ${fieldName} = new ${fieldClass}(self, ${className}.fields.${fieldName})` + NL
	})
	out += ind(1) + "}" + NL
	out += "}" + NL;
	out += NL;
	out += `object ${className} extends StorableObject[${className}] {` + NL
	out += ind(1) + `val entityName: String = "${tableName}"` + NL;
	out += NL;
	out += ind(1) + `object fields extends FieldsObject {` + NL;
	rows.forEach(row => {
		const fieldName = toCamelCase(fromUpperSnake(row.columnName));
		const fieldClass = (row.nullable ? "Nullable" : "") + getFieldType(row.columnType, true)
		const size = (row.columnType == "VARCHAR2" ? `, ${row.columnSize}` : "");
		out += ind(2) + `val ${fieldName} = new ${fieldClass}(self, "${row.columnName}"${size})` + NL
	})
	out += ind(1) + "}" + NL
	out += NL
	out += ind(1) + `def primaryKey: IntDatabaseField = fields.UNKNOWN` + NL;
	out += "}"
	return out;
}