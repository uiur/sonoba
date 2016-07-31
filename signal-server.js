'use strict'

const EventEmitter = require('events')
const express = require('express')

class SignalServer extends EventEmitter {
  constructor ({ port: port }) {
    super()

    const server = this.server = express()
    server.use(require('body-parser').json())
    server.post('/signal/:host', (req, res) => {
      console.log('receive: /signal/' + req.params.host)
      this.emit('signal', req.body, req.params.host)
      res.send()
    })

    server.get('/', (req, res) => res.send('yo'))
    server.listen(port, () => this.emit('listen'))
  }
}

module.exports = SignalServer
