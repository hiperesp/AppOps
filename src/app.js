import express from 'express'
import nunjucks from 'nunjucks'
import dotenv from 'dotenv'

import Namespace from './model/Namespace.js';

dotenv.config({path: process.cwd() + '/../.env'})

const app = express()

// Configurar pasta de assets estáticos
app.use(express.static('view/static'));

// Configurar o Nunjucks como mecanismo de visualização padrão do Express
app.set('view engine', 'njk')

// Configurar a pasta onde estão armazenados os templates do Nunjucks
nunjucks.configure('view', {
    autoescape: true,
    express: app
})


app.get('/', function(request, response) {
    response.render('pages/namespaces.njk', {
        namespaces: [
            Namespace.get(process.env.NAMESPACE_NAME),
        ]
    })
})

app.get('/:namespace', function(request, response) {
    response.render('pages/apps.njk', {
        namespace: request.params.namespace,
        apps: [
            {
                name: 'app1',
                online: true,
                replicas: 3,
            },
            {
                name: 'app2',
                online: false,
                replicas: 13,
            },
        ]
    })
})

app.get('/:namespace/:app', function(request, response) {
    response.render('pages/app.njk', {
        title: 'Meu site',
        namespace: request.params.namespace,
        app: request.params.app,
        tab: request.query.tab || 'overview'
    })
})

// Iniciar o servidor
app.listen(3000, function() {
    console.log('Servidor iniciado na porta 3000')
})