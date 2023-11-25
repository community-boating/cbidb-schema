import * as YAML from 'yaml';
import * as express from 'express'
import * as swaggerUi from 'swagger-ui-express';
import * as fs from 'fs'

export default function serve() {
	// https://github.com/swagger-api/swagger-ui/blob/master/docs/usage/configuration.md
	const swaggerOptions: swaggerUi.SwaggerUiOptions = {
		swaggerOptions: {
			docExpansion: "none",
			defaultModelExpandDepth: 6,
			tagsSorter: "alpha"
		}
	}

	const swaggerDocument = YAML.parse( fs.readFileSync('./out/api/combined.yaml', 'utf8'));
	const app = express();
	

	app.get('/scala.zip', (req, res) => {
		res.download("./out/api/scala.zip")
	})

	app.get('/typescript.zip', (req, res) => {
		res.download("./out/api/typescript.zip")
	})

	
	app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

	console.log("Listening on port 8080")
	app.listen(8080)
}