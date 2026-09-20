import PDFDocument from 'pdfkit';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export class AgreementService {
  public async generateAgreement(tenantId: string, customerId: string, propertyId: string, cadence: any, recurringAmount: number, startDate: Date) {
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

    const pdfPath = path.join(__dirname, `../../uploads/agreements/${agreement.id}.pdf`);
    
    // Ensure directory exists
    const dir = path.dirname(pdfPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(pdfPath));
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

  public async signAgreement(agreementId: string, signatureSvg: string) {
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
