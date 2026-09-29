import { Router } from 'express';
import { getCanvassPins } from './canvassController';

const router = Router();
router.get('/pins', getCanvassPins);
export default router;
