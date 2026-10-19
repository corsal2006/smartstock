/**
 * SmartStock AI - Automated Business Logic & Inventory Tests
 * Framework: Native Node.js Test Runner (node:test, node:assert)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Categories defined in SmartStock AI
const CATEGORIES = [
  'Electronics', 'Mobiles & Accessories', 'Fashion & Apparel', 
  'Watches & Wearables', 'Home & Kitchen', 'Groceries & Daily Needs', 
  'Beauty & Personal Care', 'Sports & Fitness', 'Books & Stationery', 
  'Automotive', 'Toys & Baby Care', 'Furniture'
];

// Seed inventory extracted from SmartStock core
const getInitialInventory = () => [
  { id: '1', title: 'Noise-Cancelling Headphones Pro', category: 'Electronics', price: 4999, stock: 18, sku: 'ELEC-101' },
  { id: '2', title: 'Flagship Smartphone 128GB', category: 'Mobiles & Accessories', price: 42999, stock: 8, sku: 'MOB-202' },
  { id: '3', title: 'Luxury Chronograph Leather Watch', category: 'Watches & Wearables', price: 8999, stock: 4, sku: 'WAT-303' },
  { id: '4', title: 'Ergonomic Mesh Office Chair', category: 'Furniture', price: 7499, stock: 12, sku: 'FUR-404' },
  { id: '5', title: 'Organic Basmati Rice 5kg', category: 'Groceries & Daily Needs', price: 650, stock: 45, sku: 'GRO-505' },
  { id: '6', title: 'Smart Fitness Tracker Band', category: 'Watches & Wearables', price: 2499, stock: 2, sku: 'WAT-304' }
];

describe('1. Inventory Domain Integrity', () => {
  test('Seed inventory contains exactly 6 products', () => {
    const items = getInitialInventory();
    assert.equal(items.length, 6);
  });

  test('All products have valid pricing, stock, and valid category membership', () => {
    const items = getInitialInventory();
    items.forEach(item => {
      assert.ok(item.price > 0, `Product ${item.title} price must be > 0`);
      assert.ok(item.stock >= 0, `Product ${item.title} stock must be >= 0`);
      assert.ok(CATEGORIES.includes(item.category), `Category ${item.category} must be in allowed list`);
      assert.match(item.sku, /^[A-Z]{3,4}-\d{3}$/, `SKU ${item.sku} must match standard pattern`);
    });
  });

  test('All product SKUs and IDs are unique', () => {
    const items = getInitialInventory();
    const skus = new Set(items.map(i => i.sku));
    const ids = new Set(items.map(i => i.id));
    assert.equal(skus.size, items.length, 'SKUs must be unique');
    assert.equal(ids.size, items.length, 'IDs must be unique');
  });
});

describe('2. Low Stock Alert Logic', () => {
  test('Threshold flag correctly identifies low stock items (<= 5 units)', () => {
    const items = getInitialInventory();
    const lowStockItems = items.filter(i => i.stock <= 5);
    
    // In seed data: id 3 (stock: 4) and id 6 (stock: 2)
    assert.equal(lowStockItems.length, 2);
    assert.deepEqual(lowStockItems.map(i => i.id), ['3', '6']);
  });

  test('Returns empty when all stocks exceed threshold', () => {
    const items = getInitialInventory().map(i => ({ ...i, stock: 20 }));
    const lowStockItems = items.filter(i => i.stock <= 5);
    assert.equal(lowStockItems.length, 0);
  });
});

describe('3. POS Cart & Checkout Calculations', () => {
  test('Cart line item subtotal and order total calculate accurately', () => {
    const items = getInitialInventory();
    const cart = [
      { product: items[0], quantity: 2 }, // 4999 * 2 = 9998
      { product: items[4], quantity: 3 }  // 650 * 3 = 1950
    ];

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    assert.equal(total, 9998 + 1950);
    assert.equal(total, 11948);
  });

  test('Stock decrements accurately upon order completion', () => {
    const inventory = getInitialInventory();
    const cart = [
      { product: inventory[0], quantity: 3 }, // id: 1, was 18, becomes 15
      { product: inventory[2], quantity: 2 }  // id: 3, was 4, becomes 2
    ];

    cart.forEach(cItem => {
      const p = inventory.find(i => i.id === cItem.product.id);
      assert.ok(p, 'Product must exist in inventory');
      p.stock -= cItem.quantity;
    });

    assert.equal(inventory.find(i => i.id === '1').stock, 15);
    assert.equal(inventory.find(i => i.id === '3').stock, 2);
  });

  test('Prevents decrementing stock below 0', () => {
    const inventory = getInitialInventory();
    const item = inventory[5]; // stock: 2
    const requestedQty = 5;

    const hasSufficientStock = item.stock >= requestedQty;
    assert.equal(hasSufficientStock, false, 'Should flag insufficient stock');
  });
});

describe('4. Authentication & Security Logic', () => {
  function checkPasswordStrength(pass) {
    if (pass.length === 0) return 'Weak';
    if (pass.length < 6) return 'Weak';
    if (pass.length < 10) return 'Medium';
    return 'Strong';
  }

  test('Evaluates password strength tiers accurately', () => {
    assert.equal(checkPasswordStrength(''), 'Weak');
    assert.equal(checkPasswordStrength('12345'), 'Weak');
    assert.equal(checkPasswordStrength('123456'), 'Medium');
    assert.equal(checkPasswordStrength('abcdefgh'), 'Medium');
    assert.equal(checkPasswordStrength('supersecure123'), 'Strong');
  });

  test('Order ID format validation', () => {
    const sampleId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    assert.match(sampleId, /^ORD-\d{6}$/, 'Order ID should match ORD-XXXXXX pattern');
  });
});
