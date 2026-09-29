import {Languages,Check,ChevronDown} from 'lucide-react'
import {Menu} from '@base-ui/react/menu'
import {useTranslation} from 'react-i18next'
import {changeLanguage,locale} from './runtime'
import type {Locale} from './runtime'
import './language.css'

const languages:[Locale,string][]=[['zh-CN','简体中文'],['en','English'],['ja','日本語']]
export default function LanguageMenu(){
  useTranslation()
  return <Menu.Root><Menu.Trigger className="language-trigger" aria-label="Language / 语言 / 言語"><Languages size={18}/><ChevronDown size={11}/></Menu.Trigger>
    <Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="language-positioner"><Menu.Popup className="language-popup" data-ui-overlay>
      <Menu.RadioGroup value={locale()} onValueChange={value=>changeLanguage(value as Locale)}>{languages.map(([id,label])=><Menu.RadioItem key={id} value={id} closeOnClick className="language-option" aria-label={label}>
        <span lang={id}>{label}</span>{locale()===id&&<Check size={15}/>}
      </Menu.RadioItem>)}</Menu.RadioGroup>
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.Root>
}
