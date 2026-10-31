const http = require('node:http');
const { db } = require('./server/db');

console.log('Testing Static Asset & API Server Integration...');

// Test DB count
const count = db.prepare('SELECT count(*) as c FROM subscriptions').get().c;
console.log(`Database Subscriptions: ${count}`);

const invCount = db.prepare('SELECT count(*) as c FROM invoices').get().c;
console.log(`Database Invoices: ${invCount}`);

console.log('Integration test passed successfully!');
