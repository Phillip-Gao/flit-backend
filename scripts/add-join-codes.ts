import prisma from '../src/services/prisma';

const generateJoinCode = (): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

async function addJoinCodes() {
  try {
    // Find all groups without join codes
    const groupsWithoutCodes = await prisma.group.findMany({
      where: {
        joinCode: null
      }
    });
    
    console.log(`Found ${groupsWithoutCodes.length} groups without join codes`);
    
    // Update each group with a unique join code
    for (const group of groupsWithoutCodes) {
      let joinCode = generateJoinCode();
      let codeExists = await prisma.group.findUnique({ where: { joinCode } });
      
      // Ensure uniqueness
      while (codeExists) {
        joinCode = generateJoinCode();
        codeExists = await prisma.group.findUnique({ where: { joinCode } });
      }
      
      await prisma.group.update({
        where: { id: group.id },
        data: { joinCode }
      });
      
      console.log(`✅ Added join code ${joinCode} to group: ${group.name}`);
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addJoinCodes();
