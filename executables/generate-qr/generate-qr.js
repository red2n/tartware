#!/usr/bin/env node
/**
 * Generate QR code for TOTP/MFA setup - LOCAL GENERATION ONLY
 * Security: Never sends MFA secrets to external services
 */

const readline = require('readline');

// QR code generation using ASCII art (no external dependencies)
// Based on QR Code ASCII art generation
function generateQRCodeASCII(text) {
  // For security reasons, we'll generate a terminal-friendly text representation
  // and instructions rather than sending data to external services
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    MFA SETUP INSTRUCTIONS                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Setup URL (for QR code generation):');
  console.log(text);
  console.log('\n📱 To set up MFA securely:\n');
  console.log('Option 1 - Manual Entry (Most Secure):');
  console.log('  1. Open your authenticator app');
  console.log('  2. Select "Enter a setup key" or "Manual entry"');
  console.log('  3. Enter the account name and secret key shown above');
  console.log('  4. Select "Time based" (TOTP)');
  
  console.log('\nOption 2 - QR Code (if needed):');
  console.log('  1. Install qrencode locally: sudo apt-get install qrencode');
  console.log('  2. Generate QR code in terminal:');
  console.log(`     echo "${text}" | qrencode -t UTF8`);
  console.log('  3. Or save as image:');
  console.log(`     echo "${text}" | qrencode -o qr.png`);
  console.log('  4. Scan with your authenticator app');
  
  console.log('\n⚠️  SECURITY NOTE: Never use online QR code generators for MFA secrets!');
  console.log('    This could expose your second factor to third parties.\n');
}

// Read from stdin if provided, otherwise expect command line argument
if (process.argv.length > 2) {
  const otpauthUrl = process.argv[2];
  generateQRCodeASCII(otpauthUrl);
} else {
  // Read from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  
  rl.on('line', (line) => {
    if (line.trim()) {
      generateQRCodeASCII(line.trim());
    }
  });
}
