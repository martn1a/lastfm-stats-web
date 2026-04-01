#!/usr/bin/env node

/**
 * Last.fm Stats Web - CSV Export Script (FINAL)
 * 
 * Exported 4 CSVs based on actual screenshots:
 * 1. FATGAD - oben rechts gelber CSV-Button
 * 2. ARTISTS - Dataset > Artist Radio > Download-Button
 * 3. ALBUMS - Dataset > Album Radio > Download-Button
 * 4. TRACKS - Dataset > Track Radio > Download-Button
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LASTFM_USERNAME = process.env.LASTFM_USERNAME;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const BASE_URL = 'http://localhost:4200';
const DOWNLOAD_DIR = './exports';
const TIMEOUT = 120000;

if (!LASTFM_USERNAME || !LASTFM_API_KEY) {
  console.error('❌ Error: LASTFM_USERNAME and LASTFM_API_KEY env vars required');
  process.exit(1);
}

async function exportCSVs() {
  console.log('\n' + '='.repeat(70));
  console.log('🎵 Last.fm Stats CSV Export (4 Downloads)');
  console.log('='.repeat(70) + '\n');

  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    console.log(`📁 Created directory: ${DOWNLOAD_DIR}\n`);
  }

  let browser;
  try {
    console.log(`👤 Username: ${LASTFM_USERNAME}`);
    console.log(`🌐 Base URL: ${BASE_URL}\n`);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // ============================================================
    // APP LADEN
    // ============================================================
    console.log('🚀 Loading Last.fm Stats Web...');
    await page.goto(`${BASE_URL}/user/${LASTFM_USERNAME}/general`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT,
    });
    await page.waitForLoadState('networkidle');
    console.log('✅ App loaded\n');

    // ============================================================
    // DATEN LADEN WARTEN
    // ============================================================
    console.log('⏳ Waiting for data to load...');
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return text.includes('Loading finished') || 
                 text.includes('your statistics are up to date');
        },
        { timeout: TIMEOUT }
      );
      console.log('✅ Data loaded\n');
    } catch (e) {
      console.warn('⚠️  No load message found, continuing...\n');
    }

    await page.waitForTimeout(2000);

    // ============================================================
    // DOWNLOAD 1: FATGAD (oben rechts gelber CSV-Button)
    // ============================================================
    console.log('📥 [1/4] Downloading FATGAD (top right yellow button)...');
    try {
      const downloadPromise = page.waitForEvent('download');
      
      // Finde den gelben CSV-Button oben (rechts)
      // Screenshot zeigt: "Save your data..." > CSV Button (gelb)
      const csvButton = page.locator('button:has-text("CSV")').first();
      
      if (await csvButton.isVisible({ timeout: 5000 })) {
        await csvButton.click();
        const download = await downloadPromise;
        await download.saveAs(path.join(DOWNLOAD_DIR, 'lastfmstats-fadgad.csv'));
        console.log('   ✓ lastfmstats-fadgad.csv downloaded\n');
      } else {
        console.warn('   ⚠️  FATGAD CSV button not visible\n');
      }
    } catch (e) {
      console.warn(`   ⚠️  FATGAD download failed: ${e.message}\n`);
    }

    await page.waitForTimeout(1000);

    // ============================================================
    // DATASET TAB ÖFFNEN
    // ============================================================
    console.log('📊 Opening Dataset tab...');
    try {
      const datasetTab = page.locator('text=Dataset').last();
      
      if (await datasetTab.isVisible({ timeout: 5000 })) {
        await datasetTab.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
        console.log('✅ Dataset tab opened\n');
      } else {
        console.warn('⚠️  Dataset tab not found\n');
      }
    } catch (e) {
      console.warn(`⚠️  Could not open Dataset tab: ${e.message}\n`);
    }

    // ============================================================
    // DOWNLOAD 2: ARTISTS
    // ============================================================
    console.log('📥 [2/4] Downloading ARTISTS...');
    try {
      // Wähle "Artist" Radio-Button
      // Screenshot zeigt: Radio mit Label "Artist"
      const artistLabel = page.locator('label:has-text("Artist")').first();
      
      if (await artistLabel.isVisible({ timeout: 5000 })) {
        await artistLabel.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);
        console.log('   ✓ Artist selected');
        
        // Klick Download-Button (gelb, unten rechts)
        const downloadPromise = page.waitForEvent('download');
        const downloadBtn = page.locator('button:has-text("CSV")').last();
        
        if (await downloadBtn.isVisible({ timeout: 5000 })) {
          await downloadBtn.click();
          const download = await downloadPromise;
          await download.saveAs(path.join(DOWNLOAD_DIR, 'lastfmstats-artists-export.csv'));
          console.log('   ✓ lastfmstats-artists-export.csv downloaded\n');
        } else {
          console.warn('   ⚠️  Download button not visible\n');
        }
      } else {
        console.warn('   ⚠️  Artist label not found\n');
      }
    } catch (e) {
      console.warn(`   ⚠️  Artists download failed: ${e.message}\n`);
    }

    await page.waitForTimeout(1000);

    // ============================================================
    // DOWNLOAD 3: ALBUMS
    // ============================================================
    console.log('📥 [3/4] Downloading ALBUMS...');
    try {
      // Wähle "Album" Radio-Button
      // Screenshot zeigt: Radio mit Label "Album"
      const albumLabel = page.locator('label:has-text("Album")').first();
      
      if (await albumLabel.isVisible({ timeout: 5000 })) {
        await albumLabel.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);
        console.log('   ✓ Album selected');
        
        // Klick Download-Button (gelb, unten rechts)
        const downloadPromise = page.waitForEvent('download');
        const downloadBtn = page.locator('button:has-text("CSV")').last();
        
        if (await downloadBtn.isVisible({ timeout: 5000 })) {
          await downloadBtn.click();
          const download = await downloadPromise;
          await download.saveAs(path.join(DOWNLOAD_DIR, 'lastfmstats-albums-export.csv'));
          console.log('   ✓ lastfmstats-albums-export.csv downloaded\n');
        } else {
          console.warn('   ⚠️  Download button not visible\n');
        }
      } else {
        console.warn('   ⚠️  Album label not found\n');
      }
    } catch (e) {
      console.warn(`   ⚠️  Albums download failed: ${e.message}\n`);
    }

    await page.waitForTimeout(1000);

    // ============================================================
    // DOWNLOAD 4: TRACKS
    // ============================================================
    console.log('📥 [4/4] Downloading TRACKS...');
    try {
      // Wähle "Track" Radio-Button
      // Screenshot zeigt: Radio mit Label "Track"
      const trackLabel = page.locator('label:has-text("Track")').first();
      
      if (await trackLabel.isVisible({ timeout: 5000 })) {
        await trackLabel.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);
        console.log('   ✓ Track selected');
        
        // Klick Download-Button (gelb, unten rechts)
        const downloadPromise = page.waitForEvent('download');
        const downloadBtn = page.locator('button:has-text("CSV")').last();
        
        if (await downloadBtn.isVisible({ timeout: 5000 })) {
          await downloadBtn.click();
          const download = await downloadPromise;
          await download.saveAs(path.join(DOWNLOAD_DIR, 'lastfmstats-tracks-export.csv'));
          console.log('   ✓ lastfmstats-tracks-export.csv downloaded\n');
        } else {
          console.warn('   ⚠️  Download button not visible\n');
        }
      } else {
        console.warn('   ⚠️  Track label not found\n');
      }
    } catch (e) {
      console.warn(`   ⚠️  Tracks download failed: ${e.message}\n`);
    }

    // ============================================================
    // FERTIG
    // ============================================================
    console.log('='.repeat(70));
    console.log('✅ CSV Export abgeschlossen!');
    console.log('='.repeat(70) + '\n');

    const files = fs.readdirSync(DOWNLOAD_DIR);
    console.log('📋 Exported files:');
    files.forEach(f => {
      const filepath = path.join(DOWNLOAD_DIR, f);
      const size = fs.statSync(filepath).size;
      console.log(`   ✓ ${f} (${formatBytes(size)})`);
    });
    console.log('');

    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error(error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

/**
 * Helper: Formatiere Bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Starte Export
exportCSVs();
