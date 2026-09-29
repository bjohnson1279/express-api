import { Router } from 'express';
import { generateAgreement, signAgreement, downloadAgreement } from './AgreementController';

const router = Router();

router.post('/', generateAgreement);
router.post('/:id/sign', signAgreement);
router.get('/:id/download', downloadAgreement);

export default router;
