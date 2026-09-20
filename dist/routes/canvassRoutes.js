"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const canvassController_1 = require("../controllers/canvassController");
const router = (0, express_1.Router)();
router.get('/pins', canvassController_1.getCanvassPins);
exports.default = router;
