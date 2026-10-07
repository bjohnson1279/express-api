const swaggerAutogen = require('swagger-autogen')({ openapi: '3.1.0' });

const doc = {
  info: {
    title: 'Servicing CRM Express API',
    description: 'API documentation for Servicing CRM operations (Dispatch, Finance, etc.)',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:8002',
      description: 'Local development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{ bearerAuth: [] }]
};

const outputFile = './swagger_output.json';
const routes = ['./src/index.ts'];

swaggerAutogen(outputFile, routes, doc).then(() => {
  console.log('Swagger generated successfully');
});
