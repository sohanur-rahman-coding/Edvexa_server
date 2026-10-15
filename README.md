# 🚀 Edvexa Server | Node.js & Express REST API

> **Candidate Assignment for Software Engineer Intern at Edvexa**  
> An enterprise-grade e-commerce backend built with **Node.js**, **Express**, **MongoDB Atlas Native Driver**, and **Stripe Payment Gateway**. Specifically engineered for **zero overselling under high concurrency** and **strict idempotency against duplicate orders**.

---

## 🌟 Executive Summary & Key Highlights

| Feature / Requirement | Implementation in Edvexa Server | Status |
| :--- | :--- | :---: |
| **Authentication & RBAC** | JWT-based Bearer token authentication with role-based route guards (`admin` vs `customer`). | ✅ Verified |
| **Concurrency & Zero Overselling** | Atomic MongoDB `$inc` operators with conditional `$gte` quantity filters inside multi-document ACID transactions. Stock can **never become negative**. | ✅ Verified |
| **Idempotency** | Server-side deduplication caching with unique sparse index and TTL; prevents duplicate orders or inventory deductions on network retries. | ✅ Verified |
| **Order Lifecycle Pipeline** | Enforced 4-stage transitions: `Pending` ➔ `Confirmed` ➔ `Shipped` ➔ `Delivered` with timestamped progression. | ✅ Verified |
| **Inventory Restoration** | Dynamic order cancellation with atomic stock restoration back into inventory. | ✅ Verified |
| **Real Stripe Payment Gateway** | Native Stripe Payment Intents API for secure credit card checkout. | ✅ Verified |
| **Rich 20-Product Catalog** | Pre-seeded with 20 realistic products across 8 categories, demonstrating healthy stock, low stock warnings (≤ 5 units), and sold-out states. | ✅ Verified |
| **Automated Testing** | 15/15 passing integration tests in Jest & Supertest covering concurrency race conditions (5 buyers on 1 item), stock limits, and idempotency replays. | ✅ Verified |
| **CodeZero AI Assisted Workflow** | Developed and architected leveraging the **CodeZero AI** platform & VS Code extension. | ✅ Verified |

---

## 🤖 AI-Assisted Workflow with CodeZero AI

In accordance with the Edvexa development guidelines, this platform was built and refined using **CodeZero** ([https://frigga.cloud/codezero](https://frigga.cloud/codezero)).

### How CodeZero AI Was Leveraged on the Server:
1. **Concurrency Architecture & Race-Condition Defense**:
   - Used CodeZero to model atomic conditional MongoDB queries (`{ _id: id, stock: { $gte: quantity } }`) and design fallback compensating rollback loops for non-replica MongoDB clusters.
2. **Idempotency Deduplication Middleware**:
   - Formulated the database-backed deduplication layer with unique sparse indexes and TTL expirations using AI-guided pattern validation.
3. **Automated Concurrency Test Suite**:
   - Generated and refined multi-promise asynchronous test cases in Jest simulating 5 concurrent customer purchase attempts on a single remaining inventory item.
4. **Database Seeding & Edge-Case Modeling**:
   - Crafted the 20-product catalog seed script to cover out-of-stock, low stock (≤ 5), and single-stock concurrency stress-test scenarios.

### 💡 Using CodeZero in VS Code
1. **Sign In**: Open the CodeZero panel or press `Ctrl+Shift+P` / `Cmd+Shift+P` and choose `CodeZero: Sign In` via [Frigga Cloud](https://frigga.cloud/codezero).
2. **Review Code**: Open any backend file (e.g., `src/controllers/orderController.js` or `tests/orders_concurrency.test.js`) and ask CodeZero:
   - `@workspace Explain how zero overselling is achieved in orderController.js`
   - `@workspace How does the idempotencyMiddleware prevent duplicate orders on network retries?`

---

## 🛡️ Deep Dive: Solving Core Technical Challenges

### 1. Zero Overselling (Race Condition Prevention)
* **The Problem**: Checking stock (`if product.stock >= qty`) followed by an update (`product.stock -= qty`) introduces a critical Time-of-Check to Time-of-Use (**TOCTOU**) race condition. When multiple customers purchase the last remaining item simultaneously, both checks pass, causing stock to plummet into negative numbers.
* **Our Solution**:
  1. **Atomic Conditional Update**:
     ```javascript
     const product = await db.collection("products").findOneAndUpdate(
       { _id: new ObjectId(productId), stock: { $gte: item.quantity } },
       { $inc: { stock: -item.quantity } },
       { session, returnDocument: "after" }
     );
     if (!product) {
       throw new BadRequestError(`Insufficient stock for '${existingProd.title}'.`);
     }
     ```
  2. **Multi-Document ACID Session Transactions**: All items in a cart checkout are processed inside a `session.withTransaction(...)`. If any single item lacks stock, the entire transaction is automatically rolled back, leaving all product stocks untouched.
  3. **Compensating Rollback Fallback**: For environments without replica sets, a compensating rollback algorithm atomically restores any partially deducted items if a subsequent item fails.

### 2. Duplicate Order Prevention (Idempotency)
* **The Problem**: Network latency or multiple rapid button clicks can fire identical HTTP requests, resulting in duplicate charges and stock deductions.
* **Our Solution**:
  1. Client sends an `Idempotency-Key` header with each checkout request.
  2. The `idempotencyMiddleware`:
     - If the key is **completed**: Immediately replays the original cached response with `X-Idempotent-Replay: true` without touching inventory.
     - If the key is **processing**: Responds with `409 Conflict`.
     - If the key is **new**: Atomically locks the key, processes the order, caches the result, and sets a 24-hour TTL for automatic MongoDB cleanup.
  3. The `orders` collection enforces a unique sparse index on `idempotencyKey` as an immutable database constraint.

---

## 📦 20 Pre-Seeded Products Breakdown

Our database seed script (`npm run seed`) populates **20 realistic, high-quality products** across 8 categories with edge-case scenarios:

| # | Product Title | Category | Price | Stock | Scenario Tested |
| :-: | :--- | :--- | :-: | :-: | :--- |
| 1 | **MacBook Pro 16" M3 Max** | Laptops | $3,499.00 | 12 | Healthy Stock |
| 2 | **Sony WH-1000XM5 Headphones** | Audio | $399.99 | 25 | Healthy Stock |
| 3 | **Logitech MX Master 3S Mouse** | Accessories | $99.00 | 45 | High Volume Stock |
| 4 | **Apple Watch Ultra 2 (Titanium)** | Wearables | $799.00 | **4** | ⚠️ **Low Stock Alert (≤ 5)** |
| 5 | **Sony PlayStation 5 Pro Edition** | Gaming | $699.99 | **1** | 🚨 **Critical Concurrency Test (Stock = 1)** |
| 6 | **Dell UltraSharp 32" 4K Monitor** | Monitors | $849.00 | 8 | Healthy Stock |
| 7 | **Keychron Q1 Pro Mechanical Keyboard** | Accessories | $199.00 | 18 | Healthy Stock |
| 8 | **Bose SoundLink Revolve+ II** | Audio | $329.00 | **0** | ❌ **Sold Out / Out of Stock Scenario** |
| 9 | **iPad Pro 13" M4 Ultra Retina OLED** | Tablets | $1,299.00 | 15 | Healthy Stock |
| 10 | **Fujifilm X-T5 Mirrorless Camera** | Cameras | $1,699.00 | 6 | Healthy Stock |
| 11 | **ASUS ROG Swift OLED 27" 240Hz** | Monitors | $999.00 | 7 | Healthy Stock |
| 12 | **Samsung 4TB 990 PRO NVMe SSD** | Storage | $349.99 | 32 | High Volume Stock |
| 13 | **Apple AirPods Pro (2nd Gen) USB-C** | Audio | $249.00 | 40 | High Volume Stock |
| 14 | **Anker Prime 27,650mAh Power Bank** | Accessories | $179.99 | 20 | Healthy Stock |
| 15 | **Nintendo Switch OLED Model** | Gaming | $349.99 | 14 | Healthy Stock |
| 16 | **LG C3 42" 4K OLED Gaming Display** | Monitors | $896.99 | **3** | ⚠️ **Low Stock Alert (≤ 5)** |
| 17 | **DJI Mini 4 Pro Drone Fly More** | Cameras | $1,099.00 | **5** | ⚠️ **Low Stock Alert (≤ 5)** |
| 18 | **CalDigit TS4 Thunderbolt 4 Dock** | Accessories | $399.95 | 11 | Healthy Stock |
| 19 | **Shure SM7B Broadcast Microphone** | Audio | $399.00 | 9 | Healthy Stock |
| 20 | **Elgato Stream Deck MK.2** | Accessories | $149.99 | 28 | Healthy Stock |

---

## 🧪 Automated Test Suite (15/15 Passing)

```bash
npm test
```

### Test Results
```text
PASS tests/orders_concurrency.test.js
  ✓ CONCURRENCY: should handle 5 simultaneous purchase attempts on 1-stock item without overselling (5 items attempted concurrently, exactly 1 succeeds, 4 fail with 400, database stock verified strictly at 0)
  ✓ IDEMPOTENCY: should prevent duplicate order creation on network retry with identical key (verified no double deduction)
  ✓ CANCELLATION: should cancel order and restore deducted inventory back to stock
  ✓ LIFECYCLE: should advance order status through valid transitions (Pending -> Confirmed -> Shipped -> Delivered)

PASS tests/products_inventory.test.js
  ✓ should allow public access to product listings
  ✓ should prevent a customer from creating a product (403 Forbidden)
  ✓ should allow an admin to create a new product
  ✓ should allow an admin to atomically adjust product stock
  ✓ should reject decrementing stock beyond available quantity

PASS tests/auth.test.js
  ✓ should register a new customer account successfully
  ✓ should reject duplicate registration with the same email
  ✓ should login with valid credentials and return JWT token
  ✓ should reject login with incorrect password
  ✓ should access /api/auth/me when providing valid Bearer token
  ✓ should deny access to /api/auth/me without token

Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
```

---

## ⚡ 1-Click Reviewer Demo Credentials

| Role | Email | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@edvexa.com` | `AdminPassword123!` | Product CRUD, stock adjustments, order fulfillment pipeline. |
| **Customer** | `customer@edvexa.com` | `CustomerPassword123!` | Catalog browsing, cart checkout, order history, cancellation. |

---

## 📖 REST API Documentation

### Base URL: `http://localhost:5000/api`

### 1. Authentication (`/api/auth`)
- `POST /register`: Register `{ name, email, password, role }`
- `POST /login`: Sign in `{ email, password }` ➔ `{ token, user }`
- `GET /me`: Authenticated user profile (requires `Bearer <token>`)

### 2. Products (`/api/products`)
- `GET /`: Search & filter catalog (`search`, `category`, `inStock`, `sortBy`, `page`, `limit`)
- `GET /categories`: Distinct product categories
- `GET /:id`: Product details
- `POST /` *(Admin)*: Create product `{ title, description, price, stock, category, imageUrl }`
- `PUT /:id` *(Admin)*: Update product
- `DELETE /:id` *(Admin)*: Remove product

### 3. Inventory (`/api/inventory`)
- `GET /` *(Admin)*: Complete stock overview with low-stock and out-of-stock metrics
- `POST /adjust` *(Admin)*: Atomic adjustment `{ productId, operation: 'set'|'increment'|'decrement', amount }`
- `GET /low-stock` *(Admin)*: Products below threshold (stock ≤ 5)

### 4. Orders (`/api/orders`)
- `POST /`: Place order with idempotency `{ items: [{ productId, quantity }], shippingAddress, idempotencyKey }`
- `GET /my-orders`: Customer's order history
- `GET /` *(Admin)*: All orders with revenue & status metrics
- `GET /:id`: Order details
- `PATCH /:id/status` *(Admin)*: Transition lifecycle (`Pending` ➔ `Confirmed` ➔ `Shipped` ➔ `Delivered`)
- `POST /:id/cancel`: Cancel order and automatically restore product inventory

### 5. Payments (`/api/payments`)
- `POST /create-payment-intent`: Create Stripe Payment Intent `{ amount, currency: 'usd' }`

---

## 🛠️ Local Setup & Running Guide

### 1. Installation
```bash
cd Edvexa-server
npm install
```

### 2. Seed Database
```bash
npm run seed
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start Server
```bash
# Development with auto-reload:
npm run dev

# Or production start:
npm start
```
The server runs on [http://localhost:5000](http://localhost:5000) (Health check: `/health`).

---

Developed with ❤️ for **Edvexa**.
