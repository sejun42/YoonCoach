import { PrismaClient } from "@prisma/client";
import { randomBytes, pbkdf2Sync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
    return `${salt}:${hash}`;
}

async function main() {
    const email = "test@example.com";
    const password = "password123";
    const hashed = hashPassword(password);

    await prisma.user.upsert({
        where: { email },
        update: { passwordHash: hashed },
        create: {
            email,
            passwordHash: hashed,
        }
    });

    console.log(`Account ready!\\nID: ${email}\\nPW: ${password}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
