import { BooleanLookup, ColumnLookup, Table } from './index'
import {fromUpperSnake, toCamelCaseLeadCap, toCamelCase, depluralize} from "./format"
import {dateOnly, nullableInDb, typeOverrides} from "./overrides"

const INDENT = '\t'
const NL = '\n'

const ind = (n: number) => n > 0 ? INDENT + ind(n-1) : "";

const getFieldType = (tableName: string, fieldName: string, fieldType: string, isField: boolean, fieldSize: number, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup, nonNullLookup: BooleanLookup) => {
	const override = typeOverrides[tableName] && typeOverrides[tableName][fieldName];
	if (override) return override;

	switch (fieldType){
	case "CHAR":
		if (fieldSize && fieldSize==1) console.log("%%%% ", tableName + "." + fieldName)
		if (booleanLookup[tableName] && undefined != booleanLookup[tableName][fieldName]) {
			return isField ? "BooleanDatabaseField" : "BooleanFieldValue"
		} // else fall through to varchar/string
	case "VARCHAR2":
		return isField ? "StringDatabaseField" : "StringFieldValue";
	case "DATE":
		if (dateOnly[tableName] && dateOnly[tableName][fieldName]) return isField ? "DateDatabaseField" : "DateFieldValue"
		else return isField ? "DateTimeDatabaseField" : "DateTimeFieldValue"
	case "NUMBER":
		if (fieldName.endsWith("ID")) return isField ? "IntDatabaseField" : "IntFieldValue"
		return isField ? "DoubleDatabaseField" : "DoubleFieldValue"
	default:
		return "UnknownFieldType";
	}
}

const tableNameAsVarable = (name: string) => {
	switch (name) {
	case "type":
	case "class":
		return "`" + name + "`";
	default:
		return name;		
	}
}

export default ({tableName, rows}: Table, pk: string, mappedTableName: string | undefined, decimalLookup: ColumnLookup, booleanLookup: BooleanLookup, nonNullLookup: BooleanLookup) => {
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
		const nullable = row.nullable && (undefined == nonNullLookup[tableName] || undefined == nonNullLookup[tableName][row.columnName])
		const fieldName = tableNameAsVarable(row.apiFieldName);
		const nullableAnnotation = nullableAnnotations[i];
		const isBoolean = (booleanLookup[tableName] && undefined != booleanLookup[tableName][row.columnName])
		const nullImpliesFalse = isBoolean && true === booleanLookup[tableName][row.columnName]
		const fieldClass = (nullable && !nullableAnnotation && !nullImpliesFalse ? "Nullable" : "") + getFieldType(row.tableName, row.columnName, row.columnType, false, row.columnSize, decimalLookup, booleanLookup, nonNullLookup)
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
		const nullable = row.nullable && (undefined == nonNullLookup[tableName] || undefined == nonNullLookup[tableName][row.columnName])
		const nullableAnnotation = nullableAnnotations[i];
		if (nullableAnnotation) {
		//	console.log("nullable record for " + tableName + "." + row.columnName)
			out += ind(2) + "@NullableInDatabase" + NL;
		} else {
		//	console.log("no nullable record for " + tableName + "." + row.columnName)
		}
		const fieldName = tableNameAsVarable(row.apiFieldName);
		const isBoolean = (booleanLookup[tableName] && undefined != booleanLookup[tableName][row.columnName])
		const nullImpliesFalse = isBoolean && true === booleanLookup[tableName][row.columnName]
		const booleanSuffix = (isBoolean && !nullable
			? `, ${nullImpliesFalse}`
			: ""
		)
		const hasLength = (
			(row.columnType == "VARCHAR2") || (
				row.columnType == "CHAR" && !isBoolean
			)
		)
		const fieldClass = (nullable && !nullableAnnotation && !nullImpliesFalse ? "Nullable" : "") + getFieldType(row.tableName, row.columnName, row.columnType, true, row.columnSize, decimalLookup, booleanLookup, nonNullLookup)
		const size = (hasLength ? `, ${row.columnSize}` : "");
		out += ind(2) + `val ${fieldName} = new ${fieldClass}(self, "${row.columnName}"${size}${booleanSuffix})` + NL
	})
	out += ind(1) + "}" + NL
	if (pk) {
		out += NL
		out += ind(1) + `def primaryKey: IntDatabaseField = fields.${toCamelCase(fromUpperSnake(pk))}` + NL;
	}
	out += "}"
	return out;
}