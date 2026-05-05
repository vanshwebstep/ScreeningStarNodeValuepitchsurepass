const net = require("net");

/**
 * Utility function to extract the client's IP address and its type
 * @param {object} req - The Express request object
 * @returns {object} - An object containing the IP address and its type
 */
const getClientIpAddress = (req) => {
  let ipAddress =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress || req.ip;

  // If there are multiple IPs in X-Forwarded-For, take the first one
  if (ipAddress && ipAddress.includes(",")) {
    ipAddress = ipAddress.split(",")[0].trim();
  }

  // If the IP address is IPv6-mapped IPv4 (::ffff:), extract the real IPv4 address
  if (ipAddress && ipAddress.startsWith("::ffff:")) {
    ipAddress = ipAddress.slice(7); // Remove "::ffff:"
  }

  // Determine the type of the IP address
  const ipType = net.isIPv4(ipAddress)
    ? "IPv4"
    : net.isIPv6(ipAddress)
    ? "IPv6"
    : "Unknown";

  return {
    ipAddress: ipAddress ? ipAddress.trim() : "Unknown IP",
    ipType: ipType,
  };
};

module.exports = {
  getClientIpAddress,
};
