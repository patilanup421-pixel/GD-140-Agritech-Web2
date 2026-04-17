async function createTestAccounts() {
  const baseUrl = 'http://localhost:5000/api';

  try {
    // Create Buyer
    console.log('\n📝 Creating BUYER account...');
    const buyerRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'buyer@test.com',
        password: 'buyer123',
        name: 'Test Buyer',
        role: 'buyer',
        address: '123 Main Street, Pune, Maharashtra',
        latitude: 18.5204,
        longitude: 73.8567
      })
    });
    const buyerData = await buyerRes.json();
    console.log('✅ Buyer created!\n');

    // Create Farmer
    console.log('📝 Creating FARMER account...');
    const farmerRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'farmer@test.com',
        password: 'farmer123',
        name: 'Test Farmer',
        role: 'farmer'
      })
    });
    const farmerData = await farmerRes.json();
    console.log('✅ Farmer created!\n');

    console.log('═══════════════════════════════════════');
    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════\n');
    console.log('👤 BUYER:');
    console.log('   Email: buyer@test.com');
    console.log('   Password: buyer123\n');
    console.log('🌾 FARMER:');
    console.log('   Email: farmer@test.com');
    console.log('   Password: farmer123\n');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

createTestAccounts();
