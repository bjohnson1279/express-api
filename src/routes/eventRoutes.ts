import { Router, Request, Response } from 'express';
import { eventBus } from '../services/eventBus';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Tell the client that the connection is open
  res.write('data: {"type": "connected"}\n\n');

  eventBus.subscribe(res);

  req.on('close', () => {
    eventBus.unsubscribe(res);
  });
});

export default router;
