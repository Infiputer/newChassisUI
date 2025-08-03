const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testConnection() {
  console.log('🔍 Testing ChassisUI Server Connection...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');

    // Test 2: Test user login
    console.log('2. Testing authentication...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || ""
    });
    
    const { accessToken, user } = loginResponse.data;
    console.log('✅ Login successful for user:', user.name);
    console.log('✅ Access token received');
    console.log('');

    // Test 3: Test WebSocket connection (simulate)
    console.log('3. Testing WebSocket endpoint...');
    const wsTestResponse = await axios.get(`${BASE_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('✅ API authentication working');
    console.log('✅ WebSocket server should be accessible');
    console.log('');

    console.log('🎉 All tests passed! Your server is running correctly.');
    console.log('\n📝 Next steps:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Login with test@example.com / your TEST_USER_PASSWORD value');
    console.log('3. Create a new chat to test WebSocket streaming');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Tip: Run the test user creation script first:');
      console.log('   node create-test-user.js');
    }
  }
}

testConnection(); 