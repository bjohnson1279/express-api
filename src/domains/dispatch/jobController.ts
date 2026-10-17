import { FastifyRequest, FastifyReply } from 'fastify';
import { callbackActor, CallbackError, jobCommand, camelJob, jobCalendar, pageHeaders } from './jobService';
const handler = (action: string, calendar=false) => async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = ['list','calendar'].includes(action) ? {...(req.query as any)} : {...(req.body as any),...(req.params as any)};
    const result=await jobCommand(callbackActor(req.headers.authorization),action,body);
    if (['list','calendar'].includes(action)) {
      for (const [name,value] of Object.entries(pageHeaders(result))) reply.header(name,value);
      return reply.send(camelJob(result.items));
    }
    return reply.status(action==='create'?201:200).send(calendar?jobCalendar(result):camelJob(result));
  } catch(error) {
    const e=error instanceof CallbackError?error:new CallbackError(500,'Job operation failed');
    return reply.status(e.status).send({error:e.message});
  }
};
export const getJobs=handler('list');
export const getJobsCalendar=handler('calendar',true);
export const createJob=handler('create');
export const updateJob=handler('update');
export const clockIn=handler('clock_in');
export const clockOut=handler('clock_out');
