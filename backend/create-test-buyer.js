const fetch = require('node-fetch');

async function createTestBuyer() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Buyer',
        email: 'buyer@test.com',
        password: 'buyer123',
        role: 'buyer',
        address: '123 Main Street, Pune, Maharashtra',
        latitude: 18.5204,
        longitude: 73.8567
      })
    });

    const data = await response.json();
    console.log('\n✅ BUYER LOGIN CREDENTIALS:\n');
    console.log('Email: buyer@test.com');
    console.log('Password: buyer123');
    console.log('\nToken:', data.data?.token || 'Check backend response');
    console.log('\n');
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    console.log('\nMake sure backend is running on port 5000');
  }
}

createTestBuyer();
