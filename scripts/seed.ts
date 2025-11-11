import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create sample users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'john.doe@example.com',
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-05-15'),
        financialIQScore: 750,
        learningStreak: 15,
        totalLearningDollars: 125.50,
        emailVerified: true,
        phoneVerified: false,
        onboardingComplete: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'jane.smith@example.com',
        username: 'janesmith',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: new Date('1988-08-22'),
        financialIQScore: 820,
        learningStreak: 23,
        totalLearningDollars: 289.75,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'mike.wilson@example.com',
        username: 'mikewilson',
        firstName: 'Mike',
        lastName: 'Wilson',
        dateOfBirth: new Date('1992-12-10'),
        financialIQScore: 680,
        learningStreak: 7,
        totalLearningDollars: 45.25,
        emailVerified: false,
        phoneVerified: false,
        onboardingComplete: false,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sarah.johnson@example.com',
        username: 'sarahjohnson',
        firstName: 'Sarah',
        lastName: 'Johnson',
        dateOfBirth: new Date('1995-03-18'),
        financialIQScore: 920,
        learningStreak: 45,
        totalLearningDollars: 567.80,
        emailVerified: true,
        phoneVerified: true,
        onboardingComplete: true,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users:`);
  users.forEach((user) => {
    console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
  });

  console.log('🎉 Seeding completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });