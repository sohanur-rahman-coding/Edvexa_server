const request = require("supertest");
const app = require("../src/app");
const { connectDB, closeDB, getDB } = require("../src/config/db");

describe("Product & Inventory Management Suite", () => {
  let adminToken = null;
  let customerToken = null;
  let createdProductId = null;

  beforeAll(async () => {
    await connectDB();

    // Log in Admin
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@edvexa.com", password: "AdminPassword123!" });
    adminToken = adminRes.body.token;

    // Log in Customer
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@edvexa.com", password: "CustomerPassword123!" });
    customerToken = custRes.body.token;
  });

  afterAll(async () => {
    // Cleanup created test product if any
    if (createdProductId) {
      const db = getDB();
      const { ObjectId } = require("mongodb");
      await db.collection("products").deleteOne({ _id: new ObjectId(createdProductId) });
    }
    await closeDB();
  });

  it("should allow public access to product listings", async () => {
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should prevent a customer from creating a product (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        title: "Unauthorized Customer Laptop",
        price: 999,
        stock: 5,
        category: "Laptops",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("should allow an admin to create a new product", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Edvexa Quantum Wireless Mouse",
        description: "High-precision gaming and productivity mouse",
        price: 79.99,
        stock: 15,
        category: "Accessories",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdProductId = res.body.data.id;
  });

  it("should allow an admin to atomically adjust product stock", async () => {
    const res = await request(app)
      .post("/api/inventory/adjust")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productId: createdProductId,
        operation: "set",
        amount: 25,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.stock).toBe(25);
  });

  it("should reject decrementing stock beyond available quantity", async () => {
    const res = await request(app)
      .post("/api/inventory/adjust")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        productId: createdProductId,
        operation: "decrement",
        amount: 100, // Available is only 25
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
