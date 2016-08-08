// echo bot
// Usage:
//   npm i electron-webrtc
//   node example/echo.js
'use strict'

const Client = require('../client')
const client = new Client({
  username: 'echo',
  icon_url: 'https://i.gyazo.com/2f8ed43c662aef4c12bc53468fca1cb6.jpg',
  wrtc: require('electron-webrtc')({ headless: true })
})

client.on('connect', peerId => {
  console.log(`peer ${peerId} joined`)
})

client.on('message', data => {
  setTimeout(() => {
    client.send({
      text: data.text
    })
  }, 1000)
})
