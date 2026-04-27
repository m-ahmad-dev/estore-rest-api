import prisma from "../../core/configs/db.js";

const OAuthModel = {
  // Check if this Google ID is already linked to any customer
  findByProviderId: async (provider, providerId, db = prisma) => {
    if (!provider || !providerId) return null;

    return await db.customer_auth_providers.findUnique({
      where: {
        provider_provider_id: {
          provider: String(provider),
          provider_id: String(providerId),
        },
      },
      select: { customer_id: true },
    });
  },

  // Link a customer to a provider
  create: async (customerId, provider, providerId, db = prisma) => {
    if (!provider || !providerId) {
      throw new Error("Missing OAuth provider or providerId.");
    }

    return await db.customer_auth_providers.create({
      data: {
        customer_id: customerId,
        provider: String(provider),
        provider_id: String(providerId),
      },
    });
  },
};

export default OAuthModel;
