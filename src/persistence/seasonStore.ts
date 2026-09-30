import {boardMembers} from '../domain/medalExhibit.ts'
import {isBoard,STORAGE_KEY} from '../domain/model.ts'
import type {Board} from '../domain/model'
import {t} from '../i18n/runtime.ts'
import type {View} from '../board/types'

export const SEASON_STORAGE_KEY='racememoir-season-workspace-v1'
export interface SeasonBoard {year:number;board:Board;view?:View}
export interface SeasonWorkspace {version:1;activeYear:number;seasons:SeasonBoard[]}
export type SeasonStorage=Pick<Storage,'getItem'|'setItem'>

export function isSeasonView(value:unknown):value is View{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const view=value as View
  return [view.x,view.y,view.scale].every(Number.isFinite)&&view.scale>0&&view.scale<=4
}

export function isSeasonWorkspace(value:unknown):value is SeasonWorkspace{
  if(!value||typeof value!=='object')return false
  const workspace=value as SeasonWorkspace
  if(workspace.version!==1||!Array.isArray(workspace.seasons)||workspace.seasons.length!==2)return false
  const years=new Set<number>()
  for(const season of workspace.seasons){
    if(!season||!Number.isInteger(season.year)||season.year<1||season.year>9999||years.has(season.year)||!isBoard(season.board))return false
    if(season.view!==undefined&&!isSeasonView(season.view))return false
    years.add(season.year)
  }
  return years.has(workspace.activeYear)
}

/** Once present, the workspace is authoritative; the old single-board key is only a mirror. */
export function loadSeasonWorkspace(initial:()=>Board,currentYear=new Date().getFullYear(),storage?:SeasonStorage):SeasonWorkspace{
  try{
    const saved:unknown=JSON.parse((storage??localStorage).getItem(SEASON_STORAGE_KEY)||'null')
    if(isSeasonWorkspace(saved))return saved
  }catch{/* A damaged or unavailable save must still allow the board to open. */}
  return {version:1,activeYear:currentYear,seasons:[
    {year:currentYear,board:initial()},
    {year:currentYear-1,board:{title:t('seed.title'),items:[],threads:[]}},
  ]}
}

/** Both boards and their active pointer are committed in a single localStorage write. */
export function saveSeasonWorkspace(workspace:SeasonWorkspace,storage?:SeasonStorage):boolean{
  if(!isSeasonWorkspace(workspace))return false
  let target:SeasonStorage
  try{
    target=storage??localStorage
    target.setItem(SEASON_STORAGE_KEY,JSON.stringify(workspace))
  }catch{return false}
  // Failure of this compatibility mirror cannot roll back the authoritative workspace.
  try{target.setItem(STORAGE_KEY,JSON.stringify(workspace.seasons.find(season=>season.year===workspace.activeYear)!.board))}catch{/* The workspace has already saved successfully. */}
  return true
}

interface SeasonHistory {undo:Board[];redo:Board[]}

/** React-independent state keeps switching, histories and persistence in one transaction boundary. */
export class SeasonBoardSession{
  private state:SeasonWorkspace
  private readonly storage?:SeasonStorage
  private readonly histories=new Map<number,SeasonHistory>()

  constructor(workspace:SeasonWorkspace,storage?:SeasonStorage){
    this.state=workspace
    this.storage=storage
    workspace.seasons.forEach(season=>this.histories.set(season.year,{undo:[],redo:[]}))
  }

  get workspace(){return this.state}
  get year(){return this.state.activeYear}
  get years(){return this.state.seasons.map(season=>season.year).sort((a,b)=>b-a)}
  get board(){return this.state.seasons.find(season=>season.year===this.year)!.board}
  get allBoards(){return this.state.seasons.map(season=>season.board)}
  get restoreView(){return this.state.seasons.find(season=>season.year===this.year)!.view}
  get canUndo(){return this.histories.get(this.year)!.undo.length>0}
  get canRedo(){return this.histories.get(this.year)!.redo.length>0}

  setBoard(next:Board):boolean{
    if(next===this.board)return false
    this.state={...this.state,seasons:this.state.seasons.map(season=>season.year===this.year?{...season,board:next}:season)}
    return true
  }

  remember(previous:Board,year=this.year){
    const history=this.histories.get(year)!
    history.undo=[...history.undo.slice(-49),structuredClone(previous)]
    history.redo=[]
  }

  commit(next:Board){this.remember(this.board);this.setBoard(next)}

  undo():boolean{
    const history=this.histories.get(this.year)!,previous=history.undo.pop()
    if(!previous)return false
    history.redo.push(this.board);this.setBoard(previous);return true
  }

  redo():boolean{
    const history=this.histories.get(this.year)!,next=history.redo.pop()
    if(!next)return false
    history.undo.push(this.board);this.setBoard(next);return true
  }

  forgetRecord(id:string){
    const keep=(snapshot:Board)=>!boardMembers(snapshot.items).some(item=>item.recordId===id)&&!snapshot.threads.some(thread=>thread.fromRaceId===id||thread.toRaceId===id)
    for(const history of this.histories.values()){
      history.undo=history.undo.filter(keep);history.redo=history.redo.filter(keep)
    }
  }

  updateBoards(transform:(board:Board)=>Board):boolean{
    const seasons=this.state.seasons.map(season=>{
      const board=transform(season.board)
      return board===season.board?season:{...season,board}
    })
    const changed=seasons.filter((season,index)=>season!==this.state.seasons[index])
    if(!changed.length)return false
    changed.forEach(season=>this.remember(this.state.seasons.find(previous=>previous.year===season.year)!.board,season.year))
    this.state={...this.state,seasons};return true
  }

  private pending(view?:View,activeYear=this.year):SeasonWorkspace{
    return {...this.state,activeYear,seasons:view===undefined?this.state.seasons:this.state.seasons.map(season=>season.year===this.year?{...season,view:{...view}}:season)}
  }

  flush(view?:View):boolean{
    const next=this.pending(view)
    if(!saveSeasonWorkspace(next,this.storage))return false
    this.state=next;return true
  }

  switchYear(year:number,view?:View):boolean{
    if(!this.state.seasons.some(season=>season.year===year))return false
    const next=this.pending(view,year)
    if(!saveSeasonWorkspace(next,this.storage))return false
    this.state=next;return true
  }
}
