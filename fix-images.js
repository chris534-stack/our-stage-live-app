/**
 * Simple script to run the image permissions fix
 */

require('dotenv').config();
const { execSync } = require('child_process');

console.log('Running image permissions fix...');

try {
    // Run the TypeScript file using ts-node
    execSync('npx ts-node src/scripts/fix-image-permissions.ts', { 
        stdio: 'inherit',
        cwd: __dirname 
    });
} catch (error) {
    console.error('Error running fix:', error);
    process.exit(1);
}
