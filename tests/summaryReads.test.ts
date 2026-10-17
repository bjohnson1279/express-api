jest.mock('@prisma/client',()=>{const client={$queryRaw:jest.fn()};return {PrismaClient:jest.fn(()=>client)};});
jest.mock('../src/domains/crm/callbackService',()=>{class CallbackError extends Error {constructor(public status:number,message:string){super(message);}}return {CallbackError,callbackActor:jest.fn(()=>({tenantId:'signed-tenant',id:'signed-actor'}))};});
import {PrismaClient} from '@prisma/client';
import {dashboardSummary} from '../src/domains/analytics/dashboardService';
import {callbackActor,CallbackError} from '../src/domains/crm/callbackService';
const db=(PrismaClient as jest.Mock).mock.results[0].value;
beforeEach(()=>{jest.clearAllMocks();});
test('dashboard uses one aggregate query with signed identity and retains its response',async()=>{
 const summary={mrr:250,activeContractsCount:6,techLeaderboard:[]};db.$queryRaw.mockResolvedValue([{result:summary}]);
 expect(await dashboardSummary('Bearer signed')).toEqual(summary);
 expect(callbackActor).toHaveBeenCalledWith('Bearer signed');expect(db.$queryRaw).toHaveBeenCalledTimes(1);
 const [query,...params]=db.$queryRaw.mock.calls[0];expect(query.join('')).toContain('dashboard_summary');expect(params).toEqual(['signed-tenant','signed-actor']);
});
test('database authorization errors retain status without leaking SQL',async()=>{
 db.$queryRaw.mockRejectedValue({meta:{code:'P0403',message:'private SQL'}});
 await expect(dashboardSummary('Bearer signed')).rejects.toMatchObject({status:403,message:'Dashboard access denied'});
});
test('authentication failure never reaches the database',async()=>{
 (callbackActor as jest.Mock).mockImplementationOnce(()=>{throw new CallbackError(401,'Invalid token');});
 await expect(dashboardSummary()).rejects.toMatchObject({status:401});expect(db.$queryRaw).not.toHaveBeenCalled();
});
