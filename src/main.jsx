import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { captureUtm } from './lib/utm'

captureUtm()
document.title = 'Bake My App — Owner Panel'
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
