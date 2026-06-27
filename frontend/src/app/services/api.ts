const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let authToken: string | null = null;

/** Sync in-memory JWT from AuthProvider (never persisted to localStorage). */
export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  regular_price: string;
  discount_price: string | null;
  stock_quantity: number;
  category_name?: string;
  category_slug?: string;
}

export interface ProductResource {
  id: number;
  file_url: string;
  file_name: string;
  mime_type: string;
  file_role: string;
  sort_order?: number;
}

export interface ProductVariant {
  id?: number;
  label: string;
  regular_price: number;
  discount_price?: number | null;
  stock_quantity: number;
  badge?: string | null;
  is_default?: boolean;
  sort_order?: number;
}

export interface ProductDetail {
  product: Product;
  resources: ProductResource[];
  review_stats?: { count: number; average: number };
}

export interface CmsSection<T = any> {
  content: T;
  updated_at: string;
}

export interface CmsSectionsResponse {
  sections: Record<string, CmsSection>;
}

export interface CartItemResponse {
  cart_item_id: number;
  quantity: number;
  product_id: number;
  name: string;
  regular_price: string;
  discount_price: string | null;
}

export interface UserAddress {
  id?: number;
  address_type: 'shipping' | 'billing';
  recipient_name: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  phone_number: string;
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Login failed');
    return data;
  },

  async register(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Registration failed');
    return data;
  },

  async getProfile() {
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch profile');
    return data;
  },

  async forgotPassword(email: string) {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Forgot password failed');
    return data;
  },

  async resetPassword(token: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ token, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Reset password failed');
    return data;
  },

  // CMS (public read)
  async getCmsSections(keys?: string[]): Promise<CmsSectionsResponse> {
    const query = keys && keys.length > 0 ? `?keys=${encodeURIComponent(keys.join(','))}` : '';
    const res = await fetch(`${BASE_URL}/cms${query}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch CMS content');
    return data;
  },

  async getCmsSection<T = any>(key: string): Promise<{ key: string; content: T; updated_at: string }> {
    const res = await fetch(`${BASE_URL}/cms/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch CMS section');
    return data;
  },

  // CMS (admin write)
  async updateCmsSection(key: string, content: Record<string, any>) {
    const res = await fetch(`${BASE_URL}/admin/cms/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update CMS content');
    return data;
  },

  // Products
  async getProducts(search?: string): Promise<Product[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${BASE_URL}/products${query}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch products');
    return data.products;
  },

  async getProductById(id: number): Promise<ProductDetail> {
    const res = await fetch(`${BASE_URL}/products/${id}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch product');
    return data;
  },

  async getProductDetail(id: number) {
    const res = await fetch(`${BASE_URL}/products/${id}`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch product');
    return data as {
      product: Product & { long_description?: string; key_benefits?: string[] };
      resources: ProductResource[];
      variants: ProductVariant[];
      review_stats: { count: number; average: number };
    };
  },

  async getProductReviews(productId: number) {
    const res = await fetch(`${BASE_URL}/products/${productId}/reviews`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch reviews');
    return data as { reviews: any[]; stats: { count: number; average: number } };
  },

  async getReviewEligibility(productId: number) {
    const res = await fetch(`${BASE_URL}/products/${productId}/review-eligibility`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to check review eligibility');
    return data as {
      can_review: boolean;
      reason: 'eligible' | 'login_required' | 'purchase_required' | 'awaiting_delivery' | 'already_reviewed' | 'review_pending';
      review_status?: 'pending' | 'approved' | 'rejected';
    };
  },

  async getAdminReviews(status?: 'pending' | 'approved' | 'rejected') {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${BASE_URL}/admin/reviews${q}`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch reviews');
    return data as { reviews: AdminReview[] };
  },

  async submitProductReview(productId: number, formData: FormData) {
    const res = await fetch(`${BASE_URL}/products/${productId}/reviews`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to submit review');
    return data;
  },

  async getAdminProduct(id: number) {
    const res = await fetch(`${BASE_URL}/admin/products/${id}`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch product');
    return data as { product: AdminProduct & { long_description?: string; key_benefits?: string[] }; resources: ProductResource[]; reviews: any[]; variants: ProductVariant[] };
  },

  async moderateReview(id: number, status: 'approved' | 'rejected' | 'pending') {
    const res = await fetch(`${BASE_URL}/admin/reviews/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update review');
    return data;
  },

  async deleteResource(id: number) {
    const res = await fetch(`${BASE_URL}/resources/${id}`, { method: 'DELETE', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Delete failed');
    return data;
  },

  async uploadProductMedia(file: File, productId: number, fileRole: 'gallery' | 'thumbnail' | 'video', sortOrder = 0) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('owner_type', 'Product');
    fd.append('owner_id', String(productId));
    fd.append('file_role', fileRole);
    fd.append('sort_order', String(sortOrder));
    const res = await fetch(`${BASE_URL}/resources/upload-media`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
    return data.resource as { id: number; file_url: string };
  },

  async loadProductCatalog(): Promise<ProductDetail[]> {
    const products = await this.getProducts();
    return Promise.all(products.map((p) => this.getProductById(p.id)));
  },

  // Cart
  async getCart(): Promise<{ cart_id: number; items: CartItemResponse[] }> {
    const res = await fetch(`${BASE_URL}/cart`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch cart');
    return data;
  },

  async addToCart(productId: number, quantity = 1, variantId?: number | null) {
    const res = await fetch(`${BASE_URL}/cart/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        product_id: productId,
        quantity,
        ...(variantId ? { variant_id: variantId } : {}),
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to add to cart');
    return data;
  },

  async updateCart(productId: number, quantity: number) {
    const res = await fetch(`${BASE_URL}/cart/update`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId, quantity })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update cart');
    return data;
  },

  async removeFromCart(productId: number) {
    const res = await fetch(`${BASE_URL}/cart/remove/${productId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to remove from cart');
    return data;
  },

  // Addresses
  async addAddress(address: UserAddress) {
    const res = await fetch(`${BASE_URL}/addresses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(address)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to add address');
    return data;
  },

  async updateAddress(id: number, address: UserAddress) {
    const res = await fetch(`${BASE_URL}/addresses/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(address)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update address');
    return data;
  },

  async deleteAddress(id: number) {
    const res = await fetch(`${BASE_URL}/addresses/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to delete address');
    return data;
  },

  // Wishlist
  async getWishlist() {
    const res = await fetch(`${BASE_URL}/wishlist`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch wishlist');
    return data.wishlist;
  },

  async addToWishlist(productId: number) {
    const res = await fetch(`${BASE_URL}/wishlist/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to add to wishlist');
    return data;
  },

  async removeFromWishlist(productId: number) {
    const res = await fetch(`${BASE_URL}/wishlist/remove/${productId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to remove from wishlist');
    return data;
  },

  // Promo
  async validatePromo(code: string) {
    const res = await fetch(`${BASE_URL}/promo/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Promo validation failed');
    return data;
  },

  // Orders & Payments
  async createOrder(shippingAddress: string, promoCode?: string) {
    const res = await fetch(`${BASE_URL}/orders/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ shipping_address: shippingAddress, promo_code: promoCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Order creation failed');
    return data;
  },

  async verifyPayment(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string) {
    const res = await fetch(`${BASE_URL}/orders/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Payment verification failed');
    return data;
  },

  async getOrderHistory() {
    const res = await fetch(`${BASE_URL}/orders/history`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch order history');
    return data.orders;
  },

  // Categories (public)
  async getCategories() {
    const res = await fetch(`${BASE_URL}/products/categories`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch categories');
    return data.categories as { id: number; name: string; slug: string; parent_id: number | null }[];
  },

  // Admin — dashboard
  async getAdminDashboard() {
    const res = await fetch(`${BASE_URL}/admin/dashboard`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch dashboard');
    return data.metrics;
  },

  // Admin — products
  async getAdminProducts() {
    const res = await fetch(`${BASE_URL}/admin/products`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch products');
    return data.products as AdminProduct[];
  },

  async createProduct(body: ProductFormData) {
    const res = await fetch(`${BASE_URL}/admin/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to create product');
    return data.product;
  },

  async updateProduct(id: number, body: ProductFormData) {
    const res = await fetch(`${BASE_URL}/admin/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update product');
    return data.product;
  },

  async archiveProduct(id: number) {
    const res = await fetch(`${BASE_URL}/admin/products/${id}`, { method: 'DELETE', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to archive product');
    return data;
  },

  // Admin — categories
  async createCategory(body: { name: string; slug: string; parent_id?: number | null }) {
    const res = await fetch(`${BASE_URL}/admin/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to create category');
    return data.category;
  },

  async updateCategory(id: number, body: { name: string; slug: string; parent_id?: number | null }) {
    const res = await fetch(`${BASE_URL}/admin/categories/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update category');
    return data.category;
  },

  async deleteCategory(id: number) {
    const res = await fetch(`${BASE_URL}/admin/categories/${id}`, { method: 'DELETE', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to delete category');
    return data;
  },

  // Admin — orders
  async getAdminOrders() {
    const res = await fetch(`${BASE_URL}/admin/orders`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch orders');
    return data.orders as AdminOrder[];
  },

  async getAdminOrder(id: number) {
    const res = await fetch(`${BASE_URL}/admin/orders/${id}`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch order');
    return data as { order: AdminOrder; items: AdminOrderItem[]; payments: AdminPayment[] };
  },

  async updateOrderStatus(id: number, status: string) {
    const res = await fetch(`${BASE_URL}/admin/orders/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update order status');
    return data;
  },

  async refundOrder(id: number) {
    const res = await fetch(`${BASE_URL}/admin/orders/${id}/refund`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to refund order');
    return data;
  },

  // Admin — promos
  async getAdminPromos() {
    const res = await fetch(`${BASE_URL}/admin/promos`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch promo codes');
    return data.promos as AdminPromo[];
  },

  async createPromo(body: PromoFormData) {
    const res = await fetch(`${BASE_URL}/admin/promos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to create promo code');
    return data.promo;
  },

  async updatePromo(id: number, body: PromoFormData) {
    const res = await fetch(`${BASE_URL}/admin/promos/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update promo code');
    return data;
  },

  async deletePromo(id: number) {
    const res = await fetch(`${BASE_URL}/admin/promos/${id}`, { method: 'DELETE', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to delete promo code');
    return data;
  },

  // Admin — users
  async getAdminUsers() {
    const res = await fetch(`${BASE_URL}/admin/users`, { method: 'GET', headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch users');
    return data.users as AdminUser[];
  },

  async toggleUserStatus(id: number, is_active: boolean) {
    const res = await fetch(`${BASE_URL}/admin/users/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ is_active })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update user status');
    return data;
  },

  async updateUserRole(id: number, role: string) {
    const res = await fetch(`${BASE_URL}/admin/users/${id}/role`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update user role');
    return data;
  },

  // Resource upload (product images, etc.)
  async uploadResource(file: File, ownerType: string, ownerId: number, fileRole = 'thumbnail') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('owner_type', ownerType);
    fd.append('owner_id', String(ownerId));
    fd.append('file_role', fileRole);
    const res = await fetch(`${BASE_URL}/resources/upload`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
    return data.resource as { id: number; file_url: string };
  }
};

export interface ProductFormData {
  name: string;
  description: string;
  long_description?: string;
  key_benefits?: string[];
  regular_price: number;
  discount_price?: number | null;
  stock_quantity: number;
  category_id?: number | null;
  is_published?: boolean;
  variants?: ProductVariant[];
}

export interface AdminProduct extends Product {
  is_published: boolean;
  thumbnail_url?: string | null;
  created_at?: string;
}

export interface AdminOrder {
  id: number;
  user_id: number;
  user_email: string;
  total_amount: string;
  shipping_address: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_refund_id?: string | null;
  payment_status?: string | null;
  items?: { name: string; quantity: number; price_at_purchase: string }[];
}

export interface AdminOrderItem {
  product_id: number;
  name: string;
  quantity: number;
  price_at_purchase: string;
}

export interface AdminPayment {
  id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_refund_id?: string | null;
  status: string;
  amount: string;
  payment_method: string;
  created_at: string;
}

export interface AdminPromo {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  expiry_date: string;
  usage_count?: number;
}

export interface PromoFormData {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expiry_date: string;
}

export interface AdminUser {
  id: number;
  email: string;
  role: 'customer' | 'admin' | 'editor';
  is_active: boolean;
  created_at: string;
}

export interface AdminReview {
  id: number;
  product_id: number;
  product_name: string;
  reviewer_name: string;
  reviewer_email: string;
  rating: number;
  title?: string | null;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}
