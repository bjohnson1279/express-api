import { FastifyPluginAsync } from 'fastify';
import {callbackActor,CallbackError,deviceCommand} from './deviceService';
const routes:FastifyPluginAsync=async app=>{
 const route=(method:'GET'|'POST',url:string,action:string)=>app.route({method,url,bodyLimit:100000,handler:async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  try{return await deviceCommand(callbackActor(req.headers.authorization),action,{...(method==='GET'?req.query as object:req.body as object),...req.params as object});}
  catch(error){const e=error instanceof CallbackError?error:new CallbackError(500,'Device request failed');return reply.code(e.status).send({error:e.message});}
 }});
 route('GET','/settings','settings');route('POST','/settings','settings');route('GET','/options','options');route('GET','/lookup','lookup');
 route('GET','/','list');route('POST','/','create');route('GET','/:id','get');
 for(const action of ['install','relocate','retire','replace'])route('POST','/:id/'+action,action);
};
export default routes;
