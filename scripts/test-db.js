// Quick script to test DB connectivity and create a table using Prisma
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Attempting to connect to the database...');
    await prisma.$connect();
    console.log('Connected. Running CREATE TABLE...');
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT);');
    console.log('CREATE TABLE executed (table created or already exists).');
  } catch (err) {
    console.error('ERROR during DB operation:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
