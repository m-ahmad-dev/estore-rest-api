import prisma from "./configs/db.js";
import env from "./configs/env.js";
import chalk from "chalk";
import { toHash } from "./utils/bcrypt.utils.js";

async function seedOwner() {
  const {
    OWNER_NAME: name,
    OWNER_EMAIL: email,
    OWNER_PASSWORD: password,
  } = env;

  // 1. Safety check
  if (!email || !password) {
    console.error(chalk.red("OWNER_EMAIL or OWNER_PASSWORD missing."));
    return;
  }

  try {
    // 2. DB check — avoid duplicates
    const existing = await prisma.admins.findFirst({
      where: { role: "owner" },
      select: { id: true },
    });

    if (existing) {
      console.log(chalk.grey.italic("Owner already exists"));
      return;
    }

    const password_hash = await toHash(password);
    await prisma.$transaction(async (tx) => {
      const superPermission = await tx.permissions.findFirst({
        where: { name: "*" },
      });

      if (!superPermission) {
        console.error(chalk.red("Permission '*' not found in database."));
      }

      // Create Admin and related permission entry
      await tx.admins.create({
        data: {
          name,
          email,
          password_hash,
          role: "owner",
          permissions: {
            create: {
              permission_id: superPermission.id,
              granted_by: null,
            },
          },
        },
      });
    });

    console.log(
      chalk.greenBright(`Owner seeded successfully → `, chalk.green(email)),
    );
  } catch (error) {
    // We access error.message for cleaner logging
    console.error(chalk.red("Seeding failed: "), error.message);
  }
}

export default seedOwner;
