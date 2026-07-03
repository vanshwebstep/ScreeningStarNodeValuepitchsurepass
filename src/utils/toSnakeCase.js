// utils/toSnakeCase.js

function snakeCase(str) {
  return String(str)
    .trim()
    .replace(/[\s\-]+/g, "_")   // spaces/hyphens -> underscore
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase -> snake_case
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "") // strip weird chars
    .replace(/_+/g, "_")        // collapse multiple underscores
    .replace(/^_|_$/g, "");     // trim leading/trailing underscore
}

function toSnakeCaseKeys(input) {
  if (Array.isArray(input)) {
    return input.map((item) => toSnakeCaseKeys(item));
  }

  if (input !== null && typeof input === "object") {
    return Object.keys(input).reduce((acc, key) => {
      const newKey = snakeCase(key);
      acc[newKey] = toSnakeCaseKeys(input[key]);
      return acc;
    }, {});
  }

  return input; // primitive values untouched
}

module.exports = { toSnakeCaseKeys, snakeCase };