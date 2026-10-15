import { FastifyPluginAsync } from 'fastify';
import {callbackActor,CallbackError,commercialCommand} from './commercialService';
const routes:FastifyPluginAsync=async app=>{
 const route=(method:'GET'|'POST',url:string,action:string)=>app.route({method,url,bodyLimit:100000,handler:async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  try{return await commercialCommand(callbackActor(req.headers.authorization),action,{...(method==='GET'?req.query as object:req.body as object),...req.params as object});}
  catch(error){const e=error instanceof CallbackError?error:new CallbackError(500,'Commercial request failed');return reply.code(e.status).send({error:e.message});}
 }});
route('GET','/settings','settings_read');
route('POST','/settings','settings');
route('GET','/options','options');
route('GET','/','list');
route('POST','/','create');
route('GET','/:id','get');
route('POST','/:id','update');
route('POST','/:id/archive','archive');
route('POST','/:id/reopen','reopen');
route('GET','/:id/sites','sites');
route('POST','/:id/sites','link_site');
route('GET','/:id/sites/:site_id','site_get');
route('POST','/:id/sites/:site_id','update_site');
route('POST','/:id/sites/:site_id/archive','archive_site');
route('POST','/:id/sites/:site_id/reopen','reopen_site');
route('GET','/:id/contacts','contacts');
route('POST','/:id/contacts','save_contact');
route('POST','/:id/contacts/:contact_id','save_contact');
route('POST','/:id/contacts/:contact_id/archive','archive_contact');
route('GET','/:id/events','events');
};
export default routes;
