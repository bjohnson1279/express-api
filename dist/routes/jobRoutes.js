"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jobController_1 = require("../controllers/jobController");
const router = (0, express_1.Router)();
router.get('/', jobController_1.getJobs);
router.post('/', jobController_1.createJob);
router.patch('/:id', jobController_1.updateJob);
exports.default = router;
