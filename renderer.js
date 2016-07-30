'use strict'

const Peer = require('simple-peer')
const request = require('axios')
const extend = require('xtend')
const getPort = require('get-port')
const EventEmitter = require('events')
const SignalServer = require('./signal-server')

const bonjour = require('bonjour')()
const id = require('cuid')()
const defaultPeerOptions = { config: { iceServers: [] } }

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

    const baseUrl = `http://${service.addresses[1]}:${service.port}`
    let p = this.peers[service.host] = new Peer(peerOptions)

    p.on('signal', (data) => {
      request.post(`${baseUrl}/signal/${id}`, data)
        .then(response => {
          console.log(response)
        })
    })

    p.on('connect', () => {
      console.log(`connect: ${service.host}`)
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
      delete this.peers[service.host]
    })
  }

  broadcast (message) {
    Object.keys(this.peers).forEach(host => {
      this.peers[host].send(JSON.stringify(message))
    })
  }
}

const swarm = new Swarm()
const React = require('react')
const ReactDOM = require('react-dom')

class Log extends React.Component {
  constructor (props) {
    super(props)
    this.state = { messages: [], input: '' }
  }

  componentDidMount () {
    console.log('mount')
    swarm.on('message', message => {
      console.log(message)
      this.append(message)
    })
  }

  append (message) {
    message.time = Number(new Date())

    const { messages } = this.state
    messages.push(message)
    this.setState({ messages: messages })
  }

  render () {
    return React.DOM.div({}, [
      React.DOM.ul({}, this.state.messages.map(message => {
        return React.DOM.li({ key: message.time }, message.body)
      })),
      React.DOM.div({}, [
        React.DOM.input({
          type: 'text',
          value: this.state.input,
          onChange: e => this.setState({ input: e.target.value }),
          onKeyDown: e => {
            if (e.key === 'Enter') {
              const message = { body: e.target.value }
              swarm.broadcast(message)
              this.append(message)

              this.setState({ input: '' })
            }
          }
        })
      ])
    ])
  }
}

getPort().then(port => {
  const browser = bonjour.find({ type: 'http' })
  browser.on('up', service => {
    if ((/sonoba-/).test(service.name) && service.host !== id) {
      console.log('found host:', service)
      swarm.addPeer(service)
    }
  })

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

  ReactDOM.render(
    React.createFactory(Log)(),
    document.getElementById('main')
  )
})
