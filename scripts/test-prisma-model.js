// Test script to verify Prisma model works with the database
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Testing Prisma model operations...');
    
    // Create a test record
    const newRecord = await prisma.testTable.create({
      data: {
        name: 'Hello from Prisma!'
      }
    });
    console.log('✅ Created record:', newRecord);
    
    // Read all records
    const allRecords = await prisma.testTable.findMany();
    console.log('✅ All records:', allRecords);
    
    // Clean up - delete the test record
    await prisma.testTable.delete({
      where: { id: newRecord.id }
    });
    console.log('✅ Cleaned up test record');
    
    console.log('🎉 All Prisma operations successful!');
  } catch (err) {
    console.error('❌ ERROR during Prisma operations:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();