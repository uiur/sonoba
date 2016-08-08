'use strict'

const electron = require('electron')

const linkText = require('link-text')
const defaultUserName = require('./user-name')
const Swarm = require('./bonjour-swarm')

const fs = require('fs')
const path = require('path')
const concat = require('concat-stream')
const JSONStream = require('JSONStream')

const swarm = new Swarm()
const React = require('react')
const ReactDOM = require('react-dom')
const wifiName = require('wifi-name')
const cx = require('classnames')
const moment = require('moment')

const logPath = path.join(electron.remote.app.getPath('userData'), 'log')
const log = fs.createWriteStream(logPath, { flags: 'a' })

const me = {
  email: require('git-user-email')()
}

me.icon_url = require('gravatar').url(me.email, { protocol: 'https', size: 100 })

// the message format is almost same as Slack
// {
//   user: 'cuid',
//   username: 'Kazato Sugimoto',
//   icon_url: 'https://hoge.com/foo.png',
//   text: 'hello!',
//   ts: '1358878755'
// }
function say (message) {
  message.ts = Date.now()
  message.user = me.id
  message.username = me.name
  message.icon_url = me.icon_url

  swarm.broadcast(message)
}

function updateTitle (data) {
  const peerCount = swarm.size()
  document.title = `sonoba (${peerCount})`
}

updateTitle()
swarm.on('connect', updateTitle)
swarm.on('disconnect', updateTitle)

class Log extends React.Component {
  constructor (props) {
    super(props)
    this.state = { messages: [], input: '' }
  }

  componentDidMount () {
    fs.createReadStream(logPath)
      .pipe(JSONStream.parse())
      .pipe(concat(data => {
        this.setState({ messages: data })
        this.setupSwarm()
      }))
  }

  setupSwarm () {
    swarm.on('message', message => {
      console.log(message)
      this.append(message)
    })

    swarm.on('connect', peerId => {
      this.append({
        type: 'system',
        username: 'sonoba',
        text: `${peerId} joined`
      })
    })

    this.append({
      type: 'system',
      username: 'sonoba',
      text: `Joined network ${me.wifiName}`
    })
  }

  append (message) {
    message.ts = message.ts || Date.now()

    const { messages } = this.state
    messages.push(message)
    log.write(JSON.stringify(message) + '\n')

    this.setState({ messages: messages }, () => {
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight
    })
  }

  render () {
    return React.DOM.div({}, [
      React.DOM.ul({
        className: 'messages',
        key: 'log',
        ref: element => {
          this.messagesElement = element
        }
      }, this.state.messages.filter((message, index) => {
        const prevMessage = this.state.messages[index - 1]
        if (!prevMessage) return true

        const duplicated = prevMessage.type === 'system' && prevMessage.text === message.text

        return !duplicated
      }).map(message => {
        return Message({ message: message })
      })),
      React.DOM.div({ className: 'message-form-container', key: 'form' },
        React.DOM.input({
          className: 'message-form',
          type: 'text',
          value: this.state.input,
          autoFocus: true,
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

function Message ({ message }) {
  const dateString = moment(message.ts).format('LT')

  const isSystem = message.type === 'system'

  let children = []
  if (isSystem) {
    children.push(
      React.DOM.div({
        className: 'message-system-icon',
        key: 'icon'
      })
    )
  } else {
    children.push(
      React.DOM.div({
        className: 'message-header',
        key: 'header'
      }, [
        React.DOM.span({
          className: 'message-username',
          key: 'username'
        }, message.username),
        React.DOM.time({
          className: 'message-time',
          dateTime: new Date(message.ts).toISOString(),
          key: 'time'
        }, dateString)
      ])
    )

    children.push(
      React.DOM.img({
        className: 'message-icon',
        src: message.icon_url,
        key: 'icon'
      })
    )
  }

  children.push(
    React.DOM.div({
      className: cx('message-text', { 'message-text-system': isSystem }),
      dangerouslySetInnerHTML: { __html: linkText(message.text, { target: '_blank' }) },
      key: 'text'
    })
  )

  return React.DOM.li({
    className: cx('message', { 'message-system': isSystem }),
    key: message.ts
  }, children)
}

Promise.all([defaultUserName(), wifiName()]).then(([username, wifi]) => {
  me.name = username
  me.id = swarm.id
  me.wifiName = wifi

  ReactDOM.render(
    React.createFactory(Log)(),
    document.getElementById('main')
  )
})
