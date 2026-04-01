#!/usr/bin/env node

/**
 * Last.fm Stats Web - CSV Export Script (FINAL - WORKING VERSION)
 * 
 * Exported 4 CSVs:
 * 1. FATGAD - oben rechts gelber CSV-Button
 * 2. ARTISTS - Dataset > Artist Radio > Download-Button (unten rechts)
 * 3. ALBUMS - Dataset > Album Radio > Download-Button (unten rechts)
 * 4. TRACKS - Dataset > Track Radio > Download-Button (unten rechts)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LASTFM_USERNAME = process.env.LASTFM_USERNAME;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const BASE_URL = 'http://localhost:4200';
const DOWNLOAD_DIR = './exports';
const TIMEOUT = 180000; // 3 minutes - generous timeout

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
    await page.goto(`${BASE_URL}/?user=${LASTFM_USERNAME}`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT,
    });
    await page.waitForLoadState('networkidle');
    console.log('✅ App loaded\n');

    // ============================================================
    // DATEN LADEN WARTEN - ROBUST
    // ============================================================
    console.log('⏳ Waiting for data to load...');
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return text.includes('Loading finished') || 
                 text.includes('your statistics are up to date') ||
                 document.querySelectorAll('[role="table"]').length > 0;
        },
        { timeout: TIMEOUT }
      );
      console.log('✅ Data loaded\n');
    } catch (e) {
      console.warn('⚠️  Load message timeout, checking for data elements...\n');
      // Warte einfach extra Zeit
      await page.waitForTimeout(5000);
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
        await page.waitForTimeout(2000);
        console.log('✅ Dataset tab opened\n');
      } else {
        console.warn('⚠️  Dataset tab not found\n');
      }
    } catch (e) {
      console.warn(`⚠️  Could not open Dataset tab: ${e.message}\n`);
    }

    // ============================================================
    // HELPER: Download Dataset CSV
    // ============================================================
    async function downloadDatasetCSV(label, filename) {
      console.log(`📥 [${label === 'Artist' ? '2' : label === 'Album' ? '3' : '4'}/4] Downloading ${label.toUpperCase()}...`);
      try {
        // Wähle Radio-Button via Label
        const radioLabel = page.locator(`label:has-text("${label}")`);
        
        if (await radioLabel.isVisible({ timeout: 5000 })) {
          await radioLabel.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
          console.log(`   ✓ ${label} selected`);
          
          // Download-Button: Suche nach Button mit Download-Icon
          // Der Button ist unten rechts in der Tabelle
          const downloadPromise = page.waitForEvent('download');
          
          // Selector: Download-Button unten rechts (mat-icon-button mit download)
          const downloadBtn = page.locator('button[aria-label*="download"], button.mat-icon-button').last();
          
          if (await downloadBtn.isVisible({ timeout: 5000 })) {
            await downloadBtn.click();
            const download = await downloadPromise;
            await download.saveAs(path.join(DOWNLOAD_DIR, filename));
            console.log(`   ✓ ${filename} downloaded\n`);
            return true;
          } else {
            // Fallback: Versuche alle CSV Buttons außer dem ersten
            const csvButtons = await page.locator('button:has-text("CSV"), button[aria-label*="CSV"]').all();
            if (csvButtons.length > 1) {
              const downloadPromise2 = page.waitForEvent('download');
              await csvButtons[csvButtons.length - 1].click();
              const download = await downloadPromise2;
              await download.saveAs(path.join(DOWNLOAD_DIR, filename));
              console.log(`   ✓ ${filename} downloaded (via fallback)\n`);
              return true;
            }
            console.warn(`   ⚠️  Download button not visible\n`);
            return false;
          }
        } else {
          console.warn(`   ⚠️  ${label} label not found\n`);
          return false;
        }
      } catch (e) {
        console.warn(`   ⚠️  ${label} download failed: ${e.message}\n`);
        return false;
      }
    }

    // ============================================================
    // DOWNLOAD 2-4: ARTISTS, ALBUMS, TRACKS
    // ============================================================
    await downloadDatasetCSV('Artist', 'lastfmstats-artists-export.csv');
    await page.waitForTimeout(1000);

    await downloadDatasetCSV('Album', 'lastfmstats-albums-export.csv');
    await page.waitForTimeout(1000);

    await downloadDatasetCSV('Track', 'lastfmstats-tracks-export.csv');

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
