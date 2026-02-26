import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function addLearningDollars() {
  try {
    const username = 'philgao';
    const targetTotal = 13100; // User wants 13,100 total (current 3,100 + 10,000)

    // Find the user
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

    const currentEarned = Number(user.learningDollarsEarned);
    const currentTotal = Number(user.totalLearningDollars);

    console.log(`\n👤 User: ${user.username}`);
    console.log(`💵 Current learningDollarsEarned: $${currentEarned.toFixed(2)}`);
    console.log(`💰 Current totalLearningDollars: $${currentTotal.toFixed(2)}`);
    console.log(`🎯 Target Balance: $${targetTotal.toFixed(2)}\n`);

    // Update BOTH fields to the target amount
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        learningDollarsEarned: new Prisma.Decimal(targetTotal),
        totalLearningDollars: new Prisma.Decimal(targetTotal),
      },
      select: {
        username: true,
        learningDollarsEarned: true,
        totalLearningDollars: true,
      },
    });

    console.log(`✅ Successfully updated ${updatedUser.username}'s learning dollars:`);
    console.log(`   learningDollarsEarned: $${Number(updatedUser.learningDollarsEarned).toFixed(2)}`);
    console.log(`   totalLearningDollars: $${Number(updatedUser.totalLearningDollars).toFixed(2)}\n`);
    console.log(`⚠️  Note: The frontend uses AsyncStorage for display. User may need to complete a lesson to see the updated balance.`);
  } catch (error) {
    console.error('❌ Error adding learning dollars:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addLearningDollars();
