"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AgreementController_1 = require("./AgreementController");
const routes = async (fastify, opts) => {
    fastify.post('/', AgreementController_1.generateAgreement);
    fastify.post('/:id/sign', AgreementController_1.signAgreement);
    fastify.get('/:id/download', AgreementController_1.downloadAgreement);
};
exports.default = routes;
