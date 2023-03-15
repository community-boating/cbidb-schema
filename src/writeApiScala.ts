import mkdirp from "mkdirp"
import path = require("path")
import * as fs from 'fs'
import StringBuilder from "./StringBuilder"
import { exit } from "./index"

const CONTAINER_PATH = "./out/api/scala"

function processPath(apiPath: string, pathObject: any) {
	const pathToUse = path.join(CONTAINER_PATH, formatPathAsPackage(apiPath).replaceAll(".","/"))
	mkdirp.sync(pathToUse)
	Object.keys(pathObject).forEach(method => writeFile(apiPath, method, pathObject[method]))
}

function firstLetterUppercase(s: String) {
	return s.substring(0,1).toUpperCase() + s.substring(1);
}

function formatPathAsPackage(apiPath: String) {
	return apiPath.split("/").slice(1).map(s => s.split("-").map(ss => firstLetterUppercase(ss)).join("")).join(".")
}

function writeFile(apiPath: string, method: string, spec) {
	console.log(apiPath)
	console.log(method)
	console.log(spec.responses["200"].content["application/json"].schema)

	const successResponseSchema = spec.responses["200"].content["application/json"].schema
	const successResponseSchemaToUse = (
		successResponseSchema.type == "array"
		? successResponseSchema.items
		: successResponseSchema
	)

	console.log(successResponseSchemaToUse)

	const sb = new StringBuilder;

	const packageName = formatPathAsPackage(apiPath)

	const baseClassName = packageName.replaceAll(".","") + firstLetterUppercase(method);

	sb.appendLine(`package org.sailcbi.APIServer.Api.Endpoints.Dto.${packageName}`)
	sb.appendLine()
	sb.appendLine(`import play.api.libs.json.{JsValue, Json}`)
	sb.appendLine()
	sb.appendLine(printScalaClass(successResponseSchemaToUse, baseClassName + "ResponseSuccessDto", apiPath))

	const requestSchema = spec.requestBody?.content["application/json"]?.schema

	if (requestSchema) {
		const requestSchemaToUse = (
			requestSchema.type == "array"
			? requestSchema.items
			: requestSchema
		)
		sb.appendLine()
		sb.appendLine(printScalaClass(requestSchemaToUse, baseClassName + "RequestDto", apiPath))
	}

	fs.writeFileSync(path.join(CONTAINER_PATH, packageName.replaceAll(".","/"), method+".scala"), sb.toString());
}

function printScalaClass(schema: any, className: string, apiPath: string): string {
	if (!schema.properties) exit("Non object schema passed to scala class " + className)
	var subClasses = {}
	const sb = new StringBuilder
	sb.appendLine(`case class ${className} (`)
	Object.keys(schema.properties).forEach(p => {
		const array = schema.properties[p].type == "array"
		const option = schema.properties[p].nullable
		sb.appendLine(
			`${p}: ${option ? "Option[" : ""}` + 
			(array ? "List[" : "") +
			`${getFieldType(firstLetterUppercase(p.replaceAll("$","")), array ? schema.properties[p].items : schema.properties[p], subClasses, className, apiPath)}` + 
			`${array ? "]" : ""}${option ? "]" : ""},`
		, 1)
	});
	sb.appendLine(`)`)
	sb.appendLine()
	Object.keys(subClasses).forEach(subClassName => {
		sb.appendLine(printScalaClass(subClasses[subClassName], subClassName, apiPath))
	})
	sb.appendLine(`object ${className} {`)
	Object.keys(subClasses).forEach(subClassName => {
		sb.appendLine(`implicit val ${subClassName}Format = ${subClassName}.format`, 1)
	})
	sb.appendLine(`implicit val format = Json.format[${className}]`, 1);
	sb.appendLine(`def apply(v: JsValue): ${className} = v.as[${className}]`, 1);
	sb.appendLine(`}`)

	return sb.toString();
}

function getFieldType(fieldName: string, fieldSchema: any, subClasses: any, baseClassName: string, apiPath: string) {
	switch (fieldSchema.type) {
		case "number":
			return "Int"
		case "boolean":
			return "Boolean"
		case "string":
			return "String"
		case "object":
			const newClassName = baseClassName + "_" + fieldName
			subClasses[newClassName] = fieldSchema;
			return newClassName
		default:
			exit(`Unmapped typescript data type ${fieldSchema.type} found for api path ${apiPath}`);
	}
}

export default function(spec: any) {
	// console.log(JSON.stringify(spec))
	const paths = spec.paths
	Object.keys(spec.paths).forEach(p => processPath(p, spec.paths[p]))
}