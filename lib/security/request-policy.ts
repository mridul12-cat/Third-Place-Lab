import { isIP } from 'node:net';
import { ProviderError } from '../qloo/provider';
import { getReleaseContext } from './release-context';

/** Canonical server configuration, never forwarded Host/Proto supplied by a caller. */
export function planningRequestPolicy(request:Request,env:Record<string,string|undefined>=process.env){
 const release=getReleaseContext(),config=release?.env??env;
 const production=release?.production===true||env.NODE_ENV==='production';
 let expected:string;
 if(config.APP_ORIGIN){
  let url:URL;try{url=new URL(config.APP_ORIGIN);}catch{throw new ProviderError('Configure a valid application origin.',503);}
  const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||(production&&url.protocol!=='https:'&&!loopback))throw new ProviderError('Configure a valid application origin.',503);
  expected=url.origin;
 }else{
  if(production)throw new ProviderError('Production planning requires APP_ORIGIN.',503);
  expected=new URL(request.url).origin;
 }
 const origin=request.headers.get('origin');
 if(origin!==null&&origin!==expected)throw new ProviderError('Cross-origin requests are not allowed.',403);
 // Only deployment-owned context/env selects a trusted edge. Caller headers cannot.
 const ip=release?.production===true?request.headers.get('cf-connecting-ip')
  :env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for'):null;
 return {client:ip&&ip.length<=64&&isIP(ip)?ip:'shared',origin:expected};
}
