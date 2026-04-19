import prisma from "../configs/db.js";

const PasswordReset = {
  insert: async (customerId, tokenHash, expiresAt, db = prisma) => {
    return await db.passwordReset.create({
      data: {
        customer_id: customerId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
  },

  findByToken: async (tokenHash, db = prisma) => {
    return await db.passwordReset.findUnique({
      where: {
        token_hash: tokenHash,
      },
    });
  },

  setAsUsed: async (customerId, db = prisma) => {
    await db.passwordReset.update({
      where: {
        customer_id: customerId,
      },
      data: {
        used: true,
      },
    });
  },
};

export default PasswordReset;
