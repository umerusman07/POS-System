import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Not configured'}`);
    
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database query test passed!');
    
    await prisma.$disconnect();
    console.log('✅ Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();

