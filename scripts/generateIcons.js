import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source logo file
const SOURCE_LOGO = path.join(__dirname, '../public/logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public');

// Icon sizes to generate
const iconSizes = [
  // Favicons
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-96x96.png', size: 96 },
  
  // Android icons
  { name: 'android-icon-36x36.png', size: 36 },
  { name: 'android-icon-48x48.png', size: 48 },
  { name: 'android-icon-72x72.png', size: 72 },
  { name: 'android-icon-96x96.png', size: 96 },
  { name: 'android-icon-144x144.png', size: 144 },
  { name: 'android-icon-192x192.png', size: 192 },
  
  // Apple icons
  { name: 'apple-icon-57x57.png', size: 57 },
  { name: 'apple-icon-60x60.png', size: 60 },
  { name: 'apple-icon-72x72.png', size: 72 },
  { name: 'apple-icon-76x76.png', size: 76 },
  { name: 'apple-icon-114x114.png', size: 114 },
  { name: 'apple-icon-120x120.png', size: 120 },
  { name: 'apple-icon-144x144.png', size: 144 },
  { name: 'apple-icon-152x152.png', size: 152 },
  { name: 'apple-icon-180x180.png', size: 180 },
  { name: 'apple-icon-precomposed.png', size: 180 },
  { name: 'apple-icon.png', size: 180 },
  
  // Microsoft icons
  { name: 'ms-icon-70x70.png', size: 70 },
  { name: 'ms-icon-144x144.png', size: 144 },
  { name: 'ms-icon-150x150.png', size: 150 },
  { name: 'ms-icon-310x310.png', size: 310 },
];

async function generateIcons() {
  try {
    console.log('🎨 Geskap Icon Generator');
    console.log('========================\n');
    
    // Check if source logo exists
    if (!fs.existsSync(SOURCE_LOGO)) {
      console.error(`❌ Source logo not found: ${SOURCE_LOGO}`);
      process.exit(1);
    }
    
    console.log(`📂 Source: ${SOURCE_LOGO}`);
    console.log(`📁 Output: ${OUTPUT_DIR}\n`);
    
    // Read source image
    const sourceImage = sharp(SOURCE_LOGO);
    const metadata = await sourceImage.metadata();
    
    console.log(`ℹ️  Source image: ${metadata.width}x${metadata.height} ${metadata.format}\n`);
    console.log('🔄 Generating icons...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Generate each icon size
    for (const icon of iconSizes) {
      try {
        const outputPath = path.join(OUTPUT_DIR, icon.name);
        
        await sharp(SOURCE_LOGO)
          .resize(icon.size, icon.size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png()
          .toFile(outputPath);
        
        console.log(`✅ ${icon.name} (${icon.size}x${icon.size})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to generate ${icon.name}:`, error.message);
        errorCount++;
      }
    }
    
    // Generate favicon.ico (using 32x32 as base)
    try {
      const faviconPath = path.join(OUTPUT_DIR, 'favicon.ico');
      await sharp(SOURCE_LOGO)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(faviconPath.replace('.ico', '-temp.png'));
      
      // Rename to .ico (browsers will handle PNG favicons fine)
      fs.renameSync(faviconPath.replace('.ico', '-temp.png'), faviconPath);
      console.log(`✅ favicon.ico (32x32)`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to generate favicon.ico:`, error.message);
      errorCount++;
    }
    
    console.log('\n📊 Generation Summary');
    console.log('====================');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📦 Total: ${successCount + errorCount}\n`);
    
    if (errorCount === 0) {
      console.log('🎉 All icons generated successfully!');
      console.log('✨ Your Geskap PWA is now using the new branding!\n');
    } else {
      console.log('⚠️  Some icons failed to generate. Please check the errors above.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the generator
generateIcons();

