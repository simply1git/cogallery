import puppeteer from 'puppeteer'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Bot Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const BOT_EMAIL = process.env.BOT_EMAIL
const BOT_PASSWORD = process.env.BOT_PASSWORD

if (!BOT_EMAIL || !BOT_PASSWORD) {
  console.error('ERROR: BOT_EMAIL and BOT_PASSWORD must be set in .env')
  process.exit(1)
}

async function startBot() {
  console.log('🚀 Starting CoGallery WebRTC Seedbox Bot...')

  // Path to store persistent browser data (IndexedDB, LocalStorage)
  const userDataDir = path.join(__dirname, 'bot-data')

  const browser = await puppeteer.launch({
    headless: 'new', // Use the new headless mode
    userDataDir,     // Persist cache across restarts!
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // We need to allow WebRTC without prompt
      '--use-fake-ui-for-media-stream',
    ]
  })

  const page = await browser.newPage()
  
  // Forward browser console to terminal
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[BOT]')) {
      console.log(text)
    }
  })

  try {
    console.log(`🌐 Navigating to ${APP_URL}...`)
    await page.goto(APP_URL, { waitUntil: 'networkidle0' })

    // Check if we are already logged in by looking for the Seedbox URL
    await page.goto(`${APP_URL}/bot/seedbox`, { waitUntil: 'networkidle0' })
    
    // Wait a moment to see if it redirects to root (which means unauthenticated)
    await new Promise(r => setTimeout(r, 2000))
    
    const currentUrl = page.url()
    if (!currentUrl.includes('/bot/seedbox')) {
      console.log('🔒 Not logged in. Authenticating as bot user...')
      
      // Go to login page 
      await page.goto(`${APP_URL}/auth`, { waitUntil: 'networkidle0' })
      
      // We need to interact with the auth form.
      await page.waitForSelector('input[type="email"]')
      await page.type('input[type="email"]', BOT_EMAIL)
      await page.type('input[type="password"]', BOT_PASSWORD)
      
      // Submit the form (find the Sign In button)
      const submitBtn = await page.$('button[type="submit"]')
      if (submitBtn) {
        await submitBtn.click()
        // Wait for auth to complete (SPAs don't trigger full navigations, and WebSockets prevent networkidle)
        await new Promise(r => setTimeout(r, 3000))
      } else {
        console.error('Could not find login button.')
      }

      // Now navigate to the seedbox
      console.log('✅ Logged in. Navigating to seedbox...')
      await page.goto(`${APP_URL}/bot/seedbox`, { waitUntil: 'networkidle0' })
    }

    console.log('🟢 Bot is running and connected to WebRTC network.')
    console.log('Press Ctrl+C to stop.')

    // Prevent the script from exiting
    await new Promise(() => {}) 

  } catch (err) {
    console.error('❌ Bot Error:', err)
    await browser.close()
    process.exit(1)
  }
}

startBot()
