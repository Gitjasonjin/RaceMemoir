import {useState} from 'react'
import {Popover} from '@base-ui/react/popover'
import {Select} from '@base-ui/react/select'
import {DayPicker,useDayPicker} from 'react-day-picker'
import type {DropdownProps} from 'react-day-picker'
import {zhCN} from 'react-day-picker/locale'
import {CalendarDays,Check,ChevronDown} from 'lucide-react'
import 'react-day-picker/style.css'
import './datePicker.css'

function CalendarSelect({options=[],value,disabled,'aria-label':label,onSelect}:{options?:DropdownProps['options'];value?:DropdownProps['value'];disabled?:boolean;'aria-label'?:string;onSelect:(value:number)=>void}){
  return <Select.Root value={Number(value)} disabled={disabled} items={options} onValueChange={next=>{if(next!==null)onSelect(next)}}>
    <Select.Trigger className="calendar-select-trigger" aria-label={label}><Select.Value/><Select.Icon><ChevronDown size={14}/></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Positioner className="calendar-select-positioner" sideOffset={5} align="start" alignItemWithTrigger={false} collisionPadding={12}>
      <Select.Popup className="calendar-select-popup" data-ui-overlay><Select.List className="calendar-select-list">
        {options.map(option=><Select.Item className="calendar-select-option" key={option.value} value={option.value} disabled={option.disabled}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={14}/></Select.ItemIndicator></Select.Item>)}
      </Select.List></Select.Popup>
    </Select.Positioner></Select.Portal>
  </Select.Root>
}
function MonthSelect(props:DropdownProps){
  const {months,goToMonth}=useDayPicker()
  return <CalendarSelect {...props} onSelect={month=>goToMonth(new Date(months[0].date.getFullYear(),month,1))}/>
}
function YearSelect(props:DropdownProps){
  const {months,goToMonth}=useDayPicker()
  return <CalendarSelect {...props} onSelect={year=>goToMonth(new Date(year,months[0].date.getMonth(),1))}/>
}

export default function DatePicker({value,onChange,disabled=false,label='拍摄日期'}:{value:string;onChange:(value:string)=>void;disabled?:boolean;label?:string}){
  const [open,setOpen]=useState(false)
  const selected=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(`${value}T12:00:00`):undefined
  const choose=(date:Date|undefined)=>{
    onChange(date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'')
    setOpen(false)
  }
  return <div className="field-label"><span>{label}</span><Popover.Root open={open&&!disabled} onOpenChange={setOpen}>
    <Popover.Trigger className="date-picker-trigger" disabled={disabled} aria-label={label}><span>{value||'选择日期'}</span><CalendarDays size={17}/></Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={8} collisionPadding={12} className="date-picker-positioner"><Popover.Popup className="date-picker-popup" aria-label={`选择${label}`} data-ui-overlay>
      <DayPicker components={{MonthsDropdown:MonthSelect,YearsDropdown:YearSelect}} mode="single" locale={zhCN} selected={selected} defaultMonth={selected} onSelect={choose} autoFocus captionLayout="dropdown" startMonth={new Date(1900,0)} endMonth={new Date(2100,11)} labels={{labelDayButton:date=>`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`,labelNext:()=> '下个月',labelPrevious:()=> '上个月',labelMonthDropdown:()=> '月份',labelYearDropdown:()=> '年份'}}/>
      <div className="date-picker-actions"><button type="button" onClick={()=>choose(undefined)}>清除日期</button><button type="button" onClick={()=>choose(new Date())}>今天</button></div>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root></div>
}
