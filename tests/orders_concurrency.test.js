const request = require("supertest");
const app = require("../src/app");
const { connectDB, closeDB, getDB } = require("../src/config/db");
const { ObjectId } = require("mongodb");

describe("Order Engine, Concurrency & Idempotency Suite", () => {
  let adminToken = null;
  let customerToken = null;
  let singleStockProductId = null;
  let multiStockProductId = null;
  let testOrderId = null;

  beforeAll(async () => {
    await connectDB();
    const db = getDB();

    // Authenticate Admin
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@edvexa.com", password: "AdminPassword123!" });
    adminToken = adminRes.body.token;

    // Authenticate Customer
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@edvexa.com", password: "CustomerPassword123!" });
    customerToken = custRes.body.token;

    // Create a product with ONLY 1 in stock for concurrency testing
    const singleProd = await db.collection("products").insertOne({
      title: "Ultra Limited Edition Tech Item",
      price: 500,
      stock: 1, // EXACTLY 1 in stock
      category: "Special",
      createdAt: new Date(),
    });
    singleStockProductId = singleProd.insertedId.toString();

    // Create a product with 10 in stock for normal order & idempotency testing
    const multiProd = await db.collection("products").insertOne({
      title: "Standard Test Gizmo",
      price: 100,
      stock: 10,
      category: "Special",
      createdAt: new Date(),
    });
    multiStockProductId = multiProd.insertedId.toString();
  });

  afterAll(async () => {
    const db = getDB();
    if (singleStockProductId) {
      await db.collection("products").deleteOne({ _id: new ObjectId(singleStockProductId) });
    }
    if (multiStockProductId) {
      await db.collection("products").deleteOne({ _id: new ObjectId(multiStockProductId) });
    }
    await closeDB();
  });

  // TEST 1: CONCURRENT PURCHASE RACE CONDITION TEST
  it("CONCURRENCY: should handle 5 simultaneous purchase attempts on 1-stock item without overselling", async () => {
    const db = getDB();

    // Launch 5 parallel checkout requests simultaneously
    const orderPromises = Array.from({ length: 5 }).map((_, index) =>
      request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .set("Idempotency-Key", `concurrent-test-key-${index}-${Date.now()}`)
        .send({
          items: [{ productId: singleStockProductId, quantity: 1 }],
          shippingAddress: {
            street: "123 Tech Park Ave",
            city: "San Francisco",
            country: "USA",
          },
        })
    );

    const results = await Promise.all(orderPromises);

    const successfulOrders = results.filter((r) => r.statusCode === 201);
    const failedOrders = results.filter((r) => r.statusCode === 400);

    // Exactly 1 order must succeed, 4 must fail due to stock depletion
    expect(successfulOrders.length).toBe(1);
    expect(failedOrders.length).toBe(4);

    // Verify stock in MongoDB is strictly 0 and NOT negative
    const finalProduct = await db
      .collection("products")
      .findOne({ _id: new ObjectId(singleStockProductId) });

    expect(finalProduct.stock).toBe(0);
  });

  // TEST 2: IDEMPOTENCY KEY REPLAY TEST
  it("IDEMPOTENCY: should prevent duplicate order creation on network retry with identical key", async () => {
    const db = getDB();
    const idempotencyKey = `idempotency-test-uuid-${Date.now()}`;

    const orderPayload = {
      items: [{ productId: multiStockProductId, quantity: 2 }],
      shippingAddress: {
        street: "456 Innovation Blvd",
        city: "Austin",
        country: "USA",
      },
    };

    // First request
    const firstRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(orderPayload);

    expect(firstRes.statusCode).toBe(201);
    expect(firstRes.body.success).toBe(true);
    testOrderId = firstRes.body.data.id;

    // Immediate duplicate retry with the exact same Idempotency-Key
    const secondRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(orderPayload);

    // Must return successful replay with indicator
    expect([200, 201]).toContain(secondRes.statusCode);
    expect(secondRes.headers["x-idempotent-replay"]).toBe("true");
    expect(secondRes.body.data.id).toBe(testOrderId);

    // Stock should have deducted ONLY 2 (10 - 2 = 8), NOT 4!
    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(multiStockProductId) });
    expect(product.stock).toBe(8);
  });

  // TEST 3: ORDER CANCELLATION & INVENTORY RESTORATION
  it("CANCELLATION: should cancel order and restore deducted inventory back to stock", async () => {
    const db = getDB();

    const cancelRes = await request(app)
      .post(`/api/orders/${testOrderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Customer changed mind before shipment" });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.data.status).toBe("Cancelled");

    // Stock was 8, after restoring 2 items it should be back to 10
    const restoredProduct = await db
      .collection("products")
      .findOne({ _id: new ObjectId(multiStockProductId) });
    expect(restoredProduct.stock).toBe(10);
  });

  // TEST 4: ORDER LIFECYCLE PROGRESSION (ADMIN)
  it("LIFECYCLE: should advance order status through valid transitions", async () => {
    // Create fresh order to advance
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", `lifecycle-key-${Date.now()}`)
      .send({
        items: [{ productId: multiStockProductId, quantity: 1 }],
        shippingAddress: {
          street: "789 Enterprise Way",
          city: "Seattle",
          country: "USA",
        },
      });

    const orderId = orderRes.body.data.id;

    // 1. Pending -> Confirmed
    const confirmRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Confirmed", note: "Payment verified" });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.body.data.status).toBe("Confirmed");

    // 2. Confirmed -> Shipped
    const shipRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Shipped", note: "Handed over to FedEx" });
    expect(shipRes.statusCode).toBe(200);
    expect(shipRes.body.data.status).toBe("Shipped");

    // 3. Shipped -> Delivered
    const deliverRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Delivered", note: "Package signed and received" });
    expect(deliverRes.statusCode).toBe(200);
    expect(deliverRes.body.data.status).toBe("Delivered");

    // 4. Invalid transition test: Delivered cannot be moved back to Pending
    const invalidRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Pending" });
    expect(invalidRes.statusCode).toBe(400);
  });
});
