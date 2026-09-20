"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignCertification = exports.getCourses = exports.getStaff = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getStaff = async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: {
                role: { not: 'CUSTOMER' }
            },
            include: {
                certifications: {
                    include: { course: true }
                },
                commissions: true
            },
            orderBy: { email: 'asc' }
        });
        res.json(staff);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getStaff = getStaff;
const getCourses = async (req, res) => {
    try {
        const courses = await prisma.trainingCourse.findMany();
        res.json(courses);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCourses = getCourses;
const assignCertification = async (req, res) => {
    try {
        const { userId, courseId, expiresAt } = req.body;
        const cert = await prisma.employeeCertification.create({
            data: {
                userId,
                courseId,
                completedAt: new Date(),
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                status: 'active'
            },
            include: { course: true }
        });
        res.status(201).json(cert);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.assignCertification = assignCertification;
