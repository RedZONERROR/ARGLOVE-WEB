const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper for fetch options with authentication token
function getHeaders() {
  const token = localStorage.getItem('arglove_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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

  // Products
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/products`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch products');
    return data.products;
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

  async addToCart(productId: number, quantity = 1) {
    const res = await fetch(`${BASE_URL}/cart/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ product_id: productId, quantity })
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
  }
};
