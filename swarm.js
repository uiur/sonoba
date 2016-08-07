const Peer = require('simple-peer')
const request = require('axios')
const extend = require('xtend')
const EventEmitter = require('events')
const ip = require('ip')
const cuid = require('cuid')
const defaultPeerOptions = { config: { iceServers: [] } }

class Swarm extends EventEmitter {
  constructor () {
    super()
    this.id = cuid()
    this.peers = {}
    this.signalBuffer = {}
  }

  addPeer (service) {
    let peerOptions = defaultPeerOptions
    if (service.host < this.id) {
      peerOptions = extend(defaultPeerOptions, { initiator: true })
    }

    const peerHost = service.addresses.find(ip.isV4Format)
    const baseUrl = `http://${peerHost}:${service.port}`
    let p = this.peers[service.host] = new Peer(peerOptions)

    p.on('signal', (data) => {
      request.post(`${baseUrl}/signal/${this.id}`, data)
        .then(response => {
          console.log(response)
        })
    })

    p.on('connect', () => {
      console.log(`connect: ${service.host}`)
      p.connected = true
      this.emit('connect', service.host)
    })

    if (this.signalBuffer[service.host]) {
      this.signalBuffer[service.host].forEach(signal => p.signal(signal))
      delete this.signalBuffer[service.host]
    }

    p.on('data', data => {
      let message
      try {
        message = JSON.parse(data.toString())
      } catch (e) {
      }

      this.emit('message', message)
    })

    p.on('close', () => {
      console.log('connection closed: ' + service.host)
      delete this.peers[service.host]

      this.emit('disconnect', service.host)
    })
  }

  broadcast (message) {
    Object.keys(this.peers).forEach(host => {
      let peer = this.peers[host]
      if (peer.connected) {
        peer.send(JSON.stringify(message))
      }
    })
  }

  size () {
    return Object.keys(this.peers).length
  }
}

module.exports = Swarm
