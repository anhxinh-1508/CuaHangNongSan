import { Component, ReactNode, ErrorInfo } from 'react'
import Button from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px 20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: 64,
            marginBottom: 20
          }}>⚠️</div>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--brand-green)'
          }}>
            Đã có lỗi xảy ra
          </h2>
          <p style={{
            margin: '0 0 24px',
            color: 'var(--text-secondary)',
            maxWidth: 500
          }}>
            Rất tiếc, đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc liên hệ với quản trị viên nếu lỗi vẫn tiếp diễn.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div style={{
              marginBottom: 24,
              padding: 16,
              background: '#fee2e2',
              border: '2px solid #dc2626',
              borderRadius: 12,
              maxWidth: 600,
              textAlign: 'left',
              overflow: 'auto'
            }}>
              <div style={{
                fontWeight: 600,
                marginBottom: 8,
                color: '#dc2626'
              }}>
                {this.state.error.toString()}
              </div>
              {this.state.errorInfo && (
                <pre style={{
                  fontSize: 12,
                  color: '#991b1b',
                  margin: 0,
                  whiteSpace: 'pre-wrap'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={this.handleReset}>
              Thử lại
            </Button>
            <Button variant="secondary" onClick={() => window.location.href = '/'}>
              Về trang chủ
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
