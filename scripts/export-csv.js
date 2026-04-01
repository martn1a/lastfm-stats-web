#!/usr/bin/env node

/**
 * Last.fm Stats Web - CSV Export Script
 * 
 * Nutzt Playwright um die Angular App zu öffnen,
 * Last.fm Daten zu laden und CSVs automatisch zu exportieren
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LASTFM_USERNAME = process.env.LASTFM_USERNAME;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const BASE_URL = 'http://localhost:4200';
const DOWNLOAD_DIR = './exports';
const TIMEOUT = 60000; // 60 Sekunden max wait

if (!LASTFM_USERNAME || !LASTFM_API_KEY) {
  console.error('❌ Error: LASTFM_USERNAME and LASTFM_API_KEY env vars required');
  process.exit(1);
}

async function exportCSVs() {
  console.log('\n' + '='.repeat(70));
  console.log('🎵 Last.fm Stats CSV Export');
  console.log('='.repeat(70) + '\n');

  // Erstelle Download-Verzeichnis
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    console.log(`📁 Created download directory: ${DOWNLOAD_DIR}`);
  }

  let browser;
  try {
    console.log(`👤 Username: ${LASTFM_USERNAME}`);
    console.log(`🌐 Base URL: ${BASE_URL}\n`);

    // Starte Browser
    console.log('🚀 Starting browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // ============================================================
    // 1. APP LADEN
    // ============================================================
    console.log('📖 Loading Last.fm Stats Web...');
    await page.goto(`${BASE_URL}/?user=${LASTFM_USERNAME}`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT,
    });

    // Kurz warten, bis Angular initialisiert ist
    await page.waitForLoadState('networkidle');
    console.log('✅ App loaded\n');

    // ============================================================
    // 2. DATEN LADEN WARTEN
    // ============================================================
    console.log('⏳ Waiting for Last.fm data to load...');
    
    // Warte auf den "Loading finished" Text (ca 5-30 Sekunden je nach Datenmenge)
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
      console.warn('⚠️  Timeout waiting for load, continuing anyway...\n');
    }

    // Kurz warten, damit alle Daten verarbeitet sind
    await page.waitForTimeout(2000);

    // ============================================================
    // 3. DATASET TAB ÖFFNEN
    // ============================================================
    console.log('📊 Clicking Dataset tab...');
    
    // Warte auf den "Dataset" Button und klick ihn
    const datasetTab = page.locator('text=Dataset');
    if (await datasetTab.isVisible()) {
      await datasetTab.click();
      console.log('✅ Dataset tab opened\n');
    } else {
      console.warn('⚠️  Dataset tab not found, trying alternative...\n');
    }

    // Warte, dass der Tab vollständig geladen ist
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // ============================================================
    // 4. ARTIST TAB ÖFFNEN
    // ============================================================
    console.log('🎤 Clicking Artists subtab...');
    
    const artistsButton = page.locator('button:has-text("Artists")').first();
    if (await artistsButton.isVisible({ timeout: 5000 })) {
      await artistsButton.click();
      await page.waitForTimeout(500);
      console.log('✅ Artists subtab opened');
    } else {
      console.warn('⚠️  Artists button not found');
    }

    // Export Artists CSV
    console.log('📥 Exporting Artists CSV...');
    await downloadCSV(page, 'artists');

    // ============================================================
    // 5. ALBUMS EXPORTIEREN
    // ============================================================
    console.log('💿 Clicking Albums subtab...');
    
    const albumsButton = page.locator('button:has-text("Albums")').first();
    if (await albumsButton.isVisible({ timeout: 5000 })) {
      await albumsButton.click();
      await page.waitForTimeout(500);
      console.log('✅ Albums subtab opened');
    } else {
      console.warn('⚠️  Albums button not found');
    }

    // Export Albums CSV
    console.log('📥 Exporting Albums CSV...');
    await downloadCSV(page, 'albums');

    // ============================================================
    // 6. TRACKS EXPORTIEREN
    // ============================================================
    console.log('🎵 Clicking Tracks subtab...');
    
    const tracksButton = page.locator('button:has-text("Tracks")').first();
    if (await tracksButton.isVisible({ timeout: 5000 })) {
      await tracksButton.click();
      await page.waitForTimeout(500);
      console.log('✅ Tracks subtab opened');
    } else {
      console.warn('⚠️  Tracks button not found');
    }

    // Export Tracks CSV
    console.log('📥 Exporting Tracks CSV...');
    await downloadCSV(page, 'tracks');

    // ============================================================
    // 7. SCROBBLES TAB FÜR FATGAD
    // ============================================================
    console.log('🎧 Clicking Scrobbles tab...');
    
    const scrobblesTab = page.locator('text=Scrobbles');
    if (await scrobblesTab.isVisible({ timeout: 5000 })) {
      await scrobblesTab.click();
      await page.waitForTimeout(500);
      console.log('✅ Scrobbles tab opened');
    } else {
      console.warn('⚠️  Scrobbles tab not found');
    }

    // Export Scrobbles CSV (FATGAD)
    console.log('📥 Exporting Scrobbles CSV (FATGAD)...');
    await downloadCSV(page, 'scrobbles');

    // ============================================================
    // FERTIG
    // ============================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ CSV Export erfolgreich abgeschlossen!');
    console.log('='.repeat(70) + '\n');

    // Zeige exportierte Dateien
    const files = fs.readdirSync(DOWNLOAD_DIR);
    console.log('📋 Exported files:');
    files.forEach(f => {
      const size = fs.statSync(path.join(DOWNLOAD_DIR, f)).size;
      console.log(`   ✓ ${f} (${formatBytes(size)})`);
    });
    console.log('');

    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

/**
 * Helper: Download CSV Button klicken
 */
async function downloadCSV(page, tabName) {
  try {
    // Suche nach Download Button (kann verschiedene Namen haben)
    const downloadButton = page.locator(
      'button:has-text("CSV"), button:has-text("csv"), button:has-text("Download")'
    ).first();

    if (await downloadButton.isVisible({ timeout: 5000 })) {
      // Promise für den Download starten
      const downloadPromise = page.waitForEvent('download');
      
      await downloadButton.click();
      
      // Warte auf Download
      const download = await downloadPromise;
      
      // Speichere mit standardisiertem Namen
      const filename = mapTabNameToFilename(tabName);
      const filepath = path.join(DOWNLOAD_DIR, filename);
      
      await download.saveAs(filepath);
      console.log(`   ✓ ${filename} exported`);
    } else {
      console.warn(`   ⚠️  Download button not found for ${tabName}`);
    }
  } catch (error) {
    console.warn(`   ⚠️  Could not download ${tabName}: ${error.message}`);
  }
}

/**
 * Mappt Tab-Namen zu CSV-Dateinamen
 */
function mapTabNameToFilename(tabName) {
  const mapping = {
    'artists': 'lastfmstats-artists-export.csv',
    'albums': 'lastfmstats-albums-export.csv',
    'tracks': 'lastfmstats-tracks-export.csv',
    'scrobbles': 'lastfmstats-fadgad.csv',
  };
  return mapping[tabName] || `${tabName}.csv`;
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
