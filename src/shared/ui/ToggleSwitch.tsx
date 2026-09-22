import {Switch} from '@base-ui/react/switch'

export default function ToggleSwitch({checked,onChange,labelledBy}:{checked:boolean;onChange:(checked:boolean)=>void;labelledBy:string}){
  return <Switch.Root nativeButton render={<button type="button"/>} checked={checked} onCheckedChange={onChange} aria-labelledby={labelledBy} className={`pin-toggle ${checked?'enabled':''}`}>
    <Switch.Thumb/>
  </Switch.Root>
}
