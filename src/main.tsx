import React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import App from './App'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')
ReactDOMClient.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
