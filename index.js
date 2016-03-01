const promptly = require('promptly')
const request = require('request-promise')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf-promise')
const mkdirp = require('mkdirp-promise')
const gm = require('gm')
let directory

function readStickerId() {
  return new Promise((resolve, reject) => {
    promptly.prompt('Enter sticker id: ', async (err, value) => {
      resolve(value)
    })
  })
}

async function getLinks() {
  const stickerId = await readStickerId()
  let res = await request(`https://php-necroa.rhcloud.com/stickerline.php?stickerid=${stickerId}`)
  let links
  try {
    res = JSON.parse(res)
    links = res.link
    directory = res.title
  } catch (e) {
    links = null
  }
  return links
}

function getDelayedNull() {
  // Wait 250ms to retry
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(null)
    }, 250)
  })
}

function download(links) {
  const tasks = links.map(async (url) => {
    return new Promise(async (resolve) => {
      const parsed = require('url').parse(url)
      const filename = path.join(directory, path.basename(parsed.pathname))
      let binary
      do {
        try {
          binary = await request({
            method: 'POST',
            uri: 'http://waifu2x.udp.jp/api',
            form: {
                url: url,
                style: 'art',
                noise: 0,
                scale: 2
            },
            encoding: null
          })
        } catch (e) {
          binary = await getDelayedNull()
        }
      } while (binary === null)
      fs.writeFile(filename, binary, (err) => {
        if (err) {
          console.err(err)
          return
        }
        resolve(filename)
        console.log(`${filename} converted to 2x.`)
      })
    })
  })
  return new Promise((resolve, reject) => {
    Promise.all(tasks).then((files) => {
      resolve(files)
    })
  })
}

function process(files) {
  files.forEach((file) => {
    const magick = gm(file)
    magick.size((error, size) => {
      const width = size.width
      const height = size.height
      magick
      .background('transparent')
      .resize(width, height)
      .gravity('Center')
      .extent(512, 512)
      .write(file, (err) => {
        if (err) {
          throw err
        }
        console.log(`${file} resized to 512x512.`)
      })
    })
  })
}

async function start() {
  const links = await getLinks()
  await rimraf(directory)
  await mkdirp(directory)
  const files = await download(links)
  console.log('Download completed.')
  process(files)
}

start()
