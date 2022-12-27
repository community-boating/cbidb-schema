import { Table } from './index'
import {fromUpperSnake, toCamelCaseLeadCap, toCamelCase, depluralize} from "./format"
import {dateOnly, nullableInDb, typeOverrides} from "./overrides"

const INDENT = '\t'
const NL = '\n'

const ind = (n: number) => n > 0 ? INDENT + ind(n-1) : "";

const getFieldType = (tableName: string, fieldName: string, fieldType: string, isField: boolean, fieldSize: number) => {
	const override = typeOverrides[tableName] && typeOverrides[tableName][fieldName];
	if (override) return override;

	switch (fieldType){
	case "CHAR":
		if (fieldSize && fieldSize == 1) {
			return isField ? "BooleanDatabaseField" : "BooleanFIeldValue"
		} // else fall through to varchar/string
	case "VARCHAR2":
		return isField ? "StringDatabaseField" : "StringFieldValue";
	case "DATE":
		if (dateOnly[tableName] && dateOnly[tableName][fieldName]) return isField ? "LocalDateDatabaseField" : "LocalDateFieldValue"
		else return isField ? "LocalDateTimeDatabaseField" : "LocalDateTimeFieldValue"
	case "NUMBER":
		if (fieldName.endsWith("ID")) return isField ? "IntDatabaseField" : "IntFieldValue"
		return isField ? "DoubleDatabaseField" : "DoubleFieldValue"
	default:
		return "UnknownFieldType";
	}
}

export default ({tableName, rows}: Table, pk: string, mappedTableName: string) => {
	let out = "";

	const className = mappedTableName || toCamelCaseLeadCap(fromUpperSnake(depluralize(tableName)));

	const nullableAnnotations = rows.map(row => nullableInDb[tableName] && nullableInDb[tableName][row.columnName]);

	out += "package org.sailcbi.APIServer.Entities.EntityDefinitions" + NL;
	out += NL;
	out += "import com.coleji.neptune.Storable.FieldValues._" + NL;
	out += "import com.coleji.neptune.Storable.Fields._" + NL;
	out += "import com.coleji.neptune.Storable._" + NL;
	out += "import com.coleji.neptune.Util.Initializable" + NL;
	out += NL;
	out += `class ${className} extends StorableClass(${className}) {` + NL
	out += ind(1) + "object values extends ValuesObject {" + NL;
	rows.forEach((row, i) => {
		const fieldName = toCamelCase(fromUpperSnake(row.columnName));
		const nullableAnnotation = nullableAnnotations[i];
		const fieldClass = (row.nullable && !nullableAnnotation ? "Nullable" : "") + getFieldType(row.tableName, row.columnName, row.columnType, false, row.columnSize)
		out += ind(2) + `val ${fieldName} = new ${fieldClass}(self, ${className}.fields.${fieldName})` + NL
	})
	out += ind(1) + "}" + NL
	out += "}" + NL;
	out += NL;
	out += `object ${className} extends StorableObject[${className}] {` + NL
	out += ind(1) + "override val useRuntimeFieldnamesForJson: Boolean = true" + NL + NL
	out += ind(1) + `override val entityName: String = "${tableName}"` + NL;
	out += NL;
	out += ind(1) + `object fields extends FieldsObject {` + NL;
	rows.forEach((row, i) => {
		const nullableAnnotation = nullableAnnotations[i];
		if (nullableAnnotation) {
		//	console.log("nullable record for " + tableName + "." + row.columnName)
			out += ind(2) + "@NullableInDatabase" + NL;
		} else {
		//	console.log("no nullable record for " + tableName + "." + row.columnName)
		}
		const fieldName = toCamelCase(fromUpperSnake(row.columnName));
		const fieldClass = (row.nullable && !nullableAnnotation ? "Nullable" : "") + getFieldType(row.tableName, row.columnName, row.columnType, true, row.columnSize)
		const size = (row.columnType == "VARCHAR2" ? `, ${row.columnSize}` : "");
		out += ind(2) + `val ${fieldName} = new ${fieldClass}(self, "${row.columnName}"${size})` + NL
	})
	out += ind(1) + "}" + NL
	if (pk) {
		out += NL
		out += ind(1) + `def primaryKey: IntDatabaseField = fields.${toCamelCase(fromUpperSnake(pk))}` + NL;
	}
	out += "}"
	return out;
}