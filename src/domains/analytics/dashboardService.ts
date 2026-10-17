import { PrismaClient } from '../../shared/database';
import { callbackActor, CallbackError } from '../crm/callbackService';
const prisma = new PrismaClient();
export async function dashboardSummary(authorization?: string) {
  const actor=callbackActor(authorization);
  try {
    const rows=await prisma.$queryRaw<{result:unknown}[]>`SELECT dashboard_summary(${actor.tenantId}::uuid,${actor.id}::uuid) AS result`;
    return rows[0].result;
  } catch(error:any) {
    const status=({P0401:401,P0403:403} as Record<string,number>)[error?.meta?.code]||500;
    throw new CallbackError(status,status===500?'Dashboard unavailable':'Dashboard access denied');
  }
}
