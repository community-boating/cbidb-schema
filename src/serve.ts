import * as YAML from 'yaml';
import * as express from 'express'
import * as swaggerUi from 'swagger-ui-express';
import * as fs from 'fs'

export default function serve() {
	const swaggerDocument = YAML.parse( fs.readFileSync('./out/api/combined.yaml', 'utf8'));
	const app = express();
	

	app.get('/scala', (req, res) => {
		res.download("./out/api/scala.zip")
	})

	app.get('/typescript', (req, res) => {
		res.download("./out/api/typescript.zip")
	})

	
	app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
	
	console.log("Listening on port 8080")
	app.listen(8080)
}