"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const technicianController_1 = require("../controllers/technicianController");
const router = (0, express_1.Router)();
router.get('/', technicianController_1.getTechnicians);
router.get('/:id/schedule', technicianController_1.getTechnicianSchedule);
router.patch('/:id/location', technicianController_1.updateLocation);
exports.default = router;
