import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateGroupsToLeagues() {
  try {
    console.log('Starting migration from groups to leagues...');

    // Check if groups table exists and has data
    const groupsExist = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'groups'
      );
    `;

    if (!groupsExist || !(groupsExist as any)[0]?.exists) {
      console.log('No groups table found, skipping migration');
      return;
    }

    // Copy groups to a temporary holding structure
    const groups = await prisma.$queryRaw<any[]>`
      SELECT * FROM groups
    `;

    const groupMemberships = await prisma.$queryRaw<any[]>`
      SELECT * FROM group_memberships
    `;

    const portfolios = await prisma.$queryRaw<any[]>`
      SELECT * FROM fantasy_portfolios WHERE "groupId" IS NOT NULL
    `;

    console.log(`Found ${groups.length} groups, ${groupMemberships.length} memberships, ${portfolios.length} portfolios`);

    // Store the data
    const migrationData = {
      groups,
      groupMemberships,
      portfolios,
      timestamp: new Date().toISOString()
    };

    // Write to a JSON file as backup
    const fs = require('fs');
    const backupPath = './migration-backup.json';
    fs.writeFileSync(backupPath, JSON.stringify(migrationData, null, 2));
    console.log(`✅ Backup saved to ${backupPath}`);

    console.log('Migration preparation complete. You can now run prisma db push.');
    console.log('After push, run restore-groups-as-leagues.ts to restore the data.');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateGroupsToLeagues();
