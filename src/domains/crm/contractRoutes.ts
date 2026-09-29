import { Router } from 'express';
import { getContracts } from './contractController';

const router = Router();

router.get('/', getContracts);

export default router;
