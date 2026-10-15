import { FastifyPluginAsync } from 'fastify';
import {callbackActor,CallbackError,profitabilityCommand} from './profitabilityService';
const routes:FastifyPluginAsync=async app=>{
 const route=(method:'GET'|'POST',url:string,action:string)=>app.route({method,url,bodyLimit:100000,handler:async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  try{return await profitabilityCommand(callbackActor(req.headers.authorization),action,{...(method==='GET'?req.query as object:req.body as object),...req.params as object});}
  catch(error){const e=error instanceof CallbackError?error:new CallbackError(500,'Profitability request failed');return reply.code(e.status).send({error:e.message});}
 }});
route('GET','/settings','settings_read');route('POST','/settings','settings');route('POST','/policies','policy');route('GET','/','list');route('GET','/:id','get');route('POST','/:id/costs','record');
};
export default routes;
