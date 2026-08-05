import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { BrandProvider } from './context/BrandContext'
import { AuthProvider } from './context/AuthContext'
import App from './App.tsx'

const skeleton = document.getElementById('skeleton')
if (skeleton) skeleton.remove()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <BrandProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrandProvider>
    </BrowserRouter>
  </StrictMode>,
)
