"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
class EventBus {
    clients = [];
    subscribe(res) {
        this.clients.push(res);
    }
    unsubscribe(res) {
        this.clients = this.clients.filter((client) => client !== res);
    }
    broadcast(eventType, payload) {
        const data = JSON.stringify({ type: eventType, payload });
        this.clients.forEach((client) => {
            client.write(`data: ${data}\n\n`);
        });
    }
}
exports.eventBus = new EventBus();
