'use strict'

const electron = require('electron')

const linkText = require('link-text')
const defaultUserName = require('./user-name')

const React = require('react')
const ReactDOM = require('react-dom')
const wifiName = require('wifi-name')
const cx = require('classnames')
const moment = require('moment')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const got = require('got')

const sbot = electron.remote.getGlobal('sbot')

// the message format is almost same as Slack
// {
//   user: 'cuid',
//   username: 'Kazato Sugimoto',
//   icon_url: 'https://hoge.com/foo.png',
//   text: 'hello!',
//   ts: '1358878755'
// }
function say (message) {
  message.user = me.id
  message.username = me.name
  message.icon_url = me.icon_url

  sbot.publish({ type: 'post', text: message.text }, (err, msg) => {
    if (err) console.error(err)
    console.log(msg)
  })
}

// function updateTitle (data) {
//   const peerCount = swarm.size()
//   document.title = `sonoba (${peerCount})`
// }

// updateTitle()
// swarm.on('connect', updateTitle)
// swarm.on('disconnect', updateTitle)

class Log extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      messages: [],
      input: '',
      profiles: {}
    }
  }

  componentDidMount () {
    pull(
      sbot.createFeedStream({ live: true }),
      pull.drain(data => {
        const { value } = data
        const { messages, profiles } = this.state

        if (!(value && value.content)) return

        if (value.content.type === 'about') {
          if (value.author !== value.content.about) return

          profiles[value.author] = profiles[value.author] || {}

          if (value.content.name) {
            profiles[value.author].name = value.content.name
          }

          if (value.content.image) {
            let image = profiles[value.author].image = value.content.image

            pull(
              sbot.blobs.get(image.link),
              pull.collect((err, values) => {
                if (err) throw err

                const blob = new window.Blob(values)
                const icon = window.URL.createObjectURL(blob)
                profiles[value.author].icon = icon

                this.updateMessages(profiles)
              })
            )
          }

          this.updateMessages(profiles)
        }

        if (value.content.type === 'post') {
          const profile = profiles[value.author]
          this.append({
            author: value.author,
            profile: profile,
            username: profile && profile.name,
            icon: profile && profile.icon,
            ts: value.timestamp,
            text: value.content.text
          })
        }
      })
    )

    this.append({
      type: 'system',
      username: 'sonoba',
      text: `Joined network ${me.wifiName}`
    })
  }

  updateMessages (profiles) {
    const { messages } = this.state

    messages.forEach(message => {
      const profile = message.profile = profiles[message.author]
      if (profile) {
        message.username = profile.name
        message.icon = profile.icon
      }
    })

    this.setState({ messages: messages, profiles: profiles })
  }

  append (message) {
    message.ts = message.ts || Date.now()

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
      }, this.state.messages.filter((message, index) => {
        const prevMessage = this.state.messages[index - 1]
        if (!prevMessage) return true

        const duplicated = prevMessage.type === 'system' && prevMessage.text === message.text

        return !duplicated
      }).map(message => {
        return Message({
          message: message
        })
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
        }, message.username || message.author),
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
        src: message.icon,
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

function getProfile (id, cb) {
  let profile = {}

  pull(
    sbot.links({ source: id, dest: id, rel: 'about', values: true }),
    pull.collect((err, abouts) => {
      if (err) return cb(err)

      abouts.forEach(({ value }) => {
        if (value.content.name) {
          profile.name = value.content.name
        }
      })

      cb(null, profile)
    })
  )
}

const me = {
  email: require('git-user-email')()
}


Promise.all([defaultUserName(), wifiName()]).then(([username, wifi]) => {
  me.name = username
  me.id = sbot.whoami().id
  me.wifiName = wifi

  getProfile(me.id, (err, profile) => {
    if (err) throw err

    if (!profile.name) {
      sbot.publish({
        type: 'about',
        name: username,
        about: me.id
      }, err => {
        if (err) throw err
      })
    }

    if (!profile.image) {
      const size = 100
      const iconUrl = require('gravatar').url(me.email, { protocol: 'https', size: size })

      pull(
        toPull.source(got.stream(iconUrl)),
        sbot.blobs.add((err, hash) => {
          if (err) console.error(err)

          sbot.publish({
            type: 'about',
            about: me.id,
            image: {
              link: hash,
              width: size,
              height: size
            }
          }, err => {
            if (err) throw err
          })
        })
      )
    }
  })

  ReactDOM.render(
    React.createFactory(Log)(),
    document.getElementById('main')
  )
})
