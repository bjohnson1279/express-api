"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eventBus_1 = require("../services/eventBus");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    // Tell the client that the connection is open
    res.write('data: {"type": "connected"}\n\n');
    eventBus_1.eventBus.subscribe(res);
    req.on('close', () => {
        eventBus_1.eventBus.unsubscribe(res);
    });
});
exports.default = router;
