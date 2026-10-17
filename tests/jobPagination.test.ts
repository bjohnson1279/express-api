jest.mock('@prisma/client',()=>{const client={$queryRaw:jest.fn()};return {PrismaClient:jest.fn(()=>client)};});
import {PrismaClient} from '@prisma/client';
import {createHmac} from 'node:crypto';
import {getJobs,getJobsCalendar} from '../src/domains/dispatch/jobController';
import {getTechnicianSchedule} from '../src/domains/dispatch/technicianController';
const db=(PrismaClient as jest.Mock).mock.results[0].value;
function auth(){const encode=(v:any)=>Buffer.from(JSON.stringify(v)).toString('base64url');const s=encode({alg:'HS256'})+'.'+encode({id:'11111111-1111-4111-8111-111111111111',tenantId:'22222222-2222-4222-8222-222222222222',role:'MANAGER',exp:Date.now()/1000+600});return 'Bearer '+s+'.'+createHmac('sha256','page-test-key').update(s).digest('base64url');}
function reply(){const r:any={header:jest.fn(),set:jest.fn(),send:jest.fn(),json:jest.fn(),status:jest.fn()};r.status.mockReturnValue(r);return r;}
beforeEach(()=>{process.env.JWT_SECRET='page-test-key';jest.clearAllMocks();db.$queryRaw.mockResolvedValue([{result:{items:[{id:'one',scheduled_start:'2026-11-01'}],has_more:true,next_cursor:'next',limit:10}}]);});
test('list delegates to bounded SQL and exposes cursor metadata with the array body',async()=>{
 const r=reply();await getJobs({headers:{authorization:auth()},query:{limit:'10',cursor:'prior'},params:{}} as any,r);
 const call=db.$queryRaw.mock.calls[0];expect(call[0].join('')).toContain('job_page');expect(JSON.parse(call[4])).toMatchObject({limit:'10',cursor:'prior'});
 expect((r.send.mock.calls[0]||r.json.mock.calls[0])[0]).toEqual([{id:'one',scheduledStart:'2026-11-01'}]);
 expect(r.header.mock.calls.some(([k,v]:any)=>k==='X-Next-Cursor'&&v==='next')||r.set.mock.calls.some(([v]:any)=>v['X-Next-Cursor']==='next')).toBe(true);
});
test('calendar preserves visible range and uses the calendar projection',async()=>{
 const r=reply();await getJobsCalendar({headers:{authorization:auth()},query:{from:'2026-11-01',through:'2026-12-01'},params:{}} as any,r);
 expect(db.$queryRaw.mock.calls[0][1]).toBe('calendar');expect(JSON.parse(db.$queryRaw.mock.calls[0][4])).toMatchObject({from:'2026-11-01',through:'2026-12-01'});
});
test('schedule forces the requested technician and filters active states before paging',async()=>{
 await getTechnicianSchedule({headers:{authorization:auth()},query:{technician_id:'spoof',cursor:'prior'},params:{id:'path-tech'}} as any,reply());
 expect(JSON.parse(db.$queryRaw.mock.calls[0][4])).toMatchObject({technician_id:'path-tech',status:'scheduled,in_progress',cursor:'prior'});
});
test('missing authentication never reaches the database',async()=>{
 const r=reply();await getJobs({headers:{},query:{},params:{}} as any,r);expect(r.status).toHaveBeenCalledWith(401);expect(db.$queryRaw).not.toHaveBeenCalled();
});
