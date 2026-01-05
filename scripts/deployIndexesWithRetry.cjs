const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Firestore indexes deployment with retry mechanism...\n');

const maxRetries = 3;
const retryDelay = 30000; // 30 seconds

function deployIndexes(attempt = 1) {
  return new Promise((resolve) => {
    try {
      console.log(`📦 Attempt ${attempt} of ${maxRetries}...\n`);
      
      const result = execSync('firebase deploy --only firestore:indexes', {
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });
      
      console.log(result);
      console.log('\n✅ Indexes deployed successfully!');
      resolve(true);
      
    } catch (error) {
      const errorOutput = error.stdout || error.stderr || error.message;
      console.log(errorOutput);
      
      // Check if it's a 409 error (index already exists or building)
      if (errorOutput.includes('409') || errorOutput.includes('index already exists')) {
        if (attempt < maxRetries) {
          console.log(`\n⏳ Index conflict detected. Waiting ${retryDelay / 1000} seconds before retry...`);
          console.log('   (This usually means indexes are still building)\n');
          
          setTimeout(() => {
            deployIndexes(attempt + 1).then(resolve);
          }, retryDelay);
        } else {
          console.log('\n⚠️  Max retries reached. Some indexes may already exist or are still building.');
          console.log('   Check Firebase Console to see which indexes were created.\n');
          resolve(false);
        }
      } else {
        // Different error - don't retry
        console.log('\n❌ Deployment failed with non-retryable error.');
        resolve(false);
      }
    }
  });
}

// Run deployment
deployIndexes().then(success => {
  if (success) {
    console.log('\n✨ All done!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Deployment completed with warnings. Check Firebase Console for details.');
    process.exit(1);
  }
});

