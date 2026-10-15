import {FastifyPluginAsync} from 'fastify';
import {callbackActor,CallbackError,catalogCommand} from './catalogService';
const routes:FastifyPluginAsync=async app=>{
 const route=(method:'GET'|'POST',url:string,action:string)=>app.route({method,url,bodyLimit:3000000,handler:async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  try{return await catalogCommand(callbackActor(req.headers.authorization),action,{...(method==='GET'?req.query as object:req.body as object),...req.params as object});}
  catch(error){const e=error instanceof CallbackError?error:new CallbackError(500,'Catalog request failed');return reply.code(e.status).send({error:e.message});}
 }});
 route('GET','/settings','settings');route('POST','/settings','settings');route('GET','/options','options');
 route('GET','/','list');route('POST','/','create');route('GET','/:id','get');route('GET','/:id/documents/:document_id','document_get');
 for(const action of ['save','document','remove_document','submit','activate','reject','withdraw','next_version'])route('POST','/:id/'+action,action);
};
export default routes;
