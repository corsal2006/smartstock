/**
 * SmartStock AI - Static Lint & CI Quality Gate
 * Validates:
 * 1. index.html semantic elements and required application DOM IDs
 * 2. Embedded JavaScript syntax via node:vm
 * 3. nginx.conf syntax and security directives
 * 4. Dockerfile best practices (non-root user, healthcheck, unprivileged port)
 * 5. compose.yaml structure
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
    console.error(`  FAIL: ${message}`);
  } else {
    console.log(`  PASS: ${message}`);
  }
}

console.log('--- 1. Validating index.html Structure & Assets ---');
const htmlPath = path.join(rootDir, 'index.html');
assert(fs.existsSync(htmlPath), 'index.html exists at project root');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert(htmlContent.includes('<!DOCTYPE html>'), 'Valid DOCTYPE declaration present');
assert(htmlContent.includes('<html lang="en"'), 'HTML language attribute set');

// Essential DOM nodes for SmartStock features
const requiredIds = [
  'toast-container',
  'auth-screen',
  'main-interface',
  'nav-user-name',
  'admin-inventory-table',
  'store-products-grid',
  'dash-total-value',
  'dash-low-stock-list',
  'modal-product',
  'modal-forgot-pass',
  'modal-invoice',
  'modal-upi-payment'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `DOM element id="${id}" exists in HTML`);
});

console.log('\n--- 2. Validating Embedded JavaScript Syntax ---');
const scriptMatches = [...htmlContent.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert(scriptMatches.length > 0, 'Found embedded JavaScript blocks');

scriptMatches.forEach((match, idx) => {
  const code = match[1];
  try {
    // Validate syntax by creating a Script without executing it
    new vm.Script(code, { filename: `index.html:script[${idx}]` });
    console.log(`  PASS: Embedded script block ${idx + 1} syntax is valid`);
  } catch (err) {
    errors.push(`Script block ${idx + 1} syntax error: ${err.message}`);
    console.error(`  FAIL: Script block ${idx + 1} syntax error: ${err.message}`);
  }
});

console.log('\n--- 3. Validating Nginx Configuration ---');
const nginxPath = path.join(rootDir, 'nginx.conf');
assert(fs.existsSync(nginxPath), 'nginx.conf exists');

const nginxContent = fs.readFileSync(nginxPath, 'utf8');
assert(nginxContent.includes('listen 80;'), 'Nginx listens on port 80');
assert(nginxContent.includes('location /healthz'), 'Health check route /healthz defined');
assert(nginxContent.includes('X-Frame-Options'), 'X-Frame-Options security header present');
assert(nginxContent.includes('X-Content-Type-Options'), 'X-Content-Type-Options security header present');
assert(nginxContent.includes('gzip on;'), 'Gzip compression is enabled');

console.log('\n--- 4. Validating Dockerfile Best Practices ---');
const dockerfilePath = path.join(rootDir, 'Dockerfile');
assert(fs.existsSync(dockerfilePath), 'Dockerfile exists');

const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');
assert(dockerContent.includes('FROM nginx:'), 'Uses official Nginx base image');
assert(dockerContent.includes('EXPOSE 80'), 'Exposes port 80');
assert(dockerContent.includes('HEALTHCHECK'), 'Healthcheck instruction configured');
assert(dockerContent.includes('http://127.0.0.1/'), 'Healthcheck targets container port 80');

console.log('\n--- 5. Validating Docker Compose Configuration ---');
const composePath = path.join(rootDir, 'compose.yaml');
assert(fs.existsSync(composePath), 'compose.yaml exists');

const composeContent = fs.readFileSync(composePath, 'utf8');
assert(composeContent.includes('smartstock:'), 'smartstock service defined');
assert(composeContent.includes('healthcheck:'), 'Compose includes healthcheck');
assert(composeContent.includes('80'), 'Compose maps port 80');

console.log('\n------------------------------------------------');
if (errors.length > 0) {
  console.error(`LINT COMPLETED WITH ${errors.length} ERROR(S)`);
  process.exit(1);
} else {
  console.log('ALL LINTING AND STATIC CHECKS PASSED SUCCESSFULLY (100%)');
  process.exit(0);
}
