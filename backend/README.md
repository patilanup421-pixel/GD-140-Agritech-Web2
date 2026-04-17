# Agritech Backend API

A comprehensive backend system for an Agritech platform connecting buyers and farmers with location-based order tracking.

## 🚀 Features

- **Dual Role System**: Separate authentication and dashboards for Buyers and Farmers
- **JWT Authentication**: Secure token-based authentication with role-based access control
- **Supabase Data Storage**: Login/signup credentials and product prices are stored in Supabase PostgreSQL
- **Product Management**: Farmers can upload product images to a Supabase Storage bucket
- **Order System**: Complete order lifecycle with status tracking
- **Location Integration**: GPS coordinates + Google Maps for delivery tracking
- **Real-time Updates**: Socket.io for live notifications
- **Analytics Dashboard**: Comprehensive statistics for farmers
- **Security**: Password hashing, input validation, rate limiting, CORS protection

## 📋 Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Supabase/Neon compatible)
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Supabase Storage + Multer
- **Real-time**: Socket.io
- **Security**: bcrypt, helmet, express-rate-limit

## 🛠️ Installation

1. **Clone the repository**
```bash
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PORT=5000
NODE_ENV=development

# PostgreSQL Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/agritech

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# Supabase Storage (for product image uploads)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_STORAGE_BUCKET=product-images

# Google Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Frontend URL
FRONTEND_URL=http://localhost:8000
```

4. **Initialize database**
```bash
npm run db:init
```

5. **Start the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000`

## 📚 API Documentation

### Authentication

#### Signup
```http
POST /api/auth/signup
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "buyer" // or "farmer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "buyer",
      "name": "John Doe"
    },
    "token": "jwt_token_here"
  }
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Buyer Routes

#### Get Profile
```http
GET /api/buyer/profile
Authorization: Bearer <token>
```

#### Update Profile (with location)
```http
PUT /api/buyer/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Doe",
  "address": "123 Main St, City",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

#### Get My Orders
```http
GET /api/buyer/orders
Authorization: Bearer <token>
```

### Farmer Routes

#### Create Product (with image)
```http
POST /api/farmer/product
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image`: [File]
- `name`: "Organic Tomatoes"
- `description`: "Fresh organic tomatoes"
- `price`: 5.99
- `quantity`: 100
- `unit`: "kg" (optional)
- `category`: "vegetables" (optional)

#### Get My Products
```http
GET /api/farmer/products
Authorization: Bearer <token>
```

#### Update Product
```http
PUT /api/farmer/product/:id
Authorization: Bearer <token>
```

#### Delete Product
```http
DELETE /api/farmer/product/:id
Authorization: Bearer <token>
```

#### Get Farmer Profile
```http
GET /api/farmer/profile
Authorization: Bearer <token>
```

### Orders Routes

#### Place Order (Buyer)
```http
POST /api/orders
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "product_id": "uuid",
  "quantity": 5,
  "buyer_address": "123 Main St, City",
  "buyer_latitude": 40.7128,
  "buyer_longitude": -74.0060,
  "notes": "Please deliver in the morning"
}
```

#### Get Orders (Farmer)
```http
GET /api/orders/farmer?status=pending
Authorization: Bearer <token>
```

Query parameters:
- `status`: pending | accepted | shipped | delivered | cancelled (optional)

#### Get Order Details (with Google Maps link)
```http
GET /api/orders/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "buyer_name": "John Doe",
    "buyer_address": "123 Main St, City",
    "buyer_latitude": 40.7128,
    "buyer_longitude": -74.0060,
    "maps_url": "https://www.google.com/maps?q=40.7128,-74.0060",
    "status": "pending",
    "product_name": "Organic Tomatoes",
    "quantity": 5,
    "total_price": 29.95
  }
}
```

#### Update Order Status (Farmer)
```http
PUT /api/orders/:id/status
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "accepted" // pending | accepted | shipped | delivered | cancelled
}
```

#### Browse All Products (Public)
```http
GET /api/orders/products?category=vegetables&available=true
```

### Analytics Routes

#### Farmer Dashboard Analytics
```http
GET /api/analytics/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_orders": 150,
      "total_revenue": 5420.50
    },
    "orders_by_status": [
      { "status": "pending", "count": 10 },
      { "status": "accepted", "count": 5 },
      { "status": "delivered", "count": 135 }
    ],
    "top_products": [
      {
        "id": "uuid",
        "name": "Organic Tomatoes",
        "total_sold": 500,
        "total_revenue": 2995.00
      }
    ],
    "recent_orders": [...],
    "revenue_by_month": [...]
  }
}
```

## 🗄️ Database Schema

### Tables

1. **users** - Authentication table
   - id, email, password, role, created_at, updated_at

2. **buyers** - Buyer profiles
   - id (FK), name, email, address, latitude, longitude

3. **farmers** - Farmer profiles
   - id (FK), name, email, farm_name, farm_address, phone

4. **products** - Product listings
   - id, farmer_id (FK), name, description, price, quantity, unit, image_url, category, is_available

5. **orders** - Order management
   - id, buyer_id (FK), product_id (FK), farmer_id (FK), quantity, total_price, status, buyer_address, buyer_latitude, buyer_longitude, notes

## 🔌 Socket.io Events

### Client → Server

```javascript
// Join role-based room
socket.emit('join', { userId: 'uuid', role: 'farmer' });
```

### Server → Client

```javascript
// Farmer receives new order notification
socket.on('new_order', (data) => {
  console.log('New order:', data);
});

// Buyer receives order status update
socket.on('order_status_update', (data) => {
  console.log('Order status:', data);
});
```

## 🌍 Google Maps Integration

Each order includes buyer's GPS coordinates. Farmers can view delivery locations:

```javascript
// Frontend implementation
const order = await fetchOrder(orderId);
const mapsUrl = order.data.maps_url;
window.open(mapsUrl, '_blank');
```

## 🔒 Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Role-based access control
- ✅ Input validation with express-validator
- ✅ Rate limiting (100 requests per 15 min)
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ SQL injection protection (parameterized queries)

## 📦 Project Structure

```
backend/
├── database/
│   ├── pool.js          # Database connection
│   └── init.js          # Database initialization
├── middleware/
│   ├── auth.js          # JWT authentication
│   └── validation.js    # Input validation
├── routes/
│   ├── auth.js          # Auth routes
│   ├── buyer.js         # Buyer routes
│   ├── farmer.js        # Farmer routes
│   ├── orders.js        # Order routes
│   └── analytics.js     # Analytics routes
├── utils/
│   ├── supabaseStorage.js # Supabase Storage utility
│   └── token.js         # JWT utility
├── server.js            # Main server file
├── .env                 # Environment variables
├── .env.example         # Environment template
└── package.json
```

## 🧪 Testing with Postman

1. Import the API endpoints
2. Create a new buyer/farmer account via `/api/auth/signup`
3. Login to get JWT token
4. Add token to Authorization header: `Bearer <token>`
5. Test all endpoints

## 🚀 Deployment

### Supabase/Neon Database

1. Create a PostgreSQL database on Supabase or Neon
2. Update `DATABASE_URL` in `.env`
3. Run `npm run db:init`

### Supabase Storage Setup
1. Open Supabase Dashboard → **Storage**.
2. Create a public bucket (default name in this project: `product-images`).
3. Set `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET`, and one key in `.env` (`SUPABASE_SERVICE_ROLE_KEY` recommended; `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` can be used as fallback with proper Storage policies).

### Production Deployment

```bash
# Set NODE_ENV=production
# Update JWT_SECRET with strong random string
# Configure CORS for your domain
npm start
```

## 📝 Example Frontend Integration

```javascript
// Place order with location
const placeOrder = async (productId, quantity) => {
  const position = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve);
  });
  
  const response = await fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      product_id: productId,
      quantity: quantity,
      buyer_latitude: position.coords.latitude,
      buyer_longitude: position.coords.longitude
    })
  });
  
  return response.json();
};
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📄 License

MIT License

## 👨‍💻 Author

Built for Agritech Platform - Connecting Farmers and Buyers

---

**Need Help?** Check the API documentation or contact support.
