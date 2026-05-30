import prisma from "../configs/db.js";

// Prisma Interactive Transaction Wrapper

export const executeTransaction = async (callback) => {
    return await prisma.$transaction(async (client) => {
      return await callback(client); // Pass 'client' to callback because models use same connection.
    });
};

export default executeTransaction;
