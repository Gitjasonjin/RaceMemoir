import {Dialog} from '@base-ui/react/dialog'
import {useTranslation} from 'react-i18next'
import type {MessageKey} from '../i18n/runtime'
import LatticeLoader from '../shared/ui/LatticeLoader'
import type {FileOperationState} from './useFileOperation'
import './fileOperation.css'

export default function FileOperationOverlay({operation}:{operation:FileOperationState|null}){
  // Resolve all operation copy through the same instance as the language menu/UI.
  const {t,i18n}=useTranslation()
  const number=new Intl.NumberFormat(i18n.resolvedLanguage??i18n.language,{minimumFractionDigits:1,maximumFractionDigits:1})
  return <Dialog.Root open={!!operation} onOpenChange={()=>{}}>
    <Dialog.Portal><Dialog.Backdrop className="file-operation-backdrop"/><Dialog.Viewport className="file-operation-viewport">
      <Dialog.Popup className="file-operation-floating" data-ui-overlay aria-busy={operation?.status==='working'}>
        {operation&&<>
          <Dialog.Title className="file-operation-sr">{t(`fileOperation.${operation.kind}.${operation.status}` as MessageKey)}</Dialog.Title>
          <LatticeLoader status={operation.status} startedAt={operation.startedAt} endedAt={operation.endedAt}
            label={t(`fileOperation.${operation.kind}.${operation.status}` as MessageKey)}
            timerLabel={seconds=>t('fileOperation.elapsed',{seconds:number.format(seconds)})}/>
          <Dialog.Description className="file-operation-description">{t(operation.status==='working'?`fileOperation.${operation.kind}.detail` as MessageKey:operation.status==='done'?'fileOperation.doneDetail':'fileOperation.errorDetail')}</Dialog.Description>
        </>}
      </Dialog.Popup>
    </Dialog.Viewport></Dialog.Portal>
  </Dialog.Root>
}
