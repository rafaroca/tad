const db = require('sqlite')
const reltab = require('../src/reltab')
const commandLineArgs = require('command-line-args')
const getUsage = require('command-line-usage')
const reltabSqlite = require('../src/reltab-sqlite')
const csvimport = require('../src/csvimport')

const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')

require('console.table')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({width: 1150, height: 910})

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  mainWindow.webContents.openDevTools({mode: 'bottom'})
  mainWindow.webContents.closeDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

const runQuery = rtc => (queryStr, cb) => {
  try {
    const query = reltab.deserializeQuery(queryStr)
    rtc.evalQuery(query)
      .then(res => {
        // console.log('runQuery returning:')
        // const ctf : any = console.table
        // ctf(res.schema.columns, res.rowData)
        const serRes = JSON.stringify(res, null, 2)
        cb(serRes)
      })
      .catch(err => console.error('error running query: ', err, err.stack))
  } catch (err) {
    console.error('runQuery: ', err, err.stack)
  }
}

// App initialization:
const appInit = (path) => {
  try {
    console.log('appInit: entry')
    db.open(':memory:')
      .then(() => csvimport.importSqlite(path))
      .then(md => {
        throw new Error('damnit')
        global.md = md
        return reltabSqlite.init(db, md)
      })
      .then(rtc => {
        console.log('completed reltab initalization.')
        // Now let's place a function in global so it can be run via remote:
        global.runQuery = runQuery(rtc)
        createWindow()
      })
      .catch(err => {
        console.error('*** Error: ', err.message)
        app.quit()
      })
  } catch (err) {
    console.error('Error during app initialization: ', err)
  }
}

const optionDefinitions = [
  { name: 'verbose', alias: 'v', type: Boolean },
  { name: 'help', alias: 'h', type: Boolean },
  { name: 'csvfile', type: String, defaultOption: true,
    typeLabel: '[underline]{file}.csv',
    description: 'CSV file to view, with header row'
  }
]

const usageInfo = [
  {
    header: 'Tad',
    content: 'A viewer for tabular data.'
  },
  {
      header: 'Synopsis',
      content: [
        '$ tad [[italic]{options}] [underline]{file}.csv'
      ]
  },
  {
    header: 'Options',
    optionList: optionDefinitions.filter(opt => opt.name != 'csvfile')
  }
]

const showUsage = () => {
  const usage = getUsage(usageInfo)
  console.log(usage)
}

const main = () => {
  try {
    process.on('uncaughtException', function (error) {
      console.error('*** Error: ', error.message)
      app.quit()
    })
    const argv = process.argv.slice(1)
    const options = commandLineArgs(optionDefinitions, argv)
    if (options.help) {
      showUsage()
      app.quit()
    }

    global.options = options

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', () => appInit(options.csvfile))

    // Quit when all windows are closed.
    app.on('window-all-closed', function () {
      // On OS X it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('activate', function () {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) {
        createWindow()
      }
    })
  } catch (err) {
    console.error('Error: ', err.message )
    showUsage()
    app.quit()
  }
}

main()
