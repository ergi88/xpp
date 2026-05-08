import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { initTheme } from './hooks/use-theme'
import './index.css'

initTheme()

ReactDOM.createRoot(document.getElementById('app')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
