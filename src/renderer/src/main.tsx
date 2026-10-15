import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StoreProvider } from './lib/store'
import { I18nProvider } from './lib/i18n'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StoreProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StoreProvider>
  </React.StrictMode>
)
