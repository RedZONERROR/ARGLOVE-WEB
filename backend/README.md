# ARGLOVE-WEB Backend Setup Instructions

Welcome to the backend service of ARGLOVE-WEB. This document details the step-by-step setup procedure, environment configuration, database installation, and pre-seeded database accounts.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your system:
* **Node.js** (v16.x or higher recommended)
* **XAMPP** (or any standalone MySQL server running locally on port `3306`)

---

## 2. Getting Started

### Step 1: Install Dependencies
Run the following command in the `backend` directory to install the required packages (`mysql2` and `dotenv`):
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy the `.env.example` file to create a `.env` file:
```bash
cp .env.example .env
```
Ensure your `.env` contains correct MySQL server details. By default:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=argloveweb

RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
PORT=5000
```

### Step 3: Run Database Setup & Seeding
Start your local XAMPP MySQL server, then execute the following command:
```bash
npm run setup
```
This script will:
1. Connect to MySQL.
2. Create the database `argloveweb` if it doesn't already exist.
3. Build all 14 schema tables.
4. Inject initial mockup seed data.

---

## 3. Seeded Database Information

After running `npm run setup`, the database is populated with the following resources:

### Admin Account
* **Email**: `admin@arglove.com`
* **Password**: `adminpassword123` *(Securely hashed in the database using SHA-256)*
* **Role**: `admin`

### Customer Account
* **Email**: `customer@example.com`
* **Password**: `customer123` *(Securely hashed in the database using SHA-256)*
* **Role**: `customer`

### Seeded Catalog & Resources
* **Categories**:
  * `Footwear` (slug: `footwear`)
  * `Apparel` (slug: `apparel`)
* **Products**:
  * **Ultralight Running Shoes**: Price: `5,999.00 INR` (Discounted to `4,999.00 INR`) | Stock: `100` | Category: `Footwear`
  * **Classic Cotton Hoodie**: Price: `2,999.00 INR` | Stock: `50` | Category: `Apparel`
* **Product Media / Resources**:
  * Cover image links pointing to mock image assets on Unsplash.
* **Promo Code**:
  * `WELCOME10`: 10% percentage discount, expires in 1 year.
* **Blog Post**:
  * **Title**: "Top running tips for beginners"
  * **Status**: `Published`
  * **Author**: `admin@arglove.com`

---

## 4. Running the App

* **Start the server**: `npm start`
* **Run in Development Mode (requires nodemon)**: `npm run dev`
* **Rebuild/Re-seed Database**: `npm run setup`
