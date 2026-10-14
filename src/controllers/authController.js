const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { BadRequestError, UnauthorizedError, ConflictError } = require("../middlewares/errorHandler");

const JWT_SECRET = process.env.JWT_SECRET || "edvexa_super_secret_jwt_key_default";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      throw new BadRequestError("Name, email, and password are required.");
    }

    if (password.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters long.");
    }

    const emailNormalized = email.trim().toLowerCase();
    const db = getDB();

    // Check existing user
    const existing = await db.collection("users").findOne({ email: emailNormalized });
    if (existing) {
      throw new ConflictError("An account with this email address already exists.");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default role is customer; allow admin only if explicitly specified
    const assignedRole = role === "admin" ? "admin" : "customer";

    const newUser = {
      name: name.trim(),
      email: emailNormalized,
      passwordHash,
      role: assignedRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);
    newUser._id = result.insertedId;

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError("Email and password are required.");
    }

    const emailNormalized = email.trim().toLowerCase();
    const db = getDB();

    const user = await db.collection("users").findOne({ email: emailNormalized });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password credentials.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password credentials.");
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/me
async function getMe(req, res, next) {
  try {
    const db = getDB();
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { passwordHash: 0 } }
    );

    if (!user) {
      throw new UnauthorizedError("User profile not found.");
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/google
// Facilitates Google Auth payload integration
async function googleAuth(req, res, next) {
  try {
    const { email, name, image, googleId } = req.body;

    if (!email) {
      throw new BadRequestError("Google profile email is missing.");
    }

    const emailNormalized = email.trim().toLowerCase();
    const db = getDB();

    let user = await db.collection("users").findOne({ email: emailNormalized });

    if (!user) {
      // Create new customer account with Google
      const newUser = {
        name: name || emailNormalized.split("@")[0],
        email: emailNormalized,
        googleId: googleId || null,
        image: image || null,
        role: "customer",
        authProvider: "google",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection("users").insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  googleAuth,
};
