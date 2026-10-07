"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = void 0;
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const express_list_endpoints_1 = __importDefault(require("express-list-endpoints"));
const setupSwagger = (app, title, serverUrl) => {
    const endpoints = (0, express_list_endpoints_1.default)(app);
    const paths = {};
    endpoints.forEach((endpoint) => {
        // Replace Express params like :id with OpenAPI params like {id}
        const openApiPath = endpoint.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
        if (!paths[openApiPath]) {
            paths[openApiPath] = {};
        }
        endpoint.methods.forEach((method) => {
            const m = method.toLowerCase();
            // Exclude generic ALL or middleware only methods
            if (['get', 'post', 'put', 'delete', 'patch'].includes(m)) {
                const paramNames = (endpoint.path.match(/:([a-zA-Z0-9_]+)/g) || []).map((p) => p.substring(1));
                paths[openApiPath][m] = {
                    summary: `${method} ${endpoint.path}`,
                    operationId: `${m}_${endpoint.path.replace(/[\/\:-]/g, '_')}`,
                    parameters: paramNames.map((name) => ({
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
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
};
exports.setupSwagger = setupSwagger;
