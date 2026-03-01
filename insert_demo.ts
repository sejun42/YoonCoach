import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No user found in the database. Please sign up first.");
        process.exit(1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Midnight local

    console.log(`Inserting 10 days of demo data for user: ${user.email}`);

    // Base weight
    let weight = 70.0;

    for (let i = 9; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Convert to midnight UTC
        const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        // Random fluctuation
        weight = weight - 0.1 + (Math.random() * 0.4 - 0.2); // slight downward trend with noise

        await prisma.weighIn.upsert({
            where: {
                userId_date: {
                    userId: user.id,
                    date: dateUTC,
                },
            },
            update: {
                weightKg: Number(weight.toFixed(1)),
            },
            create: {
                userId: user.id,
                date: dateUTC,
                weightKg: Number(weight.toFixed(1)),
            },
        });
        console.log(`- ${dateUTC.toISOString().slice(0, 10)}: ${weight.toFixed(1)} kg`);
    }

    console.log("Demo data successfully inserted!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
