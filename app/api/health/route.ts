export const runtime='nodejs';
export const dynamic='force-dynamic';
import { qlooEnvironment, selectProvider } from '../../../lib/qloo/select';
export function GET(){
 const mode=qlooEnvironment().QLOO_MODE??'mock';let configured=false;
 try{selectProvider();configured=true;}catch{/* Configuration validation only; never execute an upstream call. */}
 return Response.json({status:configured?'ok':'unavailable',mode,configured,liveVerified:false},{status:configured?200:503,headers:{'Cache-Control':'no-store'}});
}
