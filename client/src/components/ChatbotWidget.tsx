import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { FiMaximize2, FiMessageCircle, FiMinimize2, FiPlusCircle, FiSend, FiShoppingCart, FiX } from 'react-icons/fi'
import api from '../api/client'
import { mapProduct, unwrapData, unwrapList } from '../api/mappers'
import { useAuth } from '../features/auth/context/AuthContext'

const CHAT_SESSION_STORAGE_KEY = 'ff_chat_session_v1'

type ChatProduct = {
  id: string
  name: string
  price: number
  imageUrl?: string
  reason?: string
}

type ChatCookingRelated = {
  productId: string
  name: string
  unit?: string
  price?: number
  supplier?: string
  expiryInfo?: string
}

type ChatCookingBlock = {
  dishName: string
  summary: string
  recipeSteps: string
  extraIngredientsNote: string
  relatedProducts: ChatCookingRelated[]
}

type ChatQuickYesNo = {
  question: string
  yesPrompt: string
  noPrompt: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  products?: ChatProduct[]
  cookingSuggestions?: ChatCookingBlock[]
  quickYesNo?: ChatQuickYesNo | null
  followUps?: string[]
  serverId?: string
}

function parseCookingSuggestions(raw: unknown): ChatCookingBlock[] {
  if (!Array.isArray(raw)) return []
  const out: ChatCookingBlock[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const dishName = typeof o.dishName === 'string' ? o.dishName.trim() : ''
    const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
    const recipeSteps = typeof o.recipeSteps === 'string' ? o.recipeSteps.trim() : ''
    const extraIngredientsNote = typeof o.extraIngredientsNote === 'string' ? o.extraIngredientsNote.trim() : ''
    const rp = Array.isArray(o.relatedProducts) ? o.relatedProducts : []
    const relatedProducts: ChatCookingRelated[] = []
    for (const r of rp) {
      if (!r || typeof r !== 'object') continue
      const row = r as Record<string, unknown>
      const productId = String(row.productId ?? row._id ?? row.id ?? '').trim()
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      if (!productId || !name) continue
      relatedProducts.push({
        productId,
        name,
        unit: typeof row.unit === 'string' ? row.unit : undefined,
        price: typeof row.price === 'number' ? row.price : Number(row.price) || undefined,
        supplier: typeof row.supplier === 'string' ? row.supplier : undefined,
        expiryInfo: typeof row.expiryInfo === 'string' ? row.expiryInfo : undefined,
      })
    }
    if (!dishName && !summary && !recipeSteps && !extraIngredientsNote && !relatedProducts.length) continue
    out.push({
      dishName: dishName || 'Gợi ý món',
      summary,
      recipeSteps,
      extraIngredientsNote,
      relatedProducts,
    })
  }
  return out
}

function parseQuickYesNo(raw: unknown): ChatQuickYesNo | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const question = typeof o.question === 'string' ? o.question.trim() : ''
  const yesPrompt = typeof o.yesPrompt === 'string' ? o.yesPrompt.trim() : ''
  const noPrompt = typeof o.noPrompt === 'string' ? o.noPrompt.trim() : ''
  if (!question || !yesPrompt || !noPrompt) return null
  return { question, yesPrompt, noPrompt }
}

function mapHistoryRows(rows: Record<string, unknown>[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const row of rows) {
    const role = row.role as string
    const content = String(row.content ?? '')
    const sid = String(row._id ?? row.id ?? '')
    if (role === 'user') {
      out.push({ role: 'user', text: content, serverId: sid || undefined })
    } else if (role === 'assistant') {
      const s = row.structured as Record<string, unknown> | null | undefined
      const recs = Array.isArray(s?.recommendations) ? s.recommendations : []
      const products: ChatProduct[] = recs.map((p: Record<string, unknown>) => {
        const mapped = mapProduct(p)
        const id = String(p.productId ?? p._id ?? p.id ?? mapped.id ?? '')
        return {
          id,
          name: mapped.name || String(p.name ?? 'Sản phẩm'),
          price: mapped.price ?? Number(p.price) ?? 0,
          imageUrl: mapped.imageUrl,
          reason: typeof p.reason === 'string' ? p.reason : undefined,
        }
      })
      const followUps = Array.isArray(s?.followUpQuestions)
        ? (s.followUpQuestions as unknown[]).filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map((x) => x.trim())
        : []
      const cookingSuggestions = parseCookingSuggestions(s?.cookingSuggestions)
      const quickYesNo = parseQuickYesNo(s?.quickYesNo)
      out.push({
        role: 'assistant',
        text: content,
        products: products.length ? products : undefined,
        cookingSuggestions: cookingSuggestions.length ? cookingSuggestions : undefined,
        quickYesNo,
        followUps: followUps.length ? followUps : undefined,
        serverId: sid || undefined,
      })
    }
  }
  return out
}

/** Robot SVG nhỏ trên nút chat — tay vẫy bằng CSS (không cần file ảnh). */
function ChatRobotButtonIcon() {
  const waveL: CSSProperties = {
    transformOrigin: '0px 0px',
    animation: 'ffRobotWaveL 0.72s ease-in-out infinite',
  }
  const waveR: CSSProperties = {
    transformOrigin: '0px 0px',
    animation: 'ffRobotWaveR 0.72s ease-in-out 0.12s infinite',
  }
  return (
    <svg
      width="38"
      height="42"
      viewBox="0 0 100 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
    >
      <circle cx="50" cy="14" r="5" fill="#fff" stroke="#2d4a24" strokeWidth="2" />
      <line x1="50" y1="19" x2="50" y2="30" stroke="#d6d3d1" strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="30" width="44" height="38" rx="10" fill="#fff" stroke="#3C5C2D" strokeWidth="2.8" />
      <circle cx="41" cy="50" r="5" fill="#3C5C2D" />
      <circle cx="59" cy="50" r="5" fill="#3C5C2D" />
      <path
        d="M40 64 Q50 72 60 64"
        stroke="#3C5C2D"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="32" y="72" width="36" height="34" rx="8" fill="#f0fdf4" stroke="#3C5C2D" strokeWidth="2.5" />
      <rect x="40" y="80" width="20" height="14" rx="3" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5" />
      <g transform="translate(34 78)">
        <g style={waveL}>
          <rect x="-18" y="-2" width="16" height="30" rx="7" fill="#fff" stroke="#3C5C2D" strokeWidth="2.5" />
        </g>
      </g>
      <g transform="translate(66 78)">
        <g style={waveR}>
          <rect x="2" y="-2" width="16" height="30" rx="7" fill="#fff" stroke="#3C5C2D" strokeWidth="2.5" />
        </g>
      </g>
    </svg>
  )
}

export default function ChatbotWidget() {
  const { user } = useAuth()
  const chatGreetingName = useMemo(() => {
    const fn = user?.firstName?.trim()
    if (fn && fn.toLowerCase() !== 'bạn') return fn
    const parts = user?.name?.trim().split(/\s+/).filter(Boolean) ?? []
    if (parts.length) return parts[parts.length - 1] ?? 'bạn'
    return 'bạn'
  }, [user])

  const [open, setOpen] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, open, chatExpanded, scrollToBottom])

  useEffect(() => {
    if (!open) setChatExpanded(false)
  }, [open])

  const bootstrappedThisOpen = useRef(false)

  useEffect(() => {
    if (!open) {
      bootstrappedThisOpen.current = false
      return
    }
    if (bootstrappedThisOpen.current) return
    bootstrappedThisOpen.current = true

    let cancelled = false

    const bootstrap = async () => {
      setSessionReady(false)
      setSessionError(false)
      const saved = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY)
      if (saved) {
        try {
          const r = await api.get(`/chat/history/${saved}`)
          const rows = unwrapList<Record<string, unknown>>(r.data)
          if (cancelled) return
          setSessionId(saved)
          setMessages(mapHistoryRows(rows))
          setSessionReady(true)
          return
        } catch {
          sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
        }
      }
      try {
        const r = await api.post('/chat/session', {})
        const session = unwrapData<Record<string, unknown> | null>(r.data, null)
        const id = session ? String(session._id ?? session.id ?? '') : ''
        if (cancelled) return
        if (id) {
          setSessionId(id)
          sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, id)
        } else {
          setSessionId(null)
        }
        setMessages([])
        setSessionReady(true)
      } catch {
        if (!cancelled) {
          setSessionId(null)
          setSessionReady(false)
          setSessionError(true)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [open])

  const startNewChat = async () => {
    sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
    setSessionId(null)
    setMessages([])
    setSessionReady(false)
    setSessionError(false)
    setInput('')
    try {
      const r = await api.post('/chat/session', {})
      const session = unwrapData<Record<string, unknown> | null>(r.data, null)
      const id = session ? String(session._id ?? session.id ?? '') : ''
      if (id) {
        setSessionId(id)
        sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, id)
      }
      setSessionReady(true)
    } catch {
      setSessionError(true)
    }
  }

  const send = async (overrideText?: string) => {
    const raw = (overrideText ?? input).trim()
    if (!raw || loading || !sessionId) return
    if (!overrideText) setInput('')
    setMessages((m) => [...m, { role: 'user', text: raw }])
    setLoading(true)
    try {
      const { data } = await api.post<{
        data?: {
          answer?: string
          recommendations?: Record<string, unknown>[]
          followUpQuestions?: string[]
          cookingSuggestions?: unknown[]
          quickYesNo?: unknown
        }
      }>('/chat/message', { sessionId, message: raw })
      const payload = data?.data
      const recs = payload?.recommendations ?? []
      const products: ChatProduct[] = recs.map((p) => {
        const mapped = mapProduct(p)
        const id = String(p.productId ?? p._id ?? p.id ?? mapped.id ?? '')
        return {
          id,
          name: mapped.name || String(p.name ?? 'Sản phẩm'),
          price: mapped.price ?? Number(p.price) ?? 0,
          imageUrl: mapped.imageUrl,
          reason: typeof p.reason === 'string' ? p.reason : undefined,
        }
      })
      const followUps = Array.isArray(payload?.followUpQuestions)
        ? payload.followUpQuestions.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map((x) => x.trim())
        : []
      const cookingSuggestions = parseCookingSuggestions(payload?.cookingSuggestions)
      const quickYesNo = parseQuickYesNo(payload?.quickYesNo)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: payload?.answer ?? 'Mình chưa có gợi ý phù hợp, bạn thử mô tả chi tiết hơn nhé.',
          products: products.length ? products : undefined,
          cookingSuggestions: cookingSuggestions.length ? cookingSuggestions : undefined,
          quickYesNo,
          followUps: followUps.length ? followUps : undefined,
        },
      ])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Xin lỗi, đã có lỗi. Vui lòng thử lại sau ít phút.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes ffChatDot { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes ffRobotWaveL {
          0%, 100% { transform: rotate(-14deg); }
          50% { transform: rotate(32deg); }
        }
        @keyframes ffRobotWaveR {
          0%, 100% { transform: rotate(14deg); }
          50% { transform: rotate(-32deg); }
        }
        @keyframes ffBubbleIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 1010,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {!open && (
          <div
            role="status"
            style={{
              pointerEvents: 'none',
              maxWidth: 'min(240px, calc(100vw - 96px))',
              padding: '10px 14px 12px',
              background: '#fff',
              border: '2px solid #e7e5e4',
              borderRadius: 14,
              boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
              fontSize: 14,
              fontWeight: 600,
              color: '#3C5C2D',
              lineHeight: 1.4,
              position: 'relative',
              animation: 'ffBubbleIn 0.4s ease-out',
              textAlign: 'left',
            }}
          >
            Xin chào, mình là trợ lý AI của cửa hàng FreshFarm!
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            pointerEvents: 'auto',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #E2A227 0%, #f0b844 100%)',
            color: '#fff',
            border: '3px solid #fff',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(226, 162, 39, 0.4)',
            fontSize: 28,
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            padding: 0,
          }}
          aria-label={open ? 'Đóng chat' : 'Mở trợ lý AI'}
        >
          {open ? <FiX /> : <ChatRobotButtonIcon />}
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed',
            ...(chatExpanded
              ? {
                  top: 12,
                  right: 12,
                  bottom: 12,
                  left: 12,
                  width: 'auto',
                  height: 'auto',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  borderRadius: 16,
                }
              : {
                  bottom: 110,
                  right: 28,
                  width: 420,
                  maxWidth: 'calc(100vw - 56px)',
                  height: 580,
                  maxHeight: 'calc(100vh - 140px)',
                  borderRadius: 20,
                }),
            background: '#fff',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '2px solid #e7e5e4',
            zIndex: chatExpanded ? 1005 : 999,
            transition: 'top 0.2s ease, right 0.2s ease, bottom 0.2s ease, left 0.2s ease, border-radius 0.2s ease',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 12px rgba(60, 92, 45, 0.2)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: '#E2A227',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              <FiMessageCircle />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Trợ lý AI FreshFarm</div>
            </div>
            <button
              type="button"
              onClick={() => setChatExpanded((v) => !v)}
              title={chatExpanded ? 'Thu nhỏ cửa sổ chat' : 'Phóng to cửa sổ chat'}
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-expanded={chatExpanded}
              aria-label={chatExpanded ? 'Thu nhỏ chat' : 'Phóng to chat'}
            >
              {chatExpanded ? <FiMinimize2 size={20} /> : <FiMaximize2 size={20} />}
            </button>
            <button
              type="button"
              onClick={startNewChat}
              title="Bắt đầu cuộc trò chuyện mới"
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Chat mới"
            >
              <FiPlusCircle size={22} />
            </button>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: '#fafaf9',
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  padding: 16,
                  background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
                  border: '2px solid #E2A227',
                  borderRadius: 12,
                  color: '#3C5C2D',
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                <strong>Xin chào, mình là trợ lý AI FreshFarm! </strong>
                <strong>Mình có thể giúp gì cho bạn?</strong>
                <p style={{ margin: '10px 0 0', fontSize: 13 }}>
                  <Link to="/products" style={{ color: '#b45309', fontWeight: 700 }}>
                    → Xem tất cả sản phẩm
                  </Link>
                  {' · '}
                  <Link to="/contact" style={{ color: '#b45309', fontWeight: 700 }}>
                    Liên hệ cửa hàng
                  </Link>
                </p>
              </div>
            )}
            {sessionError && (
              <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
                Không kết nối được chat. Bạn thử tải lại trang hoặc nhấn &quot;Chat mới&quot;.
              </div>
            )}
            {!sessionReady && !sessionError && (
              <div style={{ fontSize: 13, color: '#737373' }}>Đang kết nối trợ lý…</div>
            )}
            {messages.map((msg, i) => (
              <div
                key={msg.serverId ?? `${msg.role}-${i}-${msg.text.slice(0, 24)}`}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                  padding: '12px 14px',
                  borderRadius: 16,
                  background:
                    msg.role === 'user' ? 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                  fontSize: 14,
                  lineHeight: 1.55,
                  boxShadow:
                    msg.role === 'user' ? '0 4px 12px rgba(60, 92, 45, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
                  border: msg.role === 'user' ? 'none' : '2px solid #e7e5e4',
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                {msg.role === 'assistant' && msg.quickYesNo && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 12,
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{msg.quickYesNo.question}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => void send(msg.quickYesNo!.yesPrompt)}
                        disabled={loading || !sessionId}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#3C5C2D',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Có
                      </button>
                      <button
                        type="button"
                        onClick={() => void send(msg.quickYesNo!.noPrompt)}
                        disabled={loading || !sessionId}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: '1px solid #a8a29e',
                          background: '#fff',
                          color: '#44403c',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Không
                      </button>
                    </div>
                  </div>
                )}
                {msg.role === 'assistant' && msg.cookingSuggestions && msg.cookingSuggestions.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {msg.cookingSuggestions.map((block, bi) => (
                      <div
                        key={`${block.dishName}-${bi}`}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: '#fffbeb',
                          border: '1px solid #fcd34d',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#92400e', marginBottom: 6 }}>{block.dishName}</div>
                        {block.summary ? (
                          <div style={{ fontSize: 13, color: '#44403c', marginBottom: 8, lineHeight: 1.5 }}>{block.summary}</div>
                        ) : null}
                        {block.recipeSteps ? (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Các bước
                            </div>
                            <div style={{ fontSize: 13, color: '#1c1917', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 4 }}>{block.recipeSteps}</div>
                          </div>
                        ) : null}
                        {block.extraIngredientsNote ? (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Mua thêm thường dùng
                            </div>
                            <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.5, marginTop: 4 }}>{block.extraIngredientsNote}</div>
                          </div>
                        ) : null}
                        {block.relatedProducts.length > 0 ? (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>Sản phẩm trên shop gợi ý kèm</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {block.relatedProducts.map((rp) => (
                                <Link
                                  key={rp.productId}
                                  to={`/products/${rp.productId}`}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#3C5C2D',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {rp.name}
                                  {typeof rp.price === 'number' ? ` · ${rp.price.toLocaleString('vi-VN')}đ` : ''}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {msg.products && msg.products.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {msg.products.map((p) => (
                      <Link
                        key={p.id}
                        to={`/products/${p.id}`}
                        style={{
                          padding: '10px 12px',
                          background: msg.role === 'user' ? 'rgba(255, 255, 255, 0.18)' : '#fffbf0',
                          border: msg.role === 'user' ? '1px solid rgba(255, 255, 255, 0.35)' : '2px solid #E2A227',
                          borderRadius: 10,
                          color: msg.role === 'user' ? '#fff' : '#1c1917',
                          textDecoration: 'none',
                          fontWeight: 600,
                          fontSize: 13,
                          display: 'block',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <FiShoppingCart /> {p.name}
                        </span>
                        <div style={{ marginTop: 4, fontWeight: 800, color: msg.role === 'user' ? '#fef3c7' : '#E2A227' }}>
                          {p.price.toLocaleString('vi-VN')}đ
                        </div>
                        {p.reason && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              color: msg.role === 'user' ? 'rgba(255,255,255,0.9)' : '#57534e',
                              lineHeight: 1.45,
                            }}
                          >
                            {p.reason}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && msg.followUps && msg.followUps.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#78716c', marginBottom: 6 }}>Gợi ý nhanh</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {msg.followUps.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => void send(q)}
                          disabled={loading || !sessionId}
                          style={{
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid #d6d3d1',
                            background: '#f5f5f4',
                            color: '#3C5C2D',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && msg.followUps && msg.followUps.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {msg.followUps.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void send(q)}
                        disabled={loading || !sessionId}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.35)',
                          background: 'rgba(255,255,255,0.15)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '12px 16px',
                  background: '#fff',
                  border: '2px solid #e7e5e4',
                  borderRadius: 16,
                  fontSize: 13,
                  color: '#57534e',
                }}
              >
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#3C5C2D',
                      animation: 'ffChatDot 1s ease-in-out infinite',
                    }}
                  />
                  Đang soạn tin nhắn…
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              padding: 14,
              borderTop: '2px solid #e7e5e4',
              display: 'flex',
              gap: 10,
              background: '#fff',
              flexShrink: 0,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Ví dụ: Gợi ý rau cho eat clean cuối tuần…"
              disabled={!sessionReady || !sessionId}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 12,
                border: '2px solid #e7e5e4',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim() || !sessionId || !sessionReady}
              style={{
                padding: '12px 18px',
                background:
                  loading || !input.trim() ? '#d4d4d8' : 'linear-gradient(135deg, #E2A227 0%, #f0b844 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: 14,
                boxShadow: loading || !input.trim() ? 'none' : '0 4px 12px rgba(226, 162, 39, 0.3)',
              }}
              aria-label="Gửi"
            >
              <FiSend />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
