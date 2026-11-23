import { FastifyPluginAsync } from 'fastify';
import { callbackActor, CallbackError, inspectionCommand } from './inspectionService';
const routes:FastifyPluginAsync=async app=>{
 const route=(method:'GET'|'POST',url:string,action:string)=>app.route({
  method,url,bodyLimit:1500000,handler:async(req,reply)=>{
   reply.header('Cache-Control','no-store');
   try {return await inspectionCommand(callbackActor(req.headers.authorization),action,{...(method==='GET'?req.query as object:req.body as object),...req.params as object});}
   catch(error){const e=error instanceof CallbackError?error:new CallbackError(500,'Inspection operation failed');return reply.code(e.status).send({error:e.message});}
  }
 });
 route('GET','/settings','settings');route('POST','/settings','settings');route('GET','/options','options');
 route('GET','/','list');route('POST','/','create');route('GET','/:id','get');
 route('GET','/:id/attachments/:attachment_id','attachment_get');
 for(const action of ['start','save','submit','review','cancel','attachment','propose_treatment'])route('POST','/:id/'+action,action);
};
export default routes;
