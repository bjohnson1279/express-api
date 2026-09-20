import { Response } from 'express';

class EventBus {
  private clients: Response[] = [];

  subscribe(res: Response) {
    this.clients.push(res);
  }

  unsubscribe(res: Response) {
    this.clients = this.clients.filter((client) => client !== res);
  }

  broadcast(eventType: string, payload: any) {
    const data = JSON.stringify({ type: eventType, payload });
    this.clients.forEach((client) => {
      client.write(`data: ${data}\n\n`);
    });
  }
}

export const eventBus = new EventBus();
