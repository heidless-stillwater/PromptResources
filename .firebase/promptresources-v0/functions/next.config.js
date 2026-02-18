"use strict";

// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com"
      },
      {
        protocol: "https",
        hostname: "img.youtube.com"
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com"
      }
    ]
  }
};
