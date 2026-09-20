"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgreementService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
class AgreementService {
    async generateAgreement(tenantId, customerId, propertyId, cadence, recurringAmount, startDate) {
        const agreement = await prisma.serviceAgreement.create({
            data: {
                tenantId,
                customerId,
                propertyId,
                cadence,
                recurringAmount,
                startDate,
                status: 'draft'
            }
        });
        const pdfPath = path_1.default.join(__dirname, `../../uploads/agreements/${agreement.id}.pdf`);
        // Ensure directory exists
        const dir = path_1.default.dirname(pdfPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        const doc = new pdfkit_1.default();
        doc.pipe(fs_1.default.createWriteStream(pdfPath));
        doc.fontSize(25).text('Service Agreement', 100, 100);
        doc.fontSize(12).text(`Agreement ID: ${agreement.id}`);
        doc.text(`Tenant ID: ${tenantId}`);
        doc.text(`Customer ID: ${customerId}`);
        doc.text(`Property ID: ${propertyId}`);
        doc.text(`Cadence: ${cadence}`);
        doc.text(`Recurring Amount: $${recurringAmount}`);
        doc.text(`Start Date: ${startDate.toISOString()}`);
        doc.end();
        const updatedAgreement = await prisma.serviceAgreement.update({
            where: { id: agreement.id },
            data: { pdfUrl: `/uploads/agreements/${agreement.id}.pdf` }
        });
        return updatedAgreement;
    }
    async signAgreement(agreementId, signatureSvg) {
        const agreement = await prisma.serviceAgreement.findUnique({
            where: { id: agreementId }
        });
        if (!agreement) {
            throw new Error('Agreement not found');
        }
        // Auto-create service contract and job
        const contract = await prisma.serviceContract.create({
            data: {
                tenantId: agreement.tenantId,
                customerId: agreement.customerId,
                propertyId: agreement.propertyId,
                cadence: agreement.cadence,
                startDate: agreement.startDate,
                recurringAmount: agreement.recurringAmount,
                status: 'active'
            }
        });
        await prisma.job.create({
            data: {
                tenantId: agreement.tenantId,
                customerId: agreement.customerId,
                propertyId: agreement.propertyId,
                contractId: contract.id,
                status: 'draft',
                scheduledStart: agreement.startDate
            }
        });
        const updatedAgreement = await prisma.serviceAgreement.update({
            where: { id: agreementId },
            data: {
                status: 'signed',
                signatureSvg,
                signedAt: new Date(),
                contractId: contract.id
            }
        });
        return updatedAgreement;
    }
}
exports.AgreementService = AgreementService;
