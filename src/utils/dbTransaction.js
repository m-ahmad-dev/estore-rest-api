import prisma from "../configs/db.js";

// Prisma Interactive Transaction Wrapper

export const executeTransaction = async (callback) => {
  try {
    return await prisma.$transaction(async (client) => {
      return await callback(client); // Pass 'client' to callback because models use same connection.
    });
  } catch (error) {
    throw error;
  }
};

export default executeTransaction;
