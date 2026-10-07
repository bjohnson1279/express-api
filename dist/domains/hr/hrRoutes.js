"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hrController_1 = require("./hrController");
const OnboardingController_1 = require("./OnboardingController");
const routes = async (fastify, opts) => {
    fastify.get('/staff', hrController_1.getStaff);
    fastify.get('/courses', hrController_1.getCourses);
    fastify.post('/certifications', hrController_1.assignCertification);
    // Onboarding Endpoints
    fastify.get('/onboarding/:userId/tasks', OnboardingController_1.OnboardingController.getTasks);
    fastify.post('/onboarding/upload', OnboardingController_1.upload.single('document'), OnboardingController_1.OnboardingController.uploadDocument);
};
exports.default = routes;
