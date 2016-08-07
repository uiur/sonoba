'use strict'

const linkText = require('link-text')
const defaultUserName = require('./user-name')
const Swarm = require('./bonjour-swarm')

const swarm = new Swarm()
const React = require('react')
const ReactDOM = require('react-dom')

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
    swarm.on('message', message => {
      console.log(message)
      this.append(message)
    })

    swarm.on('connect', peerId => {
      this.append({
        ts: Date.now(),
        username: 'sonoba',
        text: `${peerId} joined`
      })
    })
  }

  append (message) {
    const { messages } = this.state
    messages.push(message)
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
      }, this.state.messages.map(message => {
        return React.DOM.li({
          className: 'message',
          key: message.ts
        }, [
          React.DOM.img({
            className: 'message-icon',
            src: message.icon_url,
            key: 'icon'
          }),
          React.DOM.div({
            className: 'message-username',
            key: 'username'
          }, message.username),
          React.DOM.div({
            className: 'message-text',
            dangerouslySetInnerHTML: { __html: linkText(message.text, { target: '_blank' }) },
            key: 'text'
          })
        ])
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

defaultUserName().then(name => {
  me.name = name
  me.id = swarm.id

  ReactDOM.render(
    React.createFactory(Log)(),
    document.getElementById('main')
  )
})
