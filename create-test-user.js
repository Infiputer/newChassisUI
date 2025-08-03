const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createTestUser = async () => {
  try {
    console.log('Creating test user...');
    
    const email = 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || "";
    const name = 'Test User';
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Test user already exists!');
      console.log('Email:', email);
      console.log('Password:', password);
      return;
    }
    
    // Create the user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, is_verified) VALUES ($1, $2, $3, $4) RETURNING user_id',
      [email, passwordHash, name, true]
    );
    
    console.log('Test user created successfully!');
    console.log('User ID:', result.rows[0].user_id);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nYou can now log in at: http://192.168.0.183:3000/login');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await pool.end();
  }
};

createTestUser(); 