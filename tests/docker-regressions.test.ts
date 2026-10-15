import fastify from 'fastify';
import multipart from '@fastify/multipart';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { saveMultipartUpload } from '../src/shared/multipartUpload';
import { RoutingService } from '../src/domains/dispatch/RoutingService';
import { exportReport } from '../src/domains/analytics/analyticsController';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    chemicalApplicationLog: { findMany: jest.fn().mockResolvedValue([
      { chemicalName: 'Verified product', quantityUsed: 2, unit: 'oz',
        appliedAt: new Date('2026-01-01'), job: { customer: { name: 'Customer' } } }
    ]) }
  }))
}));

test('CSV and PDF replies stream successfully; chemical reports use application logs', async () => {
  const app = fastify();
  app.get('/report', exportReport);
  try {
    const csv = await app.inject('/report?type=chemicals');
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-disposition']).toContain('chemicals-report.csv');
    expect(csv.body).toContain('Verified product');
    const pdf = await app.inject('/report?format=pdf');
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 4)).toBe('%PDF');
  } finally { await app.close(); }
});

test('multipart consumes fields after the file and prevents filename traversal', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crm-upload-'));
  const app = fastify();
  await app.register(multipart);
  app.post('/upload', async req => saveMultipartUpload(req, 'photo', directory));
  try {
    const body = '--boundary\r\nContent-Disposition: form-data; name="photo"; filename="../../escape.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n'
      + '--boundary\r\nContent-Disposition: form-data; name="caption"\r\n\r\nafter file\r\n--boundary--\r\n';
    const response = await app.inject({ method: 'POST', url: '/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=boundary' }, payload: body });
    expect(response.statusCode).toBe(200);
    const file = response.json();
    expect(file.fields.caption).toBe('after file');
    expect(path.dirname(file.filepath)).toBe(directory);
    expect(await readFile(file.filepath, 'utf8')).toBe('hello');
    const empty = await app.inject({ method: 'POST', url: '/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=boundary' }, payload: '--boundary--\r\n' });
    expect(empty.statusCode).toBe(400);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('routing uses fetch JSON and orders waypoints', async () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    code: 'Ok', waypoints: [{ waypoint_index: 1 }, { waypoint_index: 0 }],
    trips: [{ duration: 3, distance: 4, geometry: 'polyline' }]
  }) });
  global.fetch = mockFetch;
  try {
    const result = await new RoutingService().optimizeRoute([[1, 2], [3, 4]]);
    expect(result.sequence[0].waypoint_index).toBe(0);
    expect(result.distance).toBe(4);
    expect(mockFetch.mock.calls[0][0]).toContain('router.project-osrm.org/trip/');
  } finally { global.fetch = originalFetch; }
});
