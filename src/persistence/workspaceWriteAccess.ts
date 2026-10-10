import {AppError} from '../i18n/runtime.ts'
import {boardMembers} from '../domain/medalExhibit.ts'
import type {Board} from '../domain/model'
import type {SeasonBoardSession} from './seasonStore'

export type WorkspaceAccessState='pending'|'writable'|'read-only'|'unsupported'
export const WORKSPACE_WRITE_LOCK='racememoir-workspace-writer-v1'
type RequestLock=(name:string,options:{ifAvailable:true},callback:(lock:unknown|null)=>Promise<void>)=>Promise<unknown>

/** A lifetime lease keeps synchronous pagehide saves and IndexedDB mutations under
 * the same cross-tab lock. It is released only after in-flight writes finish. */
export class WorkspaceWriteAccess{
  private state:WorkspaceAccessState='pending'
  private listeners=new Set<(state:WorkspaceAccessState)=>void>()
  private users=0
  private writes=0
  private started=false
  private closing=false
  private yielding=false
  private releaseLease?:()=>void
  private acquisition?:Promise<boolean>
  private resolveReady!:()=>void
  readonly ready=new Promise<void>(resolve=>{this.resolveReady=resolve})
  private readonly request?:RequestLock
  constructor(request?:RequestLock){this.request=request}
  get status(){return this.state}
  get writable(){return this.state==='writable'&&!this.closing&&!this.yielding}
  subscribe(listener:(state:WorkspaceAccessState)=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  private publish(state:WorkspaceAccessState){this.state=state;this.listeners.forEach(listener=>listener(state));this.resolveReady()}
  retain(){
    this.users++
    if(!this.started){this.started=true;void this.tryAcquire()}
    return()=>{
      this.users--
      // StrictMode tears down and reattaches effects within the same turn.
      queueMicrotask(()=>{if(!this.users){this.closing=true;this.finish()}})
    }
  }
  /** Retry on explicit exit from viewing, without waiting for another page to close. */
  tryAcquire():Promise<boolean>{
    if(this.writable)return Promise.resolve(true)
    if(this.closing||this.yielding||!this.users)return Promise.resolve(false)
    if(this.acquisition)return this.acquisition
    let settle!:(acquired:boolean)=>void
    const attempt=new Promise<boolean>(resolve=>{settle=resolve})
    this.acquisition=attempt
    void this.acquire(settle)
    void attempt.then(()=>{if(this.acquisition===attempt)this.acquisition=undefined})
    return attempt
  }
  relinquish(){
    this.yielding=true
    if(!this.closing)this.publish('read-only')
    this.finish()
  }
  private async acquire(settle:(acquired:boolean)=>void){
    const request=this.request??(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request.bind(navigator.locks):undefined)
    if(!request){this.publish('unsupported');settle(false);return}
    try{
      await request(WORKSPACE_WRITE_LOCK,{ifAvailable:true},async lock=>{
        if(this.closing){this.resolveReady();settle(false);return}
        if(!lock){this.publish('read-only');settle(false);return}
        await new Promise<void>(resolve=>{this.releaseLease=resolve;this.publish('writable');settle(true);this.finish()})
      })
    }catch{this.publish('unsupported');settle(false)}
  }
  assertWritable(){if(!this.writable)throw new AppError(this.state==='unsupported'?'saveConflict.unsupported':'saveConflict.readOnly')}
  async run<T>(task:()=>Promise<T>):Promise<T>{
    await this.ready
    this.assertWritable();this.writes++
    try{return await task()}finally{this.writes--;this.finish()}
  }
  private finish(){
    if((this.closing||this.yielding)&&!this.writes){
      const release=this.releaseLease;this.releaseLease=undefined;this.yielding=false;release?.()
    }
  }
}

export interface RecordWriteGuard{
  ready:Promise<void>
  readonly writable:boolean
  run:<T>(task:()=>Promise<T>,deleting?:readonly string[])=>Promise<T>
  initialize:<T>(task:()=>Promise<T>)=>Promise<T>
}

export function createRecordWriteGuard(access:WorkspaceWriteAccess,session:SeasonBoardSession,latest:()=>Board,onConflict:()=>void=()=>{}):RecordWriteGuard{
  const run=<T>(task:()=>Promise<T>,deleting?:readonly string[],touch=true)=>access.run(async()=>{
    session.setBoard(latest())
    if(!session.isCurrent()){onConflict();throw new AppError(session.conflicted?'saveConflict.changed':'App.081')}
    if(deleting?.some(id=>session.allBoards.some(board=>boardMembers(board.items).some(item=>item.recordId===id)||board.threads.some(thread=>thread.fromRaceId===id||thread.toRaceId===id))))throw new AppError('App.086')
    // Existing materials invalidate older board snapshots, even when an editor
    // only updates a name or image and leaves board geometry intact.
    if(touch&&!session.flush(undefined,true)){onConflict();throw new AppError(session.conflicted?'saveConflict.changed':'App.081')}
    return task()
  })
  return {
    ready:access.ready,
    get writable(){return access.writable&&!session.conflicted},
    run,
    // Migration only creates missing materials from inline board data under the
    // lease. Leave the original save intact until recovery protection succeeds.
    initialize:task=>run(task,undefined,false),
  }
}
