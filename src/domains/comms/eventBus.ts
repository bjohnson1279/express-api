import { FastifyReply } from 'fastify';
class EventBus {
  private clients = new Map<FastifyReply, string>();
  subscribe(reply: FastifyReply, tenantId: string) { if (tenantId) this.clients.set(reply, tenantId); }
  unsubscribe(reply: FastifyReply) { this.clients.delete(reply); }
  broadcast(eventType: string, payload: any, tenantId?: string) {
    if (!tenantId) return; // Unattributed events must never reach another tenant.
    const data = JSON.stringify({ type: eventType, payload });
    this.clients.forEach((tenant, client) => { if (tenant === tenantId) client.raw.write(`data: ${data}\n\n`); });
  }
}
export const eventBus = new EventBus();
