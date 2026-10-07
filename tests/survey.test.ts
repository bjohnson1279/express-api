jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    survey: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    notificationQueue: {
      create: jest.fn(),
    },
    surveyResponse: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mPrismaClient),
  };
});

import request from 'supertest';
import fastify from 'fastify';
import surveyRoutes from '../src/domains/crm/surveyRoutes';
import { PrismaClient } from '@prisma/client';

const prisma = new (PrismaClient as any)();

let fastifyApp: ReturnType<typeof fastify>;
let app: any;

beforeAll(async () => {
  fastifyApp = fastify();
  fastifyApp.register(surveyRoutes, { prefix: '/api/v1/surveys' });
  await fastifyApp.ready();
  app = fastifyApp.server;
});

afterAll(async () => {
  await fastifyApp.close();
});

describe('Survey API Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/surveys', () => {
    it('should return a list of surveys', async () => {
      const mockSurveys = [
        { id: 'survey-1', status: 'sent', customer: { name: 'Customer A' }, technician: null },
        { id: 'survey-2', status: 'completed', customer: { name: 'Customer B' }, technician: null },
      ];
      prisma.survey.findMany.mockResolvedValue(mockSurveys);

      const res = await request(app).get('/api/v1/surveys');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockSurveys);
      expect(prisma.survey.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when database query fails', async () => {
      prisma.survey.findMany.mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/api/v1/surveys');

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/v1/surveys/:id', () => {
    it('should return survey details for a valid id', async () => {
      const mockSurvey = {
        id: 'survey-1',
        status: 'sent',
        customer: { name: 'Jane Doe' },
        technician: { user: { firstName: 'John', lastName: 'Tech' } },
        job: { scheduledStart: '2026-10-01T10:00:00Z', status: 'completed' },
        response: null,
      };
      prisma.survey.findUnique.mockResolvedValue(mockSurvey);

      const res = await request(app).get('/api/v1/surveys/survey-1');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockSurvey);
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: 'survey-1' },
        include: {
          response: true,
          customer: { select: { name: true } },
          technician: { select: { user: { select: { firstName: true, lastName: true } } } },
          job: { select: { scheduledStart: true, status: true } },
        },
      });
    });

    it('should return 404 when survey is not found', async () => {
      prisma.survey.findUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/surveys/survey-999');

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Survey not found' });
    });

    it('should return 500 on database failure', async () => {
      prisma.survey.findUnique.mockRejectedValue(new Error('Database error'));

      const res = await request(app).get('/api/v1/surveys/survey-1');

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/v1/surveys', () => {
    it('should create survey and queue SMS and email notifications', async () => {
      const createdSurvey = {
        id: 'survey-100',
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        jobId: 'job-1',
        technicianId: 'tech-1',
        status: 'sent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      prisma.survey.create.mockResolvedValue(createdSurvey);

      const customerRecord = {
        id: 'customer-1',
        phones: [{ phoneNumber: '+1234567890' }],
        emails: [{ emailAddress: 'client@example.com' }],
        user: { email: 'client@example.com' },
      };
      prisma.customer.findUnique.mockResolvedValue(customerRecord);
      prisma.notificationQueue.create.mockResolvedValue({ id: 'notif-1' });

      const res = await request(app).post('/api/v1/surveys').send({
        tenantId: 'tenant-1',
        customerId: 'customer-1',
        jobId: 'job-1',
        technicianId: 'tech-1',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.id).toBe('survey-100');
      expect(prisma.survey.create).toHaveBeenCalledTimes(1);
      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        include: { user: true, phones: true, emails: true },
      });
      // Both SMS and EMAIL queued
      expect(prisma.notificationQueue.create).toHaveBeenCalledTimes(2);
    });

    it('should create survey when customer is not found without queuing notifications', async () => {
      const createdSurvey = {
        id: 'survey-101',
        tenantId: 'tenant-1',
        customerId: 'customer-2',
        jobId: null,
        technicianId: null,
        status: 'sent',
      };
      prisma.survey.create.mockResolvedValue(createdSurvey);
      prisma.customer.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/surveys').send({
        tenantId: 'tenant-1',
        customerId: 'customer-2',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.id).toBe('survey-101');
      expect(prisma.notificationQueue.create).not.toHaveBeenCalled();
    });

    it('should return 500 when survey creation fails', async () => {
      prisma.survey.create.mockRejectedValue(new Error('Insert error'));

      const res = await request(app).post('/api/v1/surveys').send({
        tenantId: 'tenant-1',
        customerId: 'customer-1',
      });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/v1/surveys/:id/respond', () => {
    it('should submit response and mark survey completed', async () => {
      const activeSurvey = {
        id: 'survey-1',
        response: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      };
      prisma.survey.findUnique.mockResolvedValue(activeSurvey);

      const createdResponse = {
        id: 'response-1',
        surveyId: 'survey-1',
        npsScore: 9,
        comments: 'Great service!',
      };
      prisma.surveyResponse.create.mockResolvedValue(createdResponse);
      prisma.survey.update.mockResolvedValue({ ...activeSurvey, status: 'completed' });

      const res = await request(app).post('/api/v1/surveys/survey-1/respond').send({
        npsScore: 9,
        comments: 'Great service!',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(createdResponse);
      expect(prisma.surveyResponse.create).toHaveBeenCalledWith({
        data: {
          surveyId: 'survey-1',
          npsScore: 9,
          comments: 'Great service!',
        },
      });
      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: 'survey-1' },
        data: { status: 'completed' },
      });
    });

    it('should return 400 when npsScore is invalid or missing', async () => {
      // Missing score
      let res = await request(app).post('/api/v1/surveys/survey-1/respond').send({ comments: 'Fine' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('NPS score must be between 0 and 10');

      // Score > 10
      res = await request(app).post('/api/v1/surveys/survey-1/respond').send({ npsScore: 11 });
      expect(res.statusCode).toBe(400);

      // Score < 0
      res = await request(app).post('/api/v1/surveys/survey-1/respond').send({ npsScore: -1 });
      expect(res.statusCode).toBe(400);
    });

    it('should return 404 when survey does not exist', async () => {
      prisma.survey.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/surveys/missing-survey/respond').send({
        npsScore: 8,
      });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Survey not found');
    });

    it('should return 409 when survey is already responded', async () => {
      prisma.survey.findUnique.mockResolvedValue({
        id: 'survey-1',
        response: { id: 'existing-response' },
      });

      const res = await request(app).post('/api/v1/surveys/survey-1/respond').send({
        npsScore: 8,
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('Survey already responded');
    });

    it('should return 410 when survey has expired', async () => {
      prisma.survey.findUnique.mockResolvedValue({
        id: 'survey-1',
        response: null,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      });

      const res = await request(app).post('/api/v1/surveys/survey-1/respond').send({
        npsScore: 8,
      });

      expect(res.statusCode).toBe(410);
      expect(res.body.error).toBe('Survey has expired');
    });

    it('should return 500 when saving response fails', async () => {
      prisma.survey.findUnique.mockResolvedValue({
        id: 'survey-1',
        response: null,
        expiresAt: null,
      });
      prisma.surveyResponse.create.mockRejectedValue(new Error('DB failure'));

      const res = await request(app).post('/api/v1/surveys/survey-1/respond').send({
        npsScore: 8,
      });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/v1/surveys/nps-dashboard', () => {
    it('should compute NPS metrics, technician scores, and recent feedback', async () => {
      const now = new Date();
      const mockResponses = [
        {
          npsScore: 10,
          comments: 'Super professional!',
          respondedAt: now,
          survey: {
            customer: { name: 'Alice' },
            technician: { id: 'tech-1', user: { firstName: 'Bob', lastName: 'Tech' } },
          },
        },
        {
          npsScore: 8,
          comments: 'Good job overall.',
          respondedAt: now,
          survey: {
            customer: { name: 'Bob' },
            technician: { id: 'tech-1', user: { firstName: 'Bob', lastName: 'Tech' } },
          },
        },
        {
          npsScore: 5,
          comments: 'Arrived late.',
          respondedAt: now,
          survey: {
            customer: { name: 'Charlie' },
            technician: { id: 'tech-2', user: { firstName: 'Dave', lastName: 'Tech' } },
          },
        },
      ];
      prisma.surveyResponse.findMany.mockResolvedValue(mockResponses);

      const res = await request(app).get('/api/v1/surveys/nps-dashboard');

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.promoters).toBe(1);
      expect(res.body.passives).toBe(1);
      expect(res.body.detractors).toBe(1);
      // NPS = Math.round(((1 - 1) / 3) * 100) = 0
      expect(res.body.npsScore).toBe(0);
      // Average score = (10 + 8 + 5) / 3 = 7.666 -> 7.7
      expect(res.body.avgScore).toBe(7.7);
      expect(res.body.technicianScores).toHaveLength(2);
      expect(res.body.technicianScores[0].name).toBe('Bob Tech');
      expect(res.body.technicianScores[0].avgScore).toBe(9);
      expect(res.body.technicianScores[0].count).toBe(2);
      expect(res.body.recentFeedback).toHaveLength(3);
    });

    it('should return default values when there are no responses', async () => {
      prisma.surveyResponse.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/surveys/nps-dashboard');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        npsScore: 0,
        avgScore: 0,
        total: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        technicianScores: [],
        recentFeedback: [],
      });
    });

    it('should return 500 when database query fails', async () => {
      prisma.surveyResponse.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/v1/surveys/nps-dashboard');

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });
});
