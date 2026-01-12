import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const seedUsers = async () => {
  try {
    console.log('🌱 Starting user seed...\n');

    // Hash passwords
    const hashPassword = async (password) => {
      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(password, salt);
    };

    // Sample users data
    const users = [
      {
        username: 'Addiction Pizza Kitchen',
        email: 'admin@addiction.com',
        password: await hashPassword('addiction123'),
        role: 'Manager',
        firstName: 'Addiction',
        lastName: 'Pizza Kitchen',
        isActive: true
      },
      {
        username: 'user1',
        email: 'user@restaurant.com',
        password: await hashPassword('user123'),
        role: 'User',
        firstName: 'Jane',
        lastName: 'User',
        isActive: true
      },
    ];

    // Create users
    for (const userData of users) {
      try {
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: userData.username },
              { email: userData.email }
            ]
          }
        });

        if (existingUser) {
          console.log(`⊘ User already exists: ${userData.username} (${userData.role})`);
        } else {
          const user = await prisma.user.create({
            data: userData
          });
          console.log(`✓ Created user: ${user.username} (${user.role})`);
        }
      } catch (error) {
        console.error(`✗ Error creating user ${userData.username}:`, error.message);
      }
    }

    console.log('\n✅ Seed completed!');
    console.log('\n📝 Test credentials:');
    console.log('   Manager - Email: admin@addiction.com, Password: addiction123');
    console.log('   Regular User - Email: user@restaurant.com, Password: user123');
    console.log('\n');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedUsers();
