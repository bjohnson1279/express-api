import { FastifyPluginAsync } from 'fastify';
import {callbackActor,CallbackError,recurringCommand} from './recurringService';
const routes:FastifyPluginAsync=async app=>{
 const route=(method:'GET'|'POST',url:string,action:string)=>app.route({method,url,bodyLimit:100000,handler:async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  try{return await recurringCommand(callbackActor(req.headers.authorization),action,{...(method==='GET'?req.query as object:req.body as object),...req.params as object});}
  catch(error){const e=error instanceof CallbackError?error:new CallbackError(500,'Recurring request failed');return reply.code(e.status).send({error:e.message});}
 }});
route('GET','/settings','settings_read');route('POST','/settings','settings');route('POST','/assess','assess');route('GET','/','list');route('GET','/:id','get');
};
export default routes;
