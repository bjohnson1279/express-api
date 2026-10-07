import { FastifyPluginAsync } from 'fastify';
import { getStaff, getCourses, assignCertification } from './hrController';

import { OnboardingController, upload } from './OnboardingController';

const routes: FastifyPluginAsync = async (fastify, opts) => {
fastify.get('/staff', getStaff);
fastify.get('/courses', getCourses);
fastify.post('/certifications', assignCertification);

// Onboarding Endpoints
fastify.get('/onboarding/:userId/tasks', OnboardingController.getTasks);
fastify.post('/onboarding/upload', upload.single('document'), OnboardingController.uploadDocument);

};

export default routes;
