import bcrypt from "bcrypt";
import env from "../configs/env.js";

// Generates a secure hash using bcrypt.
export const toHash = async (raw) => {
  const hashed = await bcrypt.hash(raw, Number(env.SALT_ROUNDS));
  return hashed;
};

// Verifies a plain text string against a stored hash.
export const compareHash = async (raw, hash) => {
  return await bcrypt.compare(raw, hash);
};
