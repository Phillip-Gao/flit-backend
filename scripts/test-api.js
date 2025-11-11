// Test script to validate the Flit User API endpoints
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('🚀 Testing Flit User API endpoints...\n');

  // Test data
  const testUser = {
    email: 'test@flit.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    dateOfBirth: '1995-01-01'
  };

  try {
    // Test 1: Create a new user
    console.log('1️⃣  Testing user creation...');
    const createResponse = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (!createResponse.ok) {
      console.error('❌ User creation failed:', await createResponse.text());
      return;
    }

    const createdUser = await createResponse.json();
    console.log('✅ User created successfully:', createdUser.user.username);
    const userId = createdUser.user.id;

    // Test 2: Get user by ID
    console.log('\n2️⃣  Testing get user by ID...');
    const getUserResponse = await fetch(`${API_BASE_URL}/users/${userId}`);
    
    if (!getUserResponse.ok) {
      console.error('❌ Get user failed:', await getUserResponse.text());
      return;
    }

    const getUserData = await getUserResponse.json();
    console.log('✅ User retrieved successfully:', getUserData.user.username);

    // Test 3: Update user
    console.log('\n3️⃣  Testing user update...');
    const updateData = {
      firstName: 'UpdatedTest',
      financialIQScore: 100,
      learningStreak: 5
    };

    const updateResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      console.error('❌ User update failed:', await updateResponse.text());
      return;
    }

    const updatedUser = await updateResponse.json();
    console.log('✅ User updated successfully:', updatedUser.user.firstName, 'Score:', updatedUser.user.financialIQScore);

    // Test 4: Get all users
    console.log('\n4️⃣  Testing get all users...');
    const getAllResponse = await fetch(`${API_BASE_URL}/users?limit=5`);
    
    if (!getAllResponse.ok) {
      console.error('❌ Get all users failed:', await getAllResponse.text());
      return;
    }

    const getAllData = await getAllResponse.json();
    console.log('✅ Retrieved users:', getAllData.users.length, 'Total:', getAllData.pagination.total);

    // Test 5: Delete user
    console.log('\n5️⃣  Testing user deletion...');
    const deleteResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE'
    });

    if (!deleteResponse.ok) {
      console.error('❌ User deletion failed:', await deleteResponse.text());
      return;
    }

    const deleteData = await deleteResponse.json();
    console.log('✅ User deleted successfully:', deleteData.message);

    console.log('\n🎉 All API tests passed! The Flit backend is ready.');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Make sure the server is running with: npm run dev');
  }
}

// Helper function for fetch (Node.js compatibility)
if (typeof fetch === 'undefined') {
  // For older Node.js versions, you might need to install node-fetch
  console.log('⚠️  This test script requires Node.js 18+ or install node-fetch');
  console.log('   Run: npm install node-fetch@2');
}

if (require.main === module) {
  testAPI();
}

module.exports = testAPI;