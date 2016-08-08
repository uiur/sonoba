const extend = require('xtend')
const EventEmitter = require('events')
const Swarm = require('./bonjour-swarm')

class Client extends EventEmitter {
  // config: {
  //   username: 'uiureo',
  //   icon_url: 'https://imgur.com/a.png'
  // }
  constructor (config) {
    super()

    this.config = config
    this.swarm = new Swarm({ wrtc: config.wrtc })
    delete config.wrtc

    this.swarm.on('message', data => this.emit('message', data))
    this.swarm.on('connect', data => this.emit('connect', data))
  }

  send (message) {
    message.ts = Date.now()
    message.user = this.swarm.id
    message = extend(message, this.config)

    this.swarm.broadcast(message)
  }
}

module.exports = Client
