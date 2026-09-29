import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './app/styles.css'
import {I18nextProvider} from 'react-i18next'
import {i18n,initializeLanguage} from './i18n/runtime'
initializeLanguage()
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nextProvider i18n={i18n}><App /></I18nextProvider></React.StrictMode>)
