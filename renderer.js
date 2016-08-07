'use strict'

const Peer = require('simple-peer')
const request = require('axios')
const extend = require('xtend')
const getPort = require('get-port')
const EventEmitter = require('events')
const SignalServer = require('./signal-server')

const ip = require('ip')
const bonjour = require('bonjour')()
const id = require('cuid')()
const defaultPeerOptions = { config: { iceServers: [] } }

const defaultUserName = require('./user-name')

const me = {}

class Swarm extends EventEmitter {
  constructor () {
    super()
    this.peers = {}
    this.signalBuffer = {}
  }

  addPeer (service) {
    let peerOptions = defaultPeerOptions
    if (service.host < id) {
      peerOptions = extend(defaultPeerOptions, { initiator: true })
    }

    const peerHost = service.addresses.find(ip.isV4Format)
    const baseUrl = `http://${peerHost}:${service.port}`
    let p = this.peers[service.host] = new Peer(peerOptions)

    p.on('signal', (data) => {
      request.post(`${baseUrl}/signal/${id}`, data)
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
}

const swarm = new Swarm()
const React = require('react')
const ReactDOM = require('react-dom')

function say (message) {
  message.time = Number(new Date())
  message.user = me.name

  swarm.broadcast(message)
}

class Log extends React.Component {
  constructor (props) {
    super(props)
    this.state = { messages: [], input: '' }
  }

  componentDidMount () {
    swarm.on('message', message => {
      console.log(message)
      this.append(message)
    })

    swarm.on('connect', peerId => {
      this.append({ time: Number(new Date()), body: `${peerId} joined` })
    })
  }

  append (message) {
    const { messages } = this.state
    messages.push(message)
    this.setState({ messages: messages })
  }

  render () {
    return React.DOM.div({}, [
      React.DOM.ul({ key: 'log' }, this.state.messages.map(message => {
        let body =
          message.user
          ? message.user + ': ' + message.body
          : message.body

        return React.DOM.li({ key: message.time }, body)
      })),
      React.DOM.div({ className: 'message-form-container', key: 'form' },
        React.DOM.input({
          className: 'message-form',
          type: 'text',
          value: this.state.input,
          onChange: e => this.setState({ input: e.target.value }),
          onKeyPress: e => {
            if (e.target.value.length === 0) return

            if (e.key === 'Enter') {
              const message = { body: e.target.value }
              say(message)
              this.append(message)

              this.setState({ input: '' })
            }
          }
        })
      )
    ])
  }
}

Promise.all([getPort(), defaultUserName()]).then(([port, name]) => {
  me.name = name

  const signalServer = new SignalServer({ port: port })
  signalServer.on('listen', () => {
    bonjour.publish({ name: 'sonoba-' + id, type: 'http', port: port, host: id })
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
    if ((/sonoba-/).test(service.name) && service.host !== id) {
      console.log('found host:', service)
      swarm.addPeer(service)
    }
  })

  ReactDOM.render(
    React.createFactory(Log)(),
    document.getElementById('main')
  )
})
