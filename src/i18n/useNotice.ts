import {useState} from 'react'
import {useTranslation} from 'react-i18next'
import {messageText} from './runtime'
import type {Notice} from './runtime'

/** Store a message descriptor; resolve its text against the current language on every render. */
export function useNotice(initial:Notice=''){
  useTranslation()
  const [value,setValue]=useState<Notice>(initial)
  return [messageText(value),setValue] as const
}
