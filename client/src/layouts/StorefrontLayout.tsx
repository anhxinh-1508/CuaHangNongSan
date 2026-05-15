import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ChatbotWidget from '../components/ChatbotWidget'


export default function StorefrontLayout() {
  return (
    <>
      <Header />
      <main style={{ minHeight: 'calc(100vh - 200px)', flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
      <ChatbotWidget />
    </>
  )
}
