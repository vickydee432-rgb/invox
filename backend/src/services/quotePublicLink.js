const jwt = require("jsonwebtoken");

function makePublicQuoteToken({ quoteId, validUntil }) {
  const secret = process.env.PUBLIC_QUOTE_TOKEN_SECRET;
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor(new Date(validUntil).getTime() / 1000);
  const ttl = Math.max(60, exp - now); // at least 60s so token isn't instantly invalid
  return jwt.sign({ quoteId }, secret, { expiresIn: ttl });
}

function verifyPublicQuoteToken(token) {
  const secret = process.env.PUBLIC_QUOTE_TOKEN_SECRET;
  return jwt.verify(token, secret);
}

module.exports = { makePublicQuoteToken, verifyPublicQuoteToken };
