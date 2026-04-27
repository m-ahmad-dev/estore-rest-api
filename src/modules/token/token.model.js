import prisma from "../../core/configs/db.js";
import { compareHash } from "../../core/utils/bcrypt.utils.js";

// constant values
const TOKEN_EXPIRY_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TokenModel = {
  // Inserts a new refresh token.
  insert: async (userId, tokenHash, userType, db = prisma) => {
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * MS_PER_DAY);

    return await db.refresh_tokens.create({
      data: {
        token_hash: tokenHash,
        user_id: userId,
        user_type: userType,
        expires_at: expiresAt,
      },
    });
  },

  // Finds a token and checks if it is still valid.
  findByToken: async (token, db = prisma) => {
    const rows = await db.refresh_tokens.findMany({
      where: {
        expires_at: {
          gt: new Date(),
        },
      },
    });

    for (const row of rows) {
      const match = await compareHash(token, row.token_hash);
      if (match) {
        return row;
      }
    }

    return null;
  },

  // Deletes a specific token.
  deleteByToken: async function (token, db = prisma) {
    // Maintain context for transactions by passing 'db'
    const tokenRow = await this.findByToken(token, db);

    if (!tokenRow) {
      return { success: false, deletedCount: 0 };
    }

    const deleted = await db.refresh_tokens.delete({
      where: { id: tokenRow.id },
    });

    return {
      success: true,
      deletedCount: deleted ? 1 : 0,
    };
  },

  // Deletes all tokens for a specific user.
  deleteByUserId: async (userId, db = prisma) => {
    const deleted = await db.refresh_tokens.deleteMany({
      where: { user_id: userId },
    });

    return {
      success: true,
      deletedCount: deleted.count,
    };
  },

  // Clean up expired tokens from the DB
  clearExpired: async (db = prisma) => {
    return await db.refresh_tokens.deleteMany({
      where: {
        expires_at: {
          lte: new Date(),
        },
      },
    });
  },
};

export default TokenModel;
