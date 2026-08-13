import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 라우터는 App 바깥에 둔다. App 안의 어느 컴포넌트든 현재 경로를 알아야 하는데,
        그 정보가 여기서부터 아래로 흐른다. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
