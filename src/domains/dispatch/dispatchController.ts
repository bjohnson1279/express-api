import { FastifyRequest, FastifyReply } from 'fastify';
import { callbackActor, CallbackError, jobCommand, camelJob } from './jobService';
const handler=(action:string)=>async(req:FastifyRequest,reply:FastifyReply)=>{
 try { return reply.send(camelJob(await jobCommand(callbackActor(req.headers.authorization),action,req.body as any))); }
 catch(error) { const e=error instanceof CallbackError?error:new CallbackError(500,'Dispatch operation failed');return reply.status(e.status).send({error:e.message}); }
};
export const optimizeRoute=handler('optimize');
export const emergencyDispatch=handler('emergency');
export const autoSchedule=handler('auto_schedule');
export const commitSchedule=handler('commit_schedule');
