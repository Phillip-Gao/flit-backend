import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserBalance() {
  try {
    const username = 'philgao';

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        learningDollarsEarned: true,
        totalLearningDollars: true,
      },
    });

    if (!user) {
      console.error(`❌ User with username "${username}" not found`);
      process.exit(1);
    }

    console.log(`\n👤 User: ${user.username}`);
    console.log(`💰 learningDollarsEarned: $${Number(user.learningDollarsEarned).toFixed(2)}`);
    console.log(`💵 totalLearningDollars: $${Number(user.totalLearningDollars).toFixed(2)}\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserBalance();
