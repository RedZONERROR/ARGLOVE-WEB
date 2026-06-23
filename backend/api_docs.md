# ARGLOVE-WEB REST API Documentation

This document contains comprehensive documentation of all backend REST API endpoints.

---

## 1. Global Specifications

* **Base URL**: `http://localhost:5000` (or `http://localhost:<PORT>` matching environment variables)
* **Response Content Type**: `application/json`
* **Authentication**: Token-based authentication using JSON Web Tokens (JWT). Secured endpoints require sending the JWT in the HTTP headers:
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
* **Global Error Format**:
  ```json
  {
    "error": {
      "message": "Detailed error explanation goes here."
    }
  }
  ```

---

## 2. API Reference Index

* [2.1 Authentication & User Profile](#21-authentication--user-profile)
* [2.2 Products & Categories](#22-products--categories)
* [2.3 Promo Codes](#23-promo-codes)
* [2.4 Shopping Cart](#24-shopping-cart)
* [2.5 Wishlist](#25-wishlist)
* [2.6 Address Management](#26-address-management)
* [2.7 Orders & Razorpay Checkout](#27-orders--razorpay-checkout)
* [2.8 Blogs & Comments](#28-blogs--comments)
* [2.9 Unified Polymorphic Resources (Media uploads)](#29-unified-polymorphic-resources-media-uploads)
* [2.10 Razorpay Payments Webhooks](#210-razorpay-payments-webhooks)
* [2.11 Admin Panel APIs](#211-admin-panel-apis)

---

## 2.1 Authentication & User Profile

### Register User
Creates a new customer account.
* **Route**: `POST /api/auth/register`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "password": "customerPassword123"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 2,
      "email": "customer@example.com",
      "role": "customer"
    }
  }
  ```
* **Error Response (400 Bad Request)**:
  ```json
  {
    "error": {
      "message": "Email is already registered."
    }
  }
  ```

### Login User
Authenticates user and returns JWT.
* **Route**: `POST /api/auth/login`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "password": "customerPassword123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 2,
      "email": "customer@example.com",
      "role": "customer"
    }
  }
  ```
* **Error Response (401 Unauthorized)**:
  ```json
  {
    "error": {
      "message": "Invalid credentials."
    }
  }
  ```

### Get Profile
Fetches authenticated user information along with saved addresses.
* **Route**: `GET /api/auth/profile`
* **Authentication**: Required (`Bearer Token`)
* **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": 2,
      "email": "customer@example.com",
      "role": "customer",
      "is_active": 1,
      "created_at": "2026-06-23T12:00:00.000Z"
    },
    "addresses": [
      {
        "id": 1,
        "address_type": "shipping",
        "recipient_name": "Jane Doe",
        "street_address": "123 Maple Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postal_code": "400001",
        "phone_number": "+919876543210"
      }
    ]
  }
  ```

### Forgot Password
Generates password recovery token and fires email.
* **Route**: `POST /api/auth/forgot-password`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "email": "customer@example.com"
  }
  ```
* **Success Response (200 OK - Local / Dev Fallback)**:
  ```json
  {
    "message": "Password reset link generated (dev fallback).",
    "resetUrl": "http://localhost:3000/reset-password?token=a838520cf9...",
    "token": "a838520cf9..."
  }
  ```
* **Success Response (200 OK - Live SMTP Active)**:
  ```json
  {
    "message": "Password reset email sent successfully."
  }
  ```
* **Error Response (404 Not Found)**:
  ```json
  {
    "error": {
      "message": "User with this email does not exist."
    }
  }
  ```

### Reset Password
Updates password using reset token.
* **Route**: `POST /api/auth/reset-password`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "token": "a838520cf9...",
    "password": "newPassword123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Password has been reset successfully."
  }
  ```
* **Error Response (400 Bad Request)**:
  ```json
  {
    "error": {
      "message": "Invalid or expired token."
    }
  }
  ```

---

## 2.2 Products & Categories

### List Products
Lists all active catalog items.
* **Route**: `GET /api/products`
* **Authentication**: None
* **Query Parameters**:
  * `category` (String, Optional): Filter products by category slug (e.g. `?category=footwear`).
  * `search` (String, Optional): Filter products by name match (e.g. `?search=running`).
* **Success Response (200 OK)**:
  ```json
  {
    "products": [
      {
        "id": 1,
        "category_id": 1,
        "name": "Ultralight Running Shoes",
        "description": "Ultra lightweight mesh sports running shoes for athletics.",
        "regular_price": "5999.00",
        "discount_price": "4999.00",
        "stock_quantity": 100,
        "is_published": 1,
        "created_at": "2026-06-23T11:55:00.000Z",
        "updated_at": "2026-06-23T11:55:00.000Z"
      }
    ]
  }
  ```

### List Categories
Lists all nested parent and sub-categories.
* **Route**: `GET /api/products/categories`
* **Authentication**: None
* **Success Response (200 OK)**:
  ```json
  {
    "categories": [
      {
        "id": 1,
        "name": "Footwear",
        "slug": "footwear",
        "parent_id": null
      }
    ]
  }
  ```

### Get Product Details
Fetches full details including media resources (images/videos) bound to a product.
* **Route**: `GET /api/products/:id`
* **Authentication**: None
* **Path Parameters**:
  * `id` (Integer): Product unique ID.
* **Success Response (200 OK)**:
  ```json
  {
    "product": {
      "id": 1,
      "category_id": 1,
      "name": "Ultralight Running Shoes",
      "description": "Ultra lightweight mesh sports running shoes for athletics.",
      "regular_price": "5999.00",
      "discount_price": "4999.00",
      "stock_quantity": 100
    },
    "resources": [
      {
        "id": 1,
        "file_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
        "file_name": "shoe-red.jpg",
        "mime_type": "image/jpeg",
        "file_role": "thumbnail"
      }
    ]
  }
  ```
* **Error Response (404 Not Found)**:
  ```json
  {
    "error": {
      "message": "Product not found."
    }
  }
  ```

---

## 2.3 Promo Codes

### Validate Promo Code
Validates active, unexpired coupons.
* **Route**: `POST /api/promo/validate`
* **Authentication**: None
* **Request Body**:
  ```json
  {
    "code": "WELCOME10"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Promo code is active and valid.",
    "promo": {
      "id": 1,
      "code": "WELCOME10",
      "discount_type": "percentage",
      "discount_value": 10,
      "expiry_date": "2027-06-23T11:55:00.000Z"
    }
  }
  ```
* **Error Response (404 Not Found / 400 Expired)**:
  ```json
  {
    "error": {
      "message": "Invalid promo code."
    }
  }
  ```

---

## 2.4 Shopping Cart

### Get Cart
Retrieves current shopping cart items. Creates a cart session dynamically if one doesn't exist.
* **Route**: `GET /api/cart`
* **Authentication**: Required (`Bearer Token`)
* **Success Response (200 OK)**:
  ```json
  {
    "cart_id": 1,
    "items": [
      {
        "cart_item_id": 5,
        "product_id": 1,
        "name": "Ultralight Running Shoes",
        "regular_price": "5999.00",
        "discount_price": "4999.00",
        "quantity": 2
      }
    ]
  }
  ```

### Add to Cart
Appends a product or increases its quantity in the cart.
* **Route**: `POST /api/cart/add`
* **Authentication**: Required (`Bearer Token`)
* **Request Body**:
  ```json
  {
    "product_id": 1,
    "quantity": 2
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Product added to cart successfully."
  }
  ```
* **Error Response (404 Not Found)**:
  ```json
  {
    "error": {
      "message": "Product not found."
    }
  }
  ```

### Update Cart Quantity
Directly overrides a cart item's quantity.
* **Route**: `PUT /api/cart/update`
* **Authentication**: Required (`Bearer Token`)
* **Request Body**:
  ```json
  {
    "product_id": 1,
    "quantity": 5
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Cart updated successfully."
  }
  ```
* **Error Response (400 Bad Request)**:
  ```json
  {
    "error": {
      "message": "Quantity must be greater than zero."
    }
  }
  ```

### Remove Product from Cart
Deletes product from the cart.
* **Route**: `DELETE /api/cart/remove/:product_id`
* **Authentication**: Required (`Bearer Token`)
* **Path Parameters**:
  * `product_id` (Integer): ID of product to delete.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Product removed from cart successfully."
  }
  ```

---

## 2.5 Wishlist

### Get Wishlist
Retrieves user's saved wishlist products.
* **Route**: `GET /api/wishlist`
* **Authentication**: Required (`Bearer Token`)
* **Success Response (200 OK)**:
  ```json
  {
    "wishlist": [
      {
        "product_id": 1,
        "name": "Ultralight Running Shoes",
        "description": "Ultra lightweight mesh sports running shoes for athletics.",
        "regular_price": "5999.00",
        "discount_price": "4999.00",
        "created_at": "2026-06-23T12:00:00.000Z"
      }
    ]
  }
  ```

### Add to Wishlist
Saves product to user wishlist.
* **Route**: `POST /api/wishlist/add`
* **Authentication**: Required (`Bearer Token`)
* **Request Body**:
  ```json
  {
    "product_id": 1
  }
  ```
* **Success Response (201 Created / 200 OK if existing)**:
  ```json
  {
    "message": "Product added to wishlist successfully."
  }
  ```

### Remove from Wishlist
Removes product from user wishlist.
* **Route**: `DELETE /api/wishlist/remove/:product_id`
* **Authentication**: Required (`Bearer Token`)
* **Path Parameters**:
  * `product_id` (Integer): ID of product to remove.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Product removed from wishlist successfully."
  }
  ```

---

## 2.6 Address Management

### Add Address
Creates customer address.
* **Route**: `POST /api/addresses`
* **Authentication**: Required (`Bearer Token`)
* **Request Body**:
  ```json
  {
    "address_type": "shipping",
    "recipient_name": "Jane Doe",
    "street_address": "123 Maple Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "phone_number": "+919876543210"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Address added successfully.",
    "address": {
      "id": 3,
      "user_id": 2,
      "address_type": "shipping",
      "recipient_name": "Jane Doe",
      "street_address": "123 Maple Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "postal_code": "400001",
      "phone_number": "+919876543210"
    }
  }
  ```

### Update Address
Updates details of an address. Owned user validation is enforced.
* **Route**: `PUT /api/addresses/:id`
* **Authentication**: Required (`Bearer Token`)
* **Path Parameters**:
  * `id` (Integer): Address ID to edit.
* **Request Body**: Same fields as POST.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Address updated successfully.",
    "address": {
      "id": 3,
      "user_id": 2,
      "address_type": "shipping",
      "recipient_name": "Jane Doe (Updated)",
      "street_address": "123 Maple Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "postal_code": "400001",
      "phone_number": "+919876543210"
    }
  }
  ```
* **Error Response (403 Forbidden)**:
  ```json
  {
    "error": {
      "message": "Access denied. You do not own this address."
    }
  }
  ```

### Delete Address
Deletes an address. Owned user validation is enforced.
* **Route**: `DELETE /api/addresses/:id`
* **Authentication**: Required (`Bearer Token`)
* **Path Parameters**:
  * `id` (Integer): Address ID to delete.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Address deleted successfully."
  }
  ```

---

## 2.7 Orders & Razorpay Checkout

### Create Order (Checkout)
Binds cart contents into a pending order and contacts the Razorpay API to generate a gateway Order ID.
* **Route**: `POST /api/orders/create`
* **Authentication**: Required (`Bearer Token`)
* **Request Body**:
  ```json
  {
    "shipping_address": "123 Maple Street, Mumbai, Maharashtra - 400001",
    "promo_code": "WELCOME10"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Order created successfully.",
    "order_id": 8,
    "razorpay_order_id": "order_mock_bc014aef722d515a",
    "amount": 4499.1,
    "currency": "INR"
  }
  ```
* **Error Response (400 Bad Request - Out of Stock)**:
  ```json
  {
    "error": {
      "message": "Insufficient stock for product: Ultralight Running Shoes. Available: 0"
    }
  }
  ```

### Verify and Capture Payment
Validates the cryptographical signature returned by Razorpay Checkout widget. If valid, decrements catalog inventory stock, records transaction payload, logs audit details, and empties the cart.
* **Route**: `POST /api/orders/verify`
* **Authentication**: Required (`Bearer Token`)
* **Request Body**:
  ```json
  {
    "razorpay_order_id": "order_mock_bc014aef722d515a",
    "razorpay_payment_id": "pay_test123456",
    "razorpay_signature": "mock_sig_hash123",
    "payment_method": "UPI"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Payment verified and order captured successfully.",
    "order_id": 8
  }
  ```
* **Error Response (400 Bad Request)**:
  ```json
  {
    "error": {
      "message": "Payment verification failed. Invalid signature."
    }
  }
  ```

### Get Order History
Fetches chronological list of customer checkouts along with items purchased.
* **Route**: `GET /api/orders/history`
* **Authentication**: Required (`Bearer Token`)
* **Success Response (200 OK)**:
  ```json
  {
    "orders": [
      {
        "id": 8,
        "total_amount": "4499.10",
        "status": "processing",
        "created_at": "2026-06-23T12:00:00.000Z",
        "items": [
          {
            "quantity": 1,
            "price_at_purchase": "4499.10",
            "name": "Ultralight Running Shoes"
          }
        ]
      }
    ]
  }
  ```

---

## 2.8 Blogs & Comments

### List Blogs
Lists all articles marked as published.
* **Route**: `GET /api/blogs`
* **Authentication**: None
* **Success Response (200 OK)**:
  ```json
  {
    "blogs": [
      {
        "id": 1,
        "author_id": 1,
        "title": "Top running tips for beginners",
        "content": "Consistent pacing and proper footwear are key components of training...",
        "status": "published",
        "published_at": "2026-06-23T11:55:00.000Z"
      }
    ]
  }
  ```

### Get Blog Details
Retrieves blog contents, banner resources, and user comment history.
* **Route**: `GET /api/blogs/:id`
* **Authentication**: None
* **Path Parameters**:
  * `id` (Integer): Blog unique ID.
* **Success Response (200 OK)**:
  ```json
  {
    "blog": {
      "id": 1,
      "title": "Top running tips for beginners",
      "content": "Consistent pacing and proper footwear are key components of training..."
    },
    "resources": [
      {
        "id": 5,
        "file_url": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f",
        "file_name": "banner.jpg"
      }
    ],
    "comments": [
      {
        "id": 1,
        "comment_body": "This was super informative!",
        "created_at": "2026-06-23T12:00:00.000Z",
        "email": "customer@example.com"
      }
    ]
  }
  ```

### Add Comment on Blog
Adds user comments to an article.
* **Route**: `POST /api/blogs/:id/comment`
* **Authentication**: Required (`Bearer Token`)
* **Path Parameters**:
  * `id` (Integer): Blog unique ID.
* **Request Body**:
  ```json
  {
    "comment_body": "Loved reading this!"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Comment posted successfully.",
    "comment": {
      "id": 2,
      "blog_id": 1,
      "user_id": 2,
      "comment_body": "Loved reading this!"
    }
  }
  ```

---

## 2.9 Unified Polymorphic Resources (Media Uploads)

### Upload Resource File
Saves resource media inside static store (`public/uploads`) and binds database records to a product, blog, or user.
* **Route**: `POST /api/resources/upload`
* **Authentication**: Required (`Bearer Token`)
* **Request Body (Multipart Form-Data)**:
  * `file` (Binary File): Image or video file.
  * `owner_type` (String): Owner model tag (e.g. `'Product'`, `'Blog'`, `'User'`).
  * `owner_id` (Integer): ID of owner.
  * `file_role` (String, Optional): Role classification (e.g., `'thumbnail'`, `'gallery'`, `'avatar'`).
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Resource file uploaded and registered successfully.",
    "resource": {
      "id": 6,
      "file_url": "http://localhost:5000/uploads/1687521155998-test.jpg",
      "file_name": "test.jpg",
      "mime_type": "image/jpeg",
      "owner_type": "Product",
      "owner_id": 1,
      "file_role": "gallery"
    }
  }
  ```

### Delete Resource File
Deletes media resource reference from database and removes static file from disk.
* **Route**: `DELETE /api/resources/:id`
* **Authentication**: Required (`Bearer Token`)
* **Path Parameters**:
  * `id` (Integer): Resource record ID.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Resource file deleted successfully."
  }
  ```

---

## 2.10 Razorpay Payments Webhooks

### Process Razorpay Webhook Event
Asynchronously verifies raw body signatures sent by Razorpay gateway, parses payment events (`payment.captured` or `order.paid`), saves local transaction record, reduces stock levels, and flags local orders.
* **Route**: `POST /api/payments/webhook`
* **Authentication**: Signature matching check via HTTP Header `X-Razorpay-Signature` (SHA-256 HMAC of raw body payload).
* **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Webhook processed successfully."
  }
  ```
* **Error Response (400 Bad Request)**:
  ```json
  {
    "error": {
      "message": "Invalid webhook signature."
    }
  }
  ```

---

## 2.11 Admin Panel APIs

*All routes in this section require `Bearer Token` authentication and users role level validation (`role === 'admin'`).*

### Admin: Create Product
Creates catalog items.
* **Route**: `POST /api/admin/products`
* **Request Body**:
  ```json
  {
    "name": "Leather Dress Shoes",
    "description": "Hand-stitched premium leather shoes.",
    "regular_price": 7999.00,
    "discount_price": 6999.00,
    "stock_quantity": 25,
    "category_id": 1
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Product created successfully.",
    "product": {
      "id": 3,
      "category_id": 1,
      "name": "Leather Dress Shoes",
      "description": "Hand-stitched premium leather shoes.",
      "regular_price": 7999,
      "discount_price": 6999,
      "stock_quantity": 25,
      "is_published": true
    }
  }
  ```

### Admin: Update Product
Modifies details of catalog items.
* **Route**: `PUT /api/admin/products/:id`
* **Request Body**: Same parameters as create.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Product updated successfully.",
    "product": {
      "id": 3,
      "category_id": 1,
      "name": "Leather Dress Shoes (Updated)",
      "description": "Updated premium leather shoes.",
      "regular_price": 8499,
      "discount_price": null,
      "stock_quantity": 30
    }
  }
  ```

### Admin: Archive (Delete) Product
Soft-archives products (`is_published = FALSE`) so past orders history details remain undamaged.
* **Route**: `DELETE /api/admin/products/:id`
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Product archived successfully."
  }
  ```

### Admin: Create Category
Creates categories.
* **Route**: `POST /api/admin/categories`
* **Request Body**:
  ```json
  {
    "name": "Accessories",
    "slug": "accessories",
    "parent_id": null
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Category created successfully.",
    "category": {
      "id": 3,
      "name": "Accessories",
      "slug": "accessories",
      "parent_id": null
    }
  }
  ```

### Admin: Update Category
Modifies name, parent reference, or slug of a category.
* **Route**: `PUT /api/admin/categories/:id`
* **Path Parameters**:
  * `id` (Integer): Category ID to edit.
* **Request Body**:
  ```json
  {
    "name": "Accessories & Bags",
    "slug": "accessories-and-bags",
    "parent_id": null
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Category updated successfully.",
    "category": {
      "id": 3,
      "name": "Accessories & Bags",
      "slug": "accessories-and-bags",
      "parent_id": null
    }
  }
  ```

### Admin: Delete Category
Deletes a category reference. Products and child sub-categories referencing it will safely set parent to NULL.
* **Route**: `DELETE /api/admin/categories/:id`
* **Path Parameters**:
  * `id` (Integer): Category ID to delete.
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Category deleted successfully."
  }
  ```

### Admin: Update Order Fulfillment Status
Updates order status. Restores inventory stock quantities if status transitions to `'cancelled'` from `'processing'` or `'completed'`.
* **Route**: `PUT /api/admin/orders/:id/status`
* **Request Body**:
  ```json
  {
    "status": "cancelled"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Order status updated successfully.",
    "status": "cancelled"
  }
  ```

### Admin: List All Orders
Retrieves historical queue of all customer checkouts in the system.
* **Route**: `GET /api/admin/orders`
* **Success Response (200 OK)**:
  ```json
  {
    "orders": [
      {
        "id": 8,
        "user_id": 2,
        "total_amount": "4499.10",
        "status": "processing",
        "created_at": "2026-06-23T12:00:00.000Z",
        "user_email": "customer@example.com",
        "items": [
          {
            "quantity": 1,
            "price_at_purchase": "4499.10",
            "name": "Ultralight Running Shoes"
          }
        ]
      }
    ]
  }
  ```

### Admin: Get Order Details by ID
Retrieves single order details, order items, and associated payment gateway log attempts.
* **Route**: `GET /api/admin/orders/:id`
* **Path Parameters**:
  * `id` (Integer): Order unique ID.
* **Success Response (200 OK)**:
  ```json
  {
    "order": {
      "id": 8,
      "user_id": 2,
      "total_amount": "4499.10",
      "status": "processing",
      "created_at": "2026-06-23T12:00:00.000Z",
      "user_email": "customer@example.com"
    },
    "items": [
      {
        "quantity": 1,
        "price_at_purchase": "4499.10",
        "product_id": 1,
        "name": "Ultralight Running Shoes"
      }
    ],
    "payments": [
      {
        "id": 4,
        "order_id": 8,
        "razorpay_order_id": "order_mock_bc014aef722d515a",
        "razorpay_payment_id": "pay_test123456",
        "status": "captured",
        "amount": "4499.10"
      }
    ]
  }
  ```

### Admin: List Users
Lists all user accounts registered in the database.
* **Route**: `GET /api/admin/users`
* **Success Response (200 OK)**:
  ```json
  {
    "users": [
      {
        "id": 2,
        "email": "customer@example.com",
        "role": "customer",
        "is_active": 1,
        "created_at": "2026-06-23T12:00:00.000Z",
        "updated_at": "2026-06-23T12:00:00.000Z"
      }
    ]
  }
  ```

### Admin: Toggle User Active Status
Activates or deactivates a user's account access permission.
* **Route**: `PUT /api/admin/users/:id/status`
* **Path Parameters**:
  * `id` (Integer): Target user ID.
* **Request Body**:
  ```json
  {
    "is_active": false
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "User status updated successfully.",
    "is_active": false
  }
  ```

### Admin: Dashboard Stats & Audit Log
Retrieves total earnings metrics, low stock warnings, users counts, order numbers, and activity logs.
* **Route**: `GET /api/admin/dashboard`
* **Success Response (200 OK)**:
  ```json
  {
    "metrics": {
      "total_revenue": 15998,
      "total_customers": 2,
      "order_stats": {
        "pending": 1,
        "processing": 1,
        "completed": 1,
        "cancelled": 0
      },
      "low_stock_alerts": [
        {
          "id": 2,
          "name": "Classic Cotton Hoodie",
          "stock_quantity": 5
        }
      ],
      "recent_logs": [
        {
          "id": 12,
          "action": "Admin updated order #8 status to cancelled",
          "ip_address": "127.0.0.1",
          "created_at": "2026-06-23T12:00:00.000Z",
          "user_email": "admin@arglove.com"
        }
      ]
    }
  }
  ```
