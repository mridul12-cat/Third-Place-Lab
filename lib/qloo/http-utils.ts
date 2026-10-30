/** Bounds body reads even when Content-Length is absent or inaccurate. */
export class BodyTooLargeError extends Error {}
export async function abortable<T>(operation:Promise<T>,signal?:AbortSignal):Promise<T> {
 if(!signal)return operation;
 if(signal.aborted){void operation.catch(()=>{});signal.throwIfAborted();}
 let listener:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{listener=()=>reject(signal.reason??new DOMException('Aborted','AbortError'));signal.addEventListener('abort',listener,{once:true});});
 try{return await Promise.race([operation,cancelled]);}finally{signal.removeEventListener('abort',listener);}
}
export async function readBoundedJson(body:ReadableStream<Uint8Array>|null,limit:number,signal?:AbortSignal):Promise<unknown> {
 if(!body)throw new SyntaxError('Missing JSON body.');
 const reader=body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
 try{for(;;){const {done,value}=await abortable(reader.read(),signal);if(done)break;bytes+=value.byteLength;if(bytes>limit)throw new BodyTooLargeError('Body exceeds size limit.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}catch(error){void reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
