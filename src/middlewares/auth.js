const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { UnauthorizedError, ForbiddenError } = require("./errorHandler");

const JWT_SECRET = process.env.JWT_SECRET || "edvexa_super_secret_jwt_key_default";

/**
 * Verify JWT Bearer token and attach user to request object
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("No authentication token provided. Please log in.");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const db = getDB();
    const user = await db.collection("users").findOne({ _id: new ObjectId(decoded.id) });

    if (!user) {
      throw new UnauthorizedError("User session is invalid or user no longer exists.");
    }

    // Attach user to req object
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "customer",
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorize specified roles (e.g. authorize('admin'))
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required before authorization check."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Requires one of the following roles: [${allowedRoles.join(", ")}]. Current role: '${req.user.role}'`
        )
      );
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};
