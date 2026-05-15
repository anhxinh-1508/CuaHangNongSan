const { v2: cloudinary } = require("cloudinary");
const env = require("./env");

cloudinary.config({
  cloud_name: env.cloudName,
  api_key: env.cloudApiKey,
  api_secret: env.cloudApiSecret,
});

module.exports = cloudinary;
