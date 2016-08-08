const getPort = require('get-port')
const SignalServer = require('./signal-server')

const bonjour = require('bonjour')()

const Peer = require('simple-peer')
const request = require('axios')
const extend = require('xtend')
const EventEmitter = require('events')
const ip = require('ip')
const cuid = require('cuid')

class Swarm extends EventEmitter {
  constructor (options) {
    options = options || {}
    super()
    this.id = cuid()
    this.peers = {}
    this.signalBuffer = {}
    this.peerOption = { wrtc: options.wrtc, config: { iceServers: [] } }

    this.setupSignalServer()
  }

  setupSignalServer () {
    const swarm = this

    getPort().then(port => {
      const signalServer = new SignalServer({ port: port })
      signalServer.on('listen', () => {
        bonjour.publish({
          name: `sonoba-${swarm.id}`,
          type: 'http',
          port: port,
          host: swarm.id
        })
      }).on('signal', (signal, host) => {
        if (swarm.peers[host]) {
          swarm.peers[host].signal(signal)
        } else {
          swarm.signalBuffer[host] = swarm.signalBuffer[host] || []
          swarm.signalBuffer[host].push(signal)
        }
      })

      const browser = bonjour.find({ type: 'http' })
      browser.on('up', service => {
        if ((/sonoba-/).test(service.name) && service.host !== swarm.id) {
          console.log('found host:', service)
          swarm.addPeer(service)
        }
      })
    })
  }

  addPeer (service) {
    let peerOptions = this.peerOption
    if (service.host < this.id) {
      peerOptions = extend(this.peerOption, { initiator: true })
    }

    const peerHost = service.addresses.find(ip.isV4Format)
    const baseUrl = `http://${peerHost}:${service.port}`
    let p = this.peers[service.host] = new Peer(peerOptions)

    p.on('signal', (data) => {
      request.post(`${baseUrl}/signal/${this.id}`, data)
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
