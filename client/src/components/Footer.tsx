import { FiFileText, FiMail, FiMapPin, FiPhone } from 'react-icons/fi'

export default function Footer() {
  return (
    <footer className="footer-brand" style={{ padding: '64px 32px 24px', marginTop: 80 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="footer-grid" style={{ marginBottom: 48 }}>
          <div>
            <div style={{ marginBottom: 20 }}>
              <img
                src="/Logo.png"
                alt="FreshFarm Organic"
                style={{ height: 100, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            </div>
            <p style={{ margin: '8px 0', fontSize: 14, color: '#4b5563', lineHeight: 1.6, fontWeight: 'bold', textAlign: 'center' }}>
              Nông sản hữu cơ tươi ngon, <br /> từ trang trại đến bàn ăn của bạn
            </p>
          </div>
          
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#E3A127', letterSpacing: '0.5px' }}>THÔNG TIN</h3>
            <p style={{ margin: '8px 0', fontSize: 14, color: '#3D5C30', display: 'flex', alignItems: 'center', gap: 8 }}><FiFileText /> Số ĐKKD: 0123456789</p>
            <p style={{ margin: '8px 0', fontSize: 14, color: '#3D5C30', display: 'flex', alignItems: 'center', gap: 8 }}><FiMapPin /> Địa chỉ: Hà Nội, Việt Nam</p>
            <p style={{ margin: '8px 0', fontSize: 14, color: '#3D5C30', display: 'flex', alignItems: 'center', gap: 8 }}><FiMail /> Email: info@freshfarm.vn</p>
            <p style={{ margin: '8px 0', fontSize: 14, color: '#3D5C30', display: 'flex', alignItems: 'center', gap: 8 }}><FiPhone /> Hotline: 1900 8888</p>
          </div>
          
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#E3A127', letterSpacing: '0.5px' }}>VỀ CHÚNG TÔI</h3>
            <p style={{ margin: '8px 0' }}><a href="/about" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Giới thiệu</a></p>
            <p style={{ margin: '8px 0' }}><a href="/contact" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Liên hệ</a></p>
            <p style={{ margin: '8px 0' }}><a href="/news" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Tin tức</a></p>
            <p style={{ margin: '8px 0' }}><a href="/stores" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Hệ thống cửa hàng</a></p>
          </div>
          
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#E3A127', letterSpacing: '0.5px' }}>HỖ TRỢ</h3>
            <p style={{ margin: '8px 0' }}><a href="/orders" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Kiểm tra đơn hàng</a></p>
            <p style={{ margin: '8px 0' }}><a href="/shipping" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Chính sách vận chuyển</a></p>
            <p style={{ margin: '8px 0' }}><a href="/return" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Chính sách đổi trả</a></p>
            <p style={{ margin: '8px 0' }}><a href="/privacy" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}>Bảo mật khách hàng</a></p>
          </div>
        </div>
        
        <div style={{ 
          textAlign: 'center', 
          paddingTop: 32, 
          borderTop: '1px solid rgba(61, 92, 48, 0.2)', 
          color: '#4b5563', 
          fontSize: 14 
        }}>
          © 2026 Bản quyền thuộc về cửa hàng <a href="/" style={{ color: '#3D5C30', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}><b>FRESHFARM ORGANIC</b></a>
        </div>
      </div>
    </footer>
  )
}
