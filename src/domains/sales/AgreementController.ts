import { FastifyRequest, FastifyReply } from 'fastify';
import { AgreementService } from './AgreementService';
import path from 'path';
import fs from 'fs';

const agreementService = new AgreementService();

export const generateAgreement = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { tenantId, customerId, propertyId, cadence, recurringAmount, startDate } = (req.body as any);
    const agreement = await agreementService.generateAgreement(
      tenantId, customerId, propertyId, cadence, recurringAmount, new Date(startDate)
    );
    reply.status(201).send(agreement);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
};

export const signAgreement = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const { signatureSvg } = (req.body as any);
    const agreement = await agreementService.signAgreement(id, signatureSvg);
    reply.send(agreement);
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
};

export const downloadAgreement = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const pdfPath = path.join(__dirname, `../../uploads/agreements/${id}.pdf`);
    
    if (fs.existsSync(pdfPath)) {
      reply.download(pdfPath);
    } else {
      reply.status(404).send({ error: 'Agreement PDF not found' });
    }
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
};
