import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found in database.');
      console.log('💡 Run: npm run seed');
    } else {
      console.log(`✅ Found ${users.length} user(s) in database:\n`);
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username} (${user.role})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Active: ${user.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`   Created: ${user.createdAt.toLocaleString()}`);
        console.log('');
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUsers();

