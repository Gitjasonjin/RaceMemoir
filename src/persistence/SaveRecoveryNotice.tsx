import {useState} from 'react'
import {Download,RotateCcw,X} from 'lucide-react'
import {t as tr} from '../i18n/runtime.ts'
import {downloadBlob} from './download'
import type {SaveReadIssue} from './saveRecovery'

export default function SaveRecoveryNotice({issues,saveFailed}:{issues:readonly SaveReadIssue[];saveFailed:boolean}){
  const [dismissed,setDismissed]=useState(false)
  if(dismissed||!issues.length)return null
  const unavailable=issues.some(issue=>issue.status==='unavailable')
  const originals=issues.filter(issue=>issue.raw!==undefined).map(({key,raw})=>({key,raw}))
  const download=()=>downloadBlob(new Blob([JSON.stringify({version:1,entries:originals},null,2)],{type:'application/json'}),'racememoir-original-save.json')
  return <div className="save-recovery-banner" role="alert">
    <p>{tr(unavailable?'saveRecovery.unavailable':saveFailed?'saveRecovery.saveFailed':'saveRecovery.corrupt')}</p>
    <div className="save-recovery-actions">
      {!!originals.length&&<button type="button" onClick={download}><Download size={15}/>{tr('saveRecovery.download')}</button>}
      <button type="button" onClick={()=>location.reload()}><RotateCcw size={15}/>{tr('saveRecovery.reload')}</button>
      <button type="button" className="save-recovery-dismiss" aria-label={tr('saveRecovery.dismiss')} onClick={()=>setDismissed(true)}><X size={16}/></button>
    </div>
  </div>
}
