import { FastifyReply } from 'fastify';

class EventBus {
  private clients: FastifyReply[] = [];

  subscribe(reply: FastifyReply) {
    this.clients.push(reply);
  }

  unsubscribe(reply: FastifyReply) {
    this.clients = this.clients.filter((client) => client !== reply);
  }

  broadcast(eventType: string, payload: any) {
    const data = JSON.stringify({ type: eventType, payload });
    this.clients.forEach((client) => {
      client.raw.write(`data: ${data}\n\n`);
    });
  }
}

export const eventBus = new EventBus();
