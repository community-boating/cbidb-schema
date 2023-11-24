import { BooleanLookup, Column, ColumnLookup, Reference, Table } from './index'
import {fromUpperSnake, toCamelCaseLeadCap, toCamelCase, depluralize} from "./format"
import {typeOverrides, calculations} from "./overrides"

const INDENT = '\t'
const NL = '\n'

const ind = (n: number) => n > 0 ? INDENT + ind(n-1) : "";

const getFieldType = (
	tableName: string, 
	fieldName: string,
	fieldType: string,
	isField: boolean,
	fieldSize: number,
	integerLookup: ColumnLookup,
	booleanLookup: BooleanLookup,
	nonNullLookup: BooleanLookup,
	localDateLookup: ColumnLookup
) => {
	const override = typeOverrides[tableName] && typeOverrides[tableName][fieldName];
	if (override) return override;

	switch (fieldType){
	case "CHAR":
		if (fieldSize && fieldSize==1) console.log("%%%% ", tableName + "." + fieldName)
		if (booleanLookup[tableName] && undefined != booleanLookup[tableName][fieldName]) {
			return isField ? "BooleanDatabaseField" : "BooleanFieldValue"
		} // else fall through to varchar/string
	case "VARCHAR2":
	case "CLOB":
		return isField ? "StringDatabaseField" : "StringFieldValue";
	case "DATE":
		if (localDateLookup[tableName] && localDateLookup[tableName][fieldName]) return isField ? "DateDatabaseField" : "DateFieldValue"
		else return isField ? "DateTimeDatabaseField" : "DateTimeFieldValue"
	case "NUMBER":
	case "LONG":
		if (fieldName.toLowerCase().endsWith("id") || (integerLookup[tableName] && integerLookup[tableName][fieldName])) return isField ? "IntDatabaseField" : "IntFieldValue"
		return isField ? "DoubleDatabaseField" : "DoubleFieldValue"
	default:
		console.log("Unmapped field type " + fieldType)
		process.exit(1)
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

export default (
	{tableName, rows}: Table,
	pk: string,
	nameOverrides: {[K: string]: string},
	integerLookup: ColumnLookup,
	booleanLookup: BooleanLookup,
	nonNullLookup: BooleanLookup,
	references: Reference[],
	localDateLookup: ColumnLookup
) => {
	let out = "";

	const className = nameOverrides[tableName] || toCamelCaseLeadCap(fromUpperSnake(depluralize(tableName)));

	const referencesThisTable = references.filter(r => r.tableName == tableName)

	out += "package org.sailcbi.APIServer.Entities.EntityDefinitions" + NL;
	out += NL;
	out += "import com.coleji.neptune.Storable.FieldValues._" + NL;
	out += "import com.coleji.neptune.Storable.Fields._" + NL;
	out += "import com.coleji.neptune.Storable._" + NL;
	out += "import com.coleji.neptune.Util._" + NL;
	out += "import org.sailcbi.APIServer.Entities.NullableInDatabase" + NL;
	out += "import org.sailcbi.APIServer.Entities.entitycalculations._" + NL;
	out += "import play.api.libs.json._" + NL;
	out += NL;
	out += `class ${className} extends StorableClass(${className}) {` + NL

	if (calculations[tableName]) {
		out += calculations[tableName] + NL
	}
	if (referencesThisTable.length > 0) {
		out += ind(1) + "override object references extends ReferencesObject {" + NL;
		referencesThisTable.forEach(r => {
			const referencedTableName = nameOverrides[r.referencedTableName] || toCamelCaseLeadCap(fromUpperSnake(depluralize(r.referencedTableName)))
			const type = r.type ? `${r.type}[${referencedTableName}]` : referencedTableName
			out += ind(2) + `val ${r.variableName} = new Initializable[${type}]` + NL
		})
		out += ind(1) + "}" + NL + NL;
	}
	out += ind(1) + "override object values extends ValuesObject {" + NL;
	rows.forEach((row, i) => {
		const dontOverrideNullable = undefined == nonNullLookup[tableName] || undefined == nonNullLookup[tableName][row.columnName]
		const nullable = row.nullable && dontOverrideNullable
		const fieldName = tableNameAsVarable(row.apiFieldName);
		const isBoolean = (booleanLookup[tableName] && undefined != booleanLookup[tableName][row.columnName])
		const nullImpliesFalse = isBoolean && true === booleanLookup[tableName][row.columnName]
		const fieldClass = (nullable && !nullImpliesFalse ? "Nullable" : "") + getFieldType(row.tableName, row.columnName, row.columnType, false, row.columnSize, integerLookup, booleanLookup, nonNullLookup, localDateLookup)
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
		const dontOverrideNullable = undefined == nonNullLookup[tableName] || undefined == nonNullLookup[tableName][row.columnName]
		const nullable = row.nullable && (dontOverrideNullable)
		const nullableAnnotation = !dontOverrideNullable;
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
		const fieldClass = (nullable && !nullableAnnotation && !nullImpliesFalse ? "Nullable" : "") + getFieldType(row.tableName, row.columnName, row.columnType, true, row.columnSize, integerLookup, booleanLookup, nonNullLookup, localDateLookup)
		const size = (function() {
			if (hasLength) return `, ${row.columnSize}`;
			else if (row.columnType == "CLOB") return `, -1`
			else return "";
		}());
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
