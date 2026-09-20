"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dispatchController_1 = require("../controllers/dispatchController");
const router = (0, express_1.Router)();
router.post('/optimize', dispatchController_1.optimizeRoute);
router.post('/emergency', dispatchController_1.emergencyDispatch);
exports.default = router;
