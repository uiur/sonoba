const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const menu = require('./menu')
const getPort = require('get-port')

require('electron-context-menu')()

const sbotIsReady = getPort().then(port => {
  global.sbot = require('./sbot')({
    port: port // avoid port conflict with the main scuttlebot
  })
}).catch(console.error.bind(console))

let mainWindow

function createWindow () {
  electron.Menu.setApplicationMenu(menu)

  mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    titleBarStyle: 'hidden-inset'
  })

  mainWindow.loadURL(`file://${__dirname}/index.html`)

  mainWindow.on('closed', function () {
    mainWindow = null
  })

  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault()
    electron.shell.openExternal(url)
  })
}

app.on('ready', () => sbotIsReady.then(createWindow))

app.on('window-all-closed', function () {
  app.quit()
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})
