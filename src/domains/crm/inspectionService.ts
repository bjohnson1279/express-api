import { PrismaClient } from '../../shared/database';
import { callbackActor, CallbackActor, CallbackError } from './callbackService';
const prisma = new PrismaClient();
export { callbackActor, CallbackError };
export async function inspectionCommand(actor: CallbackActor, action: string, body: Record<string, unknown> = {}) {
  try {
    const rows = await prisma.$queryRaw<{result:unknown}[]>`SELECT inspection_api(${action}::text,${actor.tenantId}::uuid,${actor.id}::uuid,${JSON.stringify(body)}::jsonb) AS result`;
    return rows[0].result;
  } catch(error:any) {
    const code=error?.meta?.code;
    const status=({P0400:400,P0401:401,P0403:403,P0404:404,P0409:409,P0503:503} as Record<string,number>)[code] || (['22P02','22007','22023','23502','23514'].includes(code)?400:code==='23505'?409:500);
    throw new CallbackError(status,status===500?'Inspection operation failed':(error?.meta?.message||'Invalid inspection request').replace(/^ERROR:\s*/,''));
  }
}
