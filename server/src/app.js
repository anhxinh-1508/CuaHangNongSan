const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");
const env = require("./config/env");

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  // Basic protection against prototype pollution in request body.
  if (req.body && (Object.prototype.hasOwnProperty.call(req.body, "__proto__") || Object.prototype.hasOwnProperty.call(req.body, "constructor"))) {
    return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid payload", errors: [] });
  }
  next();
});

app.use("/api/v1", routes);
app.use(errorHandler);

module.exports = app;
