import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/context/AuthContext'
import { WishlistProvider } from './features/wishlist/context/WishlistContext'
import StorefrontLayout from './layouts/StorefrontLayout'
import AdminLayout from './layouts/AdminLayout'
import HomePage from './pages/HomePage'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import WishlistPage from './pages/WishlistPage'
import MyOrdersPage from './pages/MyOrdersPage'
import StoreOrderDetailPage from './pages/StoreOrderDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'
import ContactPage from './pages/ContactPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import AdminDashboard from './pages/admin/Dashboard'
import AdminReports from './pages/admin/Reports'
import AdminProducts from './pages/admin/Products'
import AdminBatches from './pages/admin/Batches'
import AdminCategories from './pages/admin/Categories'
import AdminBanners from './pages/admin/Banners'
import AdminCoupons from './pages/admin/Coupons'
import AdminOrders from './pages/admin/Orders'
import AdminCustomers from './pages/admin/Customers'
import AdminContacts from './pages/admin/Contacts'

function App() {
  return (
    <AuthProvider>
      <WishlistProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StorefrontLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="orders/:id" element={<StoreOrderDetailPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="batches" element={<AdminBatches />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="contacts" element={<AdminContacts />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </WishlistProvider>
    </AuthProvider>
  )
}

export default App
