"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AgreementController_1 = require("../controllers/AgreementController");
const router = (0, express_1.Router)();
router.post('/', AgreementController_1.generateAgreement);
router.post('/:id/sign', AgreementController_1.signAgreement);
router.get('/:id/download', AgreementController_1.downloadAgreement);
exports.default = router;
