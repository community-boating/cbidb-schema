import { BooleanLookup, ColumnLookup, Table } from './index'
import {fromUpperSnake, toCamelCaseLeadCap, toCamelCase, depluralize} from "./format"
import {typeOverrides} from "./overrides"

const INDENT = '\t'
const NL = '\n'

const ind = (n: number) => n > 0 ? INDENT + ind(n-1) : "";

const getFieldType = (tableName: string, fieldName: string, fieldType: string, fieldSize: number) => {
	const override = typeOverrides[tableName] && typeOverrides[tableName][fieldName];
	if (override) return override;

	switch (fieldType){
	case "CHAR":
		if (fieldSize && fieldSize == 1) {
			return "Boolean"
		} // else fall through to varchar/string
	case "VARCHAR2":
		return "String";
	case "DATE":
		return "LocalDateZZZ"
	case "NUMBER":
		if (fieldName.endsWith("ID")) return "Int"
		else return "Double"
	default:
		return "Unknown";
	}
}

export default ({tableName, rows}: Table, pk: string, nonNullLookup: BooleanLookup) => {
	let out = "";

	const className = toCamelCaseLeadCap(fromUpperSnake(depluralize(tableName)))

	out += "package org.sailcbi.APIServer.Entities.dto" + NL;
	out += NL;
	out += "import com.coleji.neptune.Storable.DTOClass" + NL
	out += `import org.sailcbi.APIServer.Entities.EntityDefinitions.${className}` + NL
	out += "import play.api.libs.json.{JsValue, Json}" + NL
	out += NL;
	out += `case class Put${className}Dto (` + NL
	rows.forEach((row, i) => {
		const dontOverrideNullable = undefined == nonNullLookup[tableName] || undefined == nonNullLookup[tableName][row.columnName]
		const nullable = (row.nullable || row.columnName == pk) && dontOverrideNullable
		const fieldName = toCamelCase(fromUpperSnake(row.columnName));
		const fieldClass = `${nullable?"Option[":""}${getFieldType(row.tableName, row.columnName, row.columnType, row.columnSize)}${nullable?"]":""}`
		out += ind(1) + `${fieldName}: ${fieldClass},` + NL
	})
	out += `) extends DTOClass[${className}] {` + NL
	if (pk) out += ind(1) + `override def getId: Option[Int] = ${toCamelCase(fromUpperSnake(pk))}` + NL
	out += NL

	out += ind(1) + `override def mutateStorableForUpdate(s: ${className}): ${className} = {` + NL
	rows.forEach((row, i) => {
		if (row.columnName == pk) return;
		const fieldName = toCamelCase(fromUpperSnake(row.columnName));
		out += ind(2) + `s.update(_.${fieldName}, ${fieldName})` + NL
	})
	out += ind(2) + `s` + NL
	out += ind(1) + `}` + NL
	out += NL
	out += ind(1) +`override def mutateStorableForInsert(s: ${className}):  ${className} = mutateStorableForUpdate(s)` + NL
	out += "}" +NL
	out += NL;
	out += `object Put${className}Dto {` + NL
	out += ind(1) +`implicit val format = Json.format[Put${className}Dto]` + NL
	out += NL
	out += ind(1) +`def apply(v: JsValue): Put${className}Dto = v.as[Put${className}Dto]` + NL
	out += "}"

	
	return out;
}