# ARGLOVE-WEB

ARGLOVE-WEB is a complete e-commerce shopping website project featuring a Node.js backend, MySQL database, and Razorpay payment gateway integration.

---

## 1. Project Directory Structure

```
ARGLOVE-WEB/
├── backend/                  # Node.js backend & API service
│   ├── .env.example          # Environment variables template
│   ├── database_schema.md    # Detailed database design and ER diagram
│   ├── index.js              # Server entry point
│   ├── package.json          # Node dependencies and npm scripts
│   ├── README.md             # Backend setup guide and seed data information
│   └── setup.js              # Database automation and seeding script
│
├── frontend/                 # Client-side user interface
│   └── .gitkeep              # Placeholder for frontend codebase
│
└── README.md                 # Project root documentation (this file)
```

---

## 2. Component Overviews

### Backend (`/backend`)
A Node.js service containing:
* **Database Management**: Schema creation and automated data seeding via `mysql2`.
* **Integrations**: Fully configured for Razorpay transactions.
* **Database Design**: Includes 14 primary tables spanning users, products, categories, orders, payments, shopping carts, promo codes, logs, and blogs.
* **Detailed Documentation**: Refer to the backend's specific [database_schema.md](file:///c:/GitHub/ARGLOVE-WEB/backend/database_schema.md) and [README.md](file:///c:/GitHub/ARGLOVE-WEB/backend/README.md) for credentials and schemas.

### Frontend (`/frontend`)
The client-side visual interface of the e-commerce store. 

---

## 3. Quick Start

### 1. Setup Backend
1. Open the `/backend` folder.
2. Follow the setup guide in [backend/README.md](file:///c:/GitHub/ARGLOVE-WEB/backend/README.md) to set up your local database and environment.
3. Install dependencies and run the setup script:
   ```bash
   cd backend
   npm install
   npm run setup
   ```

### 2. Setup Frontend
*(Coming soon)*
- Navigate to the `/frontend` directory and configure the client assets.
