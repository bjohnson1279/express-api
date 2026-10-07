"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitSchedule = exports.autoSchedule = exports.emergencyDispatch = exports.optimizeRoute = void 0;
const client_1 = require("@prisma/client");
const eventBus_1 = require("../comms/eventBus");
const prisma = new client_1.PrismaClient();
// Haversine distance formula approximation in miles
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of the earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
// Dummy geocoder for MVP
function geocodeProperty(property) {
    // Mock lat/lng based on string length to give pseudo-random deterministic locations
    const len = property?.address?.length || 10;
    return {
        lat: 34.0522 + (len * 0.01),
        lng: -118.2437 - (len * 0.01)
    };
}
const optimizeRoute = async (req, reply) => {
    try {
        const { jobIds, startLat, startLng } = req.body;
        const jobs = await prisma.job.findMany({
            where: { id: { in: jobIds } },
            include: { property: true }
        });
        if (!startLat || !startLng) {
            return reply.send(jobs);
        }
        let currentLocation = { lat: startLat, lng: startLng };
        let unvisited = [...jobs];
        let route = [];
        while (unvisited.length > 0) {
            let nearestIdx = 0;
            let minDistance = Infinity;
            for (let i = 0; i < unvisited.length; i++) {
                const propCoords = geocodeProperty(unvisited[i].property);
                const dist = getDistance(currentLocation.lat, currentLocation.lng, propCoords.lat, propCoords.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestIdx = i;
                }
            }
            const nextJob = unvisited[nearestIdx];
            route.push(nextJob);
            const nextCoords = geocodeProperty(nextJob.property);
            currentLocation = { lat: nextCoords.lat, lng: nextCoords.lng };
            unvisited.splice(nearestIdx, 1);
        }
        reply.send(route);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.optimizeRoute = optimizeRoute;
const emergencyDispatch = async (req, reply) => {
    try {
        const { propertyId, jobId } = req.body;
        const property = await prisma.property.findUnique({
            where: { id: propertyId }
        });
        if (!property) {
            return reply.status(400).json({ error: 'Property not found' });
        }
        const propCoords = geocodeProperty(property);
        const technicians = await prisma.technician.findMany({
            where: { status: client_1.TechStatus.available },
            include: { user: true }
        });
        let nearestTech = null;
        let minDistance = Infinity;
        for (const tech of technicians) {
            if (tech.currentLocationLat && tech.currentLocationLng) {
                const dist = getDistance(propCoords.lat, propCoords.lng, tech.currentLocationLat.toNumber(), tech.currentLocationLng.toNumber());
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestTech = tech;
                }
            }
        }
        if (!nearestTech) {
            return reply.status(404).json({ error: 'No available technicians found nearby' });
        }
        const updatedJob = await prisma.job.update({
            where: { id: jobId },
            data: {
                technicianId: nearestTech.id,
                status: 'scheduled'
            }
        });
        eventBus_1.eventBus.broadcast('job_assigned', updatedJob);
        reply.send({
            message: `Emergency dispatch assigned to ${nearestTech.user.firstName} ${nearestTech.user.lastName}`,
            technician: nearestTech,
            job: updatedJob,
            distance: minDistance
        });
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.emergencyDispatch = emergencyDispatch;
const autoSchedule = async (req, reply) => {
    try {
        const unassignedJobs = await prisma.job.findMany({ where: { technicianId: null, status: 'draft' } });
        const techs = await prisma.technician.findMany({ where: { status: 'available' } });
        const schedule = unassignedJobs.map((job, idx) => ({
            jobId: job.id,
            technicianId: techs[idx % techs.length]?.id || null,
            estimatedDriveTimeMins: 15
        }));
        reply.send(schedule);
    }
    catch (err) {
        reply.status(500).json({ error: 'Failed' });
    }
};
exports.autoSchedule = autoSchedule;
const commitSchedule = async (req, reply) => {
    try {
        const { schedule } = req.body;
        for (const item of schedule) {
            if (item.technicianId) {
                await prisma.job.update({
                    where: { id: item.jobId },
                    data: { technicianId: item.technicianId, status: 'scheduled' }
                });
            }
        }
        reply.send({ success: true });
    }
    catch (err) {
        reply.status(500).json({ error: 'Failed' });
    }
};
exports.commitSchedule = commitSchedule;
