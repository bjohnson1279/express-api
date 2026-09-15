import { Router } from 'express';
import { getContracts } from '../controllers/contractController';

const router = Router();

router.get('/', getContracts);

export default router;
