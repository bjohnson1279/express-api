"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contractController_1 = require("../controllers/contractController");
const router = (0, express_1.Router)();
router.get('/', contractController_1.getContracts);
exports.default = router;
