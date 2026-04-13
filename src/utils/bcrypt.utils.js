import bcrypt from "bcrypt";
import env from "../configs/env.js";

// Generates a secure hash using bcrypt.
export const toHash = async (password) => {
  const hashed = await bcrypt.hash(password, Number(env.SALT_ROUNDS));
  return hashed;
};

// Verifies a plain text string against a stored hash.
export const compareHash = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
