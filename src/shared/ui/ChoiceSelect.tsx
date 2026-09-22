import {Select} from '@base-ui/react/select'
import {Check,ChevronDown} from 'lucide-react'
import './choiceSelect.css'

export default function ChoiceSelect({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}){
  return <div className="field-label"><span>{label}</span><Select.Root value={value} items={options} onValueChange={next=>{if(next!==null)onChange(next)}}>
    <Select.Trigger className="choice-select-trigger" aria-label={label}><Select.Value/><Select.Icon><ChevronDown size={16}/></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Positioner className="choice-select-positioner" align="start" sideOffset={6} collisionPadding={12} alignItemWithTrigger={false}><Select.Popup className="choice-select-popup" data-ui-overlay><Select.List className="choice-select-list">{options.map(option=><Select.Item className="choice-select-option" key={option.value} value={option.value}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={15}/></Select.ItemIndicator></Select.Item>)}</Select.List></Select.Popup></Select.Positioner></Select.Portal>
  </Select.Root></div>
}
