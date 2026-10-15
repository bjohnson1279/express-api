import { FastifyRequest, FastifyReply } from 'fastify';
import { callbackActor, CallbackError, jobCommand, camelJob } from './jobService';
const handler=(action:string)=>async(req:FastifyRequest,reply:FastifyReply)=>{
 try {
  const id=(req.params as any).id;
  const body=action==='list'?{technician_id:id}:action==='location'?{...(req.body as any),id}:{};
  const value=await jobCommand(callbackActor(req.headers.authorization),action,body);
  return reply.send(camelJob(action==='list'?value.filter((j:any)=>!['completed','cancelled'].includes(j.status)):value));
 } catch(error) {
  const e=error instanceof CallbackError?error:new CallbackError(500,'Technician operation failed');
  return reply.status(e.status).send({error:e.message});
 }
};
export const getTechnicians=handler('technicians');
export const getTechnicianSchedule=handler('list');
export const updateLocation=handler('location');
