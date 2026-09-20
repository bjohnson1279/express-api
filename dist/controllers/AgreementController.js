"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadAgreement = exports.signAgreement = exports.generateAgreement = void 0;
const AgreementService_1 = require("../services/AgreementService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const agreementService = new AgreementService_1.AgreementService();
const generateAgreement = async (req, res) => {
    try {
        const { tenantId, customerId, propertyId, cadence, recurringAmount, startDate } = req.body;
        const agreement = await agreementService.generateAgreement(tenantId, customerId, propertyId, cadence, recurringAmount, new Date(startDate));
        res.status(201).json(agreement);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.generateAgreement = generateAgreement;
const signAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const { signatureSvg } = req.body;
        const agreement = await agreementService.signAgreement(id, signatureSvg);
        res.json(agreement);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.signAgreement = signAgreement;
const downloadAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const pdfPath = path_1.default.join(__dirname, `../../uploads/agreements/${id}.pdf`);
        if (fs_1.default.existsSync(pdfPath)) {
            res.download(pdfPath);
        }
        else {
            res.status(404).json({ error: 'Agreement PDF not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.downloadAgreement = downloadAgreement;
