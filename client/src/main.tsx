import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/responsive.css'
import './styles/admin.css'
import './styles/notifications.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
