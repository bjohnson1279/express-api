const mPrismaClient = {
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  trainingCourse: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  employeeCertification: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import { getStaff, getCourses, assignCertification } from '../src/domains/hr/hrController';

function mockReply() {
  const res: any = {
    status: jest.fn(),
    send: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('HR Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getStaff strips passwordHash from returned staff records', async () => {
    mPrismaClient.user.findMany.mockResolvedValueOnce([
      { id: 'u-1', email: 'tech@example.com', role: 'TECHNICIAN', passwordHash: 'secret-hash', certifications: [] },
    ]);
    const reply = mockReply();
    await getStaff({ user: { tenantId: 't-1' } } as any, reply);
    expect(reply.send).toHaveBeenCalledWith([
      { id: 'u-1', email: 'tech@example.com', role: 'TECHNICIAN', certifications: [] },
    ]);
  });

  it('getCourses returns tenant-scoped courses', async () => {
    mPrismaClient.trainingCourse.findMany.mockResolvedValueOnce([{ id: 'course-1', title: 'EPA Safety' }]);
    const reply = mockReply();
    await getCourses({ user: { tenantId: 't-1' } } as any, reply);
    expect(mPrismaClient.trainingCourse.findMany).toHaveBeenCalledWith({ where: { tenantId: 't-1' } });
    expect(reply.send).toHaveBeenCalledWith([{ id: 'course-1', title: 'EPA Safety' }]);
  });

  it('assignCertification returns 404 if user or course is outside tenant, and 201 when valid', async () => {
    mPrismaClient.user.findFirst.mockResolvedValueOnce(null);
    mPrismaClient.trainingCourse.findFirst.mockResolvedValueOnce({ id: 'course-1' });
    const badReply = mockReply();
    await assignCertification({ user: { tenantId: 't-1' }, body: { userId: 'u-bad', courseId: 'course-1' } } as any, badReply);
    expect(badReply.status).toHaveBeenCalledWith(404);

    mPrismaClient.user.findFirst.mockResolvedValueOnce({ id: 'u-1' });
    mPrismaClient.trainingCourse.findFirst.mockResolvedValueOnce({ id: 'course-1' });
    mPrismaClient.employeeCertification.create.mockResolvedValueOnce({ id: 'cert-1', status: 'active' });
    const okReply = mockReply();
    await assignCertification(
      { user: { tenantId: 't-1' }, body: { userId: 'u-1', courseId: 'course-1', expiresAt: '2027-01-01' } } as any,
      okReply
    );
    expect(okReply.status).toHaveBeenCalledWith(201);
    expect(okReply.send).toHaveBeenCalledWith({ id: 'cert-1', status: 'active' });
  });
});
