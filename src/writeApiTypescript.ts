import mkdirp from "mkdirp"
import path = require("path")
import * as fs from 'fs'
import StringBuilder from "./StringBuilder"
import { exit } from "./index"

const CONTAINER_PATH = "./out/api/typescript"

const IMPORT_SUB_TOKEN = "%%IMPORT%%"

function processPath(apiPath: string, pathObject: any) {
	const pathToUse = path.join(CONTAINER_PATH, apiPath)
	mkdirp.sync(pathToUse)
	Object.keys(pathObject).forEach(method => writeFile(apiPath, method, pathObject[method]))
}

function writeFile(apiPath: string, method: string, spec) {
	console.log(apiPath)
	console.log(method)
	console.log(spec.responses["200"].content["application/json"].schema)

	const successResponseSchema = spec.responses["200"].content["application/json"].schema

	console.log(successResponseSchema)

	var importTracker = {};

	const sb = new StringBuilder;

	sb.appendLine(`import * as t from 'io-ts';`)
	sb.appendLine(`import APIWrapper from 'core/APIWrapper';`)
	sb.appendLine(`import { HttpMethod } from "core/HttpMethod";`)
	sb.appendLine(IMPORT_SUB_TOKEN) // replace with import of optionals maybe
	sb.appendLine(`export const path = "${apiPath}"`)
	sb.appendLine()
	sb.appendLine(`export const responseSuccessValidator = ${createTsValidator(successResponseSchema, apiPath, importTracker, 0)}`)

	const requestSchema = spec.requestBody?.content["application/json"]?.schema

	if (requestSchema) {
		sb.appendLine()
		sb.appendLine(`export const requestValidator = ${createTsValidator(requestSchema, apiPath, importTracker, 0)}`)
	}

	const imports = Object.keys(importTracker);

	const tokenReplace = (
		imports.length == 0
		? ""
		: `import { ${imports.join(", ")} } from 'util/OptionalTypeValidators';\n`
	);

	// sb.appendLine(`export const apiw = ${"(program: PageFlavor) => "}new APIWrapper<typeof postResponseValidator, >({`);
	// sb.appendLine(`	path: path${` + "?program=" + program`},`);
	// sb.appendLine(`	type: HttpMethod.${method.toUpperCase()},`);
	// sb.appendLine(`	resultValidator: responseSuccessValidator,`);
	// sb.appendLine(`})`);

	fs.writeFileSync(path.join(CONTAINER_PATH, apiPath, method+".ts"), sb.toString().replace(IMPORT_SUB_TOKEN, tokenReplace));
}

function createTsValidator(schema: any, apiPath: string, importTracker: any, baseIndentLevel: number) {
	switch (schema.type) {
		case "number":
			if (schema.nullable) {
				const ret = "OptionalNumber"
				importTracker[ret] = true;
				return ret;
			} else return "t.number"
		case "boolean":
			if (schema.nullable) {
				const ret = "OptionalBoolean"
				importTracker[ret] = true;
				return ret;
			} else return "t.boolean"
		case "string":
			if (schema.nullable) {
				const ret = "OptionalString"
				importTracker[ret] = true;
				return ret;
			} else return "t.string"
		case "array":
			const sb1 = new StringBuilder();
			sb1.setBaseIndentLevel(baseIndentLevel)
			sb1.append(`t.array(${createTsValidator(schema.items, apiPath, importTracker, baseIndentLevel)}`)
			sb1.append(`)`)
			return sb1.toString();
		case "object":
			const sb2 = new StringBuilder();
			sb2.setBaseIndentLevel(baseIndentLevel)
			sb2.appendLine("t.type({")
			Object.keys(schema.properties).forEach(p => sb2.appendLine(`${p}: ${createTsValidator(schema.properties[p], apiPath, importTracker, baseIndentLevel+1)},`, 1))
			sb2.append("})")
			return sb2.toString()
		default:
			exit(`Unmapped typescript data type ${schema.type} found for api path ${apiPath}`);
	}
}

export default function(spec: any) {
	// console.log(JSON.stringify(spec))
	const paths = spec.paths
	Object.keys(spec.paths).forEach(p => processPath(p, spec.paths[p]))
}