export interface SharedImageTask<T>{
  promise:Promise<T>;controller:AbortController;users:number;settled:boolean
}

/** Share work across mounted consumers; cancel only after the last consumer leaves. */
export function sharedImageTask<T>(cache:Map<string,SharedImageTask<T>>,key:string,create:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'))
  let task=cache.get(key)
  if(!task||task.controller.signal.aborted){
    const controller=new AbortController()
    task={controller,users:0,settled:false,promise:Promise.resolve().then(()=>create(controller.signal))}
    const created=task
    cache.set(key,created)
    void created.promise.then(()=>{created.settled=true},()=>{
      created.settled=true
      if(cache.get(key)===created)cache.delete(key)
    })
  }
  const current=task
  current.users++
  return new Promise<T>((resolve,reject)=>{
    let released=false
    const release=()=>{
      if(released)return
      released=true;signal?.removeEventListener('abort',abort);current.users--
      // React StrictMode immediately subscribes again after its development cleanup.
      queueMicrotask(()=>{
        if(!current.users&&!current.settled){
          current.controller.abort()
          if(cache.get(key)===current)cache.delete(key)
        }
      })
    }
    const abort=()=>{release();reject(new DOMException('Aborted','AbortError'))}
    signal?.addEventListener('abort',abort,{once:true})
    current.promise.then(value=>{if(!released){release();resolve(value)}},error=>{if(!released){release();reject(error)}})
  })
}
