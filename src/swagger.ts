import swaggerUi from 'swagger-ui-express';
import listEndpoints from 'express-list-endpoints';
import { Express } from 'express';

export const setupSwagger = (app: Express, title: string, serverUrl: string) => {
  const endpoints = listEndpoints(app);
  
  const paths: any = {};
  
  endpoints.forEach((endpoint: any) => {
    // Replace Express params like :id with OpenAPI params like {id}
    const openApiPath = endpoint.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    
    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }
    
    endpoint.methods.forEach((method: string) => {
      const m = method.toLowerCase();
      // Exclude generic ALL or middleware only methods
      if (['get', 'post', 'put', 'delete', 'patch'].includes(m)) {
        const paramNames = (endpoint.path.match(/:([a-zA-Z0-9_]+)/g) || []).map((p: string) => p.substring(1));
        
        paths[openApiPath][m] = {
          summary: `${method} ${endpoint.path}`,
          operationId: `${m}_${endpoint.path.replace(/[\/\:-]/g, '_')}`,
          parameters: paramNames.map((name: string) => ({
            name,
            in: 'path',
            required: true,
            schema: { type: 'string' }
          })),
          responses: {
            '200': {
              description: 'Successful response'
            }
          },
          security: openApiPath.includes('/api/v1/') ? [{ BearerAuth: [] }] : []
        };
      }
    });
  });
  
  const swaggerDocument = {
    openapi: '3.1.0',
    info: {
      title,
      version: '1.0.0',
      description: 'Auto-generated OpenAPI 3.1 Documentation'
    },
    servers: [
      { url: serverUrl, description: 'Local Server' }
    ],
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
