const electron = require('electron')
var fs = require('fs')
var path = require('path')
var ssbKeys = require('ssb-keys')
var extend = require('xtend')

var config = require('ssb-config/inject')(
  process.env.ssb_appname,
  { logging: { level: 'info' } }
)

config.path = (process.env.DIR && path.join(__dirname, process.env.DIR)) || electron.app.getPath('appData')

module.exports = opts => {
  var keys = ssbKeys.loadOrCreateSync(path.join(config.path, 'secret'))

  var manifestFile = path.join(config.path, 'manifest.json')

  var createSbot = require('scuttlebot')
    .use(require('scuttlebot/plugins/plugins'))
    .use(require('scuttlebot/plugins/master'))
    .use(require('scuttlebot/plugins/gossip'))
    .use(require('scuttlebot/plugins/friends'))
    .use(require('scuttlebot/plugins/replicate'))
    .use(require('scuttlebot/plugins/blobs'))
    .use(require('scuttlebot/plugins/invite'))
    .use(require('scuttlebot/plugins/block'))
    .use(require('scuttlebot/plugins/local'))
    .use(require('scuttlebot/plugins/logging'))
    .use(require('scuttlebot/plugins/private'))

  config = extend(config, {
    keys: keys,
    appKey: new Buffer('xaZv2HJjzKX72xsLiEt8Ozsfx9rhii5xZfyDgyDyHG0=', 'base64')
  })

  config = extend(config, opts)

  var sbot = createSbot(config)
  fs.writeFileSync(manifestFile, JSON.stringify(sbot.getManifest(), null, 2))

  return sbot
}
