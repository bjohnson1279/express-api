"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hrController_1 = require("../controllers/hrController");
const OnboardingController_1 = require("../controllers/OnboardingController");
const router = (0, express_1.Router)();
router.get('/staff', hrController_1.getStaff);
router.get('/courses', hrController_1.getCourses);
router.post('/certifications', hrController_1.assignCertification);
// Onboarding Endpoints
router.get('/onboarding/:userId/tasks', OnboardingController_1.OnboardingController.getTasks);
router.post('/onboarding/upload', OnboardingController_1.upload.single('document'), OnboardingController_1.OnboardingController.uploadDocument);
exports.default = router;
