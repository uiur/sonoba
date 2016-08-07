'use strict'

const getPort = require('get-port')
const SignalServer = require('./signal-server')

const bonjour = require('bonjour')()

const defaultUserName = require('./user-name')
const Swarm = require('./swarm')

const me = {}

const swarm = new Swarm()
const React = require('react')
const ReactDOM = require('react-dom')

// the message format is almost same as Slack
// {
//   user: 'cuid',
//   username: 'Kazato Sugimoto',
//   icon_url: 'https://hoge.com/foo.png',
//   text: 'hello!',
//   ts: '1358878755'
// }
function say (message) {
  message.ts = Number(new Date())
  message.user = me.id
  message.username = me.name

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
      this.append({ ts: Number(new Date()), text: `${peerId} joined` })
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
          message.username
          ? message.username + ': ' + message.text
          : message.text

        return React.DOM.li({ key: message.ts }, body)
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
              const message = { text: e.target.value }
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
  me.id = swarm.id

  const signalServer = new SignalServer({ port: port })
  signalServer.on('listen', () => {
    bonjour.publish({ name: `sonoba-${me.id}`, type: 'http', port: port, host: me.id })
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
    if ((/sonoba-/).test(service.name) && service.host !== me.id) {
      console.log('found host:', service)
      swarm.addPeer(service)
    }
  })

  ReactDOM.render(
    React.createFactory(Log)(),
    document.getElementById('main')
  )
})
