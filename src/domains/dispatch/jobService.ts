import { callbackActor, CallbackError, CallbackActor } from '../crm/callbackService';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export { callbackActor, CallbackError };
export function normalizeJobBody(body: Record<string, any> = {}) {
  const aliases: Record<string,string> = { jobIds:'job_ids',jobId:'job_id',startLat:'start_lat',startLng:'start_lng',tenantId:'tenant_id',customerId:'customer_id',propertyId:'property_id',technicianId:'technician_id',scheduledStart:'scheduled_start',scheduledEnd:'scheduled_end',contractId:'contract_id' };
  return Object.fromEntries(Object.entries(body).map(([key,value])=>[aliases[key]||key,value]));
}
export async function jobCommand(actor: CallbackActor, action: string, body: Record<string, any> = {}) {
  try {
    const rows = await prisma.$queryRaw<{result:any}[]>`SELECT job_api(${action}::text,${actor.tenantId}::uuid,${actor.id}::uuid,${JSON.stringify(normalizeJobBody(body))}::jsonb) AS result`;
    return rows[0].result;
  } catch (error: any) {
    const code=error?.meta?.code;
    const status=({P0400:400,P0401:401,P0403:403,P0404:404,P0409:409} as Record<string,number>)[code] || (['22P02','22007','23502','23514'].includes(code)?400:500);
    throw new CallbackError(status,status===500?'Job operation failed':(error?.meta?.message||'Invalid job request').replace(/^ERROR:\s*/,''));
  }
}
export function camelJob(value: any): any {
  if (Array.isArray(value)) return value.map(camelJob);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),camelJob(v)]));
  return value;
}
export function jobCalendar(jobs: any[]) {
  return jobs.filter(j=>j.scheduled_start).map(j=>({
    id:j.id,title:`${j.purpose==='return_visit'?'Return visit: ':''}${j.customer.name} - ${j.property.address}`,
    start:j.scheduled_start,end:j.scheduled_end||new Date(new Date(j.scheduled_start).getTime()+3600000).toISOString(),
    status:j.status,color:({completed:'#10b981',invoiced:'#10b981',in_progress:'#f59e0b',cancelled:'#ef4444'} as Record<string,string>)[j.status]||'#3b82f6'
  }));
}
