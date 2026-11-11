# E-Commerce Store — Backend

Node.js + Express + MongoDB (Mongoose) REST API for the store: products, cart, orders with
payment status, an admin dashboard, ticket booking (country → airline/bus/train → company →
tickets), real payment gateways, reviews, wishlist, image upload and order emails.

The React frontend lives in a separate folder (`ecommerce-frontend`) with its own README.

## Tech stack

- Node.js 18+, Express
- MongoDB with Mongoose (no SQL)
- JWT authentication, bcrypt-hashed passwords
- Payments: Stripe, SSLCommerz, bKash (each optional), cash on delivery, demo "test payment"
- Email through SMTP (nodemailer) — Gmail, Resend, etc.
- Image upload with multer

## Project structure

```
ecommerce-backend/
├── server.js                  app entry (CORS, Stripe webhook raw body, routes)
├── package.json
├── .env.example               every setting, documented
├── .gitignore
├── render.yaml                Render blueprint
├── DEPLOYMENT.md              MongoDB Atlas + Render guide
├── config/
│   ├── db.js                  MongoDB connection
│   └── urls.js                client/server URLs, test-payment switch
├── models/                    User, Product (products + tickets), Cart, Order,
│                              Review, Country, Company
├── controllers/               auth, product, cart, order, payment, review,
│                              wishlist, travel, admin
├── routes/                    one file per controller, plus uploadRoutes
├── services/
│   ├── email.js               SMTP order emails
│   ├── orderService.js        mark paid/failed exactly once, restore stock
│   └── payments/              stripe.js, sslcommerz.js, bkash.js
├── middleware/                auth.js (JWT + admin guard), errorHandler.js
├── seed/seedData.js           sample products, countries, companies, tickets, admin
└── uploads/                   uploaded product images
```

## Setup

1. **Get MongoDB.** Run it locally (`mongod`) or create a free cluster on
   [MongoDB Atlas](https://www.mongodb.com/atlas) and copy its connection string.

2. **Install dependencies**
   ```bash
   cd ecommerce-backend
   npm install
   ```

3. **Create your `.env`** by copying `.env.example` to `.env`. The minimum to run locally:
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/ecommerce_store
   PORT=5000
   JWT_SECRET=a_long_random_string_at_least_32_characters
   JWT_EXPIRES_IN=7d
   CLIENT_ORIGIN=http://localhost:5173
   SERVER_URL=http://localhost:5000
   ```
   Everything else (payments, email) is optional; see the table below.

4. **Load sample data** (12 products, 8 countries, 46 airline/bus/train companies,
   138 sample tickets, and an admin user):
   ```bash
   npm run seed
   ```
   Demo admin login: `admin@example.com` / `Admin@123`.
   > The seed script **deletes and recreates** products and travel data. Run it once on a new
   > database, never on a live store. Change the demo admin password before going live.

5. **Start the server**
   ```bash
   npm run dev      # auto-restarts on file changes (nodemon)
   npm start        # plain start
   ```
   Open `http://localhost:5000`. You should see `{"message":"E-Commerce Store API is running"}`.

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with nodemon (development) |
| `npm start` | Start normally (production) |
| `npm run seed` | Reset and load sample data + demo admin |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `PORT` | no (5000) | Port the API listens on |
| `JWT_SECRET` | yes | Secret used to sign login tokens |
| `JWT_EXPIRES_IN` | no (7d) | Token lifetime |
| `CLIENT_ORIGIN` | yes | Frontend URL(s) allowed by CORS, comma-separated |
| `SERVER_URL` | yes | Public URL of this backend (payment gateways call back to it) |
| `NODE_ENV` | no | `production` when deployed |
| `PAYMENT_ALLOW_MOCK` | no | `true`/`false`. Test payment on/off. Default: on in development, off in production |
| `USD_TO_BDT_RATE` | no (122) | Prices are USD; SSLCommerz/bKash charge BDT using this rate. Keep it current |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY` | no | Enables card payments via Stripe |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE`, `SSLCOMMERZ_CURRENCY` | no | Enables SSLCommerz |
| `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_IS_LIVE` | no | Enables bKash |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | Enables emails (skipped and logged if blank) |

A payment method shows up at checkout only when its keys are present. Restart the server
after any `.env` change.

## API reference

All bodies are JSON. Protected routes need `Authorization: Bearer <token>`.

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ name, email, password, phone? }` → user + token |
| POST | `/api/auth/login` | — | `{ email, password }` → user + token |
| GET | `/api/auth/me` | user | Current user |

### Products
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | — | Query: `category`, `search`, `minPrice`, `maxPrice`, `page`, `limit`. Returns shop products only unless `kind=ticket` |
| GET | `/api/products/categories` | — | Distinct categories |
| GET | `/api/products/:id` | — | One product |
| POST / PUT / DELETE | `/api/products[/:id]` | admin | Create / update / delete |

### Tickets (country → airline/bus/train → company → tickets)
Tickets live in the same `products` collection with `kind: "ticket"` (seats = `stock`), so
they use the same cart, checkout and payment flow.

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/travel/countries` | — | All countries |
| GET | `/api/travel/companies?country=<id>&mode=airline\|bus\|train` | — | Operators for a country / transport type |
| GET | `/api/products?kind=ticket&company=<id>` | — | Tickets for a company (also `country`, `mode`) |
| POST | `/api/travel/countries`, `/api/travel/companies` | admin | Add a country / operator |
| POST | `/api/products` | admin | Add a ticket: `kind:"ticket"` + `country, company, mode, from, to, departureTime, arrivalTime, travelClass` |

**About the data:** operator names are real companies. Routes, times, prices and seat counts
are sample data for the demo; edit them in the admin Tickets tab. Please verify operator names
for your target countries before launch.

### Cart
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | user | Your cart |
| POST | `/api/cart` | user | `{ productId, quantity }` |
| PUT | `/api/cart/:itemId` | user | `{ quantity }` (0 removes) |
| DELETE | `/api/cart/:itemId` | user | Remove an item |
| DELETE | `/api/cart` | user | Empty the cart |

### Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | user | `{ paymentMethod, contactEmail?, shippingAddress }`. Creates an order from the cart, takes stock, empties the cart. `paymentMethod`: `card` (Stripe), `sslcommerz`, `bkash`, `cash_on_delivery`, `test_payment` |
| GET | `/api/orders/my` | user | Your orders |
| GET | `/api/orders/:id` | owner/admin | One order |
| GET | `/api/orders` | admin | All orders |
| PUT | `/api/orders/:id/status` | admin | `{ orderStatus?, paymentStatus? }`. Cancelling returns stock; shipped/delivered/cancelled send an email |

`shippingAddress`: `{ fullName, addressLine, city, postalCode?, country, phone? }`.
Cash-on-delivery orders start as `confirmed`; others start as `processing` with
`paymentStatus: pending`.

### Payments
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/payments/config` | — | Which methods are enabled |
| POST | `/api/payments/:orderId/start` | user | Returns `{ redirectUrl }` (Stripe/SSLCommerz/bKash), `{ paid }` (test) or `{ cod }`. Can be called again to retry a failed payment |
| POST | `/api/payments/:orderId/confirm` | user | Re-checks a Stripe session after the customer returns |
| POST | `/api/payments/stripe/webhook` | Stripe | Signed webhook (raw body) |
| POST | `/api/payments/sslcommerz/success\|fail\|cancel\|ipn` | gateway | SSLCommerz callbacks |
| GET | `/api/payments/bkash/callback` | gateway | bKash redirect |

How payment is kept safe: an order becomes `paid` **only after the provider's server confirms
it** with the right amount (Stripe session or signed webhook, SSLCommerz validation API, bKash
execute call). A forged callback, a tampered webhook or a wrong amount does not mark an order
paid. The test method is blocked when `PAYMENT_ALLOW_MOCK=false`.

Local testing: SSLCommerz and bKash send the customer's browser back to `SERVER_URL`, which
works on `localhost`. The SSLCommerz IPN and the Stripe webhook need a public URL (or the
Stripe CLI), but the app also confirms Stripe payments when the customer returns.

### Reviews & wishlist
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/products/:id/reviews` | — | Reviews + average |
| POST | `/api/products/:id/reviews` | user | `{ rating 1-5, comment }`. Adds or updates your review ("Verified purchase" if you paid for it) |
| DELETE | `/api/products/:id/reviews/:reviewId` | owner/admin | Delete |
| GET | `/api/wishlist` | user | Saved products |
| POST / DELETE | `/api/wishlist/:productId` | user | Add / remove |

### Image upload
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/upload` | admin | multipart field `image` (JPG/PNG/WEBP/GIF, max 2 MB) → `{ url }` |

Files are saved in `uploads/` and served at `/uploads/<file>`. On hosts with a temporary disk
(for example Render's free plan) uploads disappear on redeploy; use Cloudinary/S3 or paste
hosted image URLs for production.

### Admin
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | admin | Revenue, order counts by payment status, product/customer counts, low-stock count |

### Emails
Sent when a payment is confirmed, a cash-on-delivery order is placed, and when an admin marks
an order shipped, delivered or cancelled. With no SMTP settings, emails are skipped and logged.
Gmail: `smtp.gmail.com`, port 465, an App password. Resend: `smtp.resend.com`, port 465, user
`resend`, API key as password.

## Data models (MongoDB / Mongoose)

- **User**: `name, email, password (hashed), role (user|admin), phone, wishlist[]`
- **Product**: `kind (product|ticket), name, description, category, price, currency, stock, imageUrl, brand, isActive, ratingAvg, ratingCount`; ticket-only: `country, company, mode, from, to, departureTime, arrivalTime, travelClass`
- **Country**: `name, code, flag`
- **Company**: `name, mode (airline|bus|train), country`
- **Cart**: one per user, `items[{ product, quantity, priceAtAdd }]`
- **Order**: `user, items[], totalAmount, shippingAddress, paymentMethod, paymentStatus (pending|paid|failed|refunded), paymentProvider, providerRef, transactionId, orderStatus (processing|confirmed|shipped|delivered|cancelled), contactEmail`
- **Review**: `product, user, rating, comment, verifiedPurchase` (one per user per product)

## Troubleshooting

| Problem | Fix |
|---|---|
| `MongoDB connection failed` | MongoDB isn't running or `MONGO_URI` is wrong. Atlas: allow your IP under Network Access |
| Frontend shows `ERR_CONNECTION_REFUSED` on port 5000 | The backend isn't running. Start it with `npm run dev` |
| `secretOrPrivateKey must have a value` | `.env` is missing or has no `JWT_SECRET` |
| `EADDRINUSE` | Port 5000 is taken. Change `PORT` here and `VITE_API_BASE_URL` in the frontend |
| CORS error in the browser | `CLIENT_ORIGIN` doesn't match the frontend URL exactly (no trailing slash) |
| A payment method is missing at checkout | Its keys aren't set in `.env`, or the server wasn't restarted |
| `401` after changing `JWT_SECRET` | Log out and log in again |

## Deployment

See `DEPLOYMENT.md` (MongoDB Atlas + Render). `render.yaml` is a ready-made Render blueprint.
Remember: set `NODE_ENV=production`, `PAYMENT_ALLOW_MOCK=false`, and update `CLIENT_ORIGIN` and
`SERVER_URL`.
