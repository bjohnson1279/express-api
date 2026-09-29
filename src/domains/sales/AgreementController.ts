import { Request, Response } from 'express';
import { AgreementService } from './AgreementService';
import path from 'path';
import fs from 'fs';

const agreementService = new AgreementService();

export const generateAgreement = async (req: Request, res: Response) => {
  try {
    const { tenantId, customerId, propertyId, cadence, recurringAmount, startDate } = req.body;
    const agreement = await agreementService.generateAgreement(
      tenantId, customerId, propertyId, cadence, recurringAmount, new Date(startDate)
    );
    res.status(201).json(agreement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const signAgreement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { signatureSvg } = req.body;
    const agreement = await agreementService.signAgreement(id, signatureSvg);
    res.json(agreement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadAgreement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pdfPath = path.join(__dirname, `../../uploads/agreements/${id}.pdf`);
    
    if (fs.existsSync(pdfPath)) {
      res.download(pdfPath);
    } else {
      res.status(404).json({ error: 'Agreement PDF not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
