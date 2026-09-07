const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

/**
 * Builds electron/icon.ico from scripts/icon-source.png (256px).
 *
 * Dependency-free pipeline: PNG decode (bit depth 8, colour types 2/6, filters
 * 0..4) -> box-filter downscale -> PNG re-encode via node:zlib -> ICO
 * container referencing the PNG payload directly (Windows keeps PNG-encoded
 * icons since Vista).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const prefix = Buffer.alloc(8)
  prefix.writeUInt32BE(data.length, 0)
  prefix.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0)
  return Buffer.concat([prefix, data, crc])
}

function decodePng(source) {
  const raw = fs.readFileSync(source)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (raw.length < 8 || !raw.slice(0, 8).equals(signature)) throw new Error('Not a PNG file')

  let ihdr = null
  const idatParts = []
  let cursor = 8
  while (cursor + 12 <= raw.length) {
    const length = raw.readUInt32BE(cursor)
    const type = raw.toString('ascii', cursor + 4, cursor + 8)
    if (type === 'IHDR') {
      ihdr = {
        width: raw.readUInt32BE(cursor + 8),
        height: raw.readUInt32BE(cursor + 12),
        bitDepth: raw.readUInt8(cursor + 16),
        colorType: raw.readUInt8(cursor + 17),
      }
    } else if (type === 'IDAT') {
      idatParts.push(raw.slice(cursor + 8, cursor + 8 + length))
    } else if (type === 'IEND') {
      break
    }
    cursor += 12 + length
  }
  if (!ihdr || idatParts.length === 0) throw new Error('PNG lacks IHDR or image data')
  if (ihdr.bitDepth !== 8) throw new Error('Only 8-bit PNG files are supported')
  const channels = ihdr.colorType === 6 ? 4 : ihdr.colorType === 2 ? 3 : 0
  if (channels === 0) throw new Error('Only RGB/RGBA PNG files are supported')

  const inflated = zlib.inflateSync(Buffer.concat(idatParts))
  const stride = ihdr.width * channels
  const pixels = Buffer.alloc(ihdr.height * stride)
  const previous = Buffer.alloc(stride)

  let read = 0
  for (let y = 0; y < ihdr.height; y++) {
    const filter = inflated[read++]
    const row = inflated.slice(read, read + stride)
    read += stride
    if (row.length < stride) throw new Error('PNG stream truncated')
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0
      const up = previous[x]
      const upLeft = x >= channels ? previous[x - channels] : 0
      let value = row[x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      }
      row[x] = value & 0xff
    }
    row.copy(pixels, y * stride)
    previous.set(row)
  }

  return { width: ihdr.width, height: ihdr.height, channels, pixels }
}

/** Box-filter downscale to a size×size RGBA pixel buffer. */
function resizeToSquare(image, size) {
  const out = Buffer.alloc(size * size * 4)
  const scaleX = image.width / size
  const scaleY = image.height / size
  for (let targetY = 0; targetY < size; targetY++) {
    const y0 = Math.floor(targetY * scaleY)
    const y1 = Math.max(y0 + 1, Math.floor((targetY + 1) * scaleY))
    for (let targetX = 0; targetX < size; targetX++) {
      const x0 = Math.floor(targetX * scaleX)
      const x1 = Math.max(x0 + 1, Math.floor((targetX + 1) * scaleX))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let samples = 0
      for (let y = y0; y < Math.min(y1, image.height); y++) {
        for (let x = x0; x < Math.min(x1, image.width); x++) {
          const index = (y * image.width + x) * image.channels
          r += image.pixels[index]
          g += image.pixels[index + 1]
          b += image.pixels[index + 2]
          a += image.channels === 4 ? image.pixels[index + 3] : 255
          samples += 1
        }
      }
      const target = (targetY * size + targetX) * 4
      out[target] = Math.round(r / samples)
      out[target + 1] = Math.round(g / samples)
      out[target + 2] = Math.round(b / samples)
      out[target + 3] = Math.round(a / samples)
    }
  }
  return out
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(6, 9) // RGBA
  ihdr.writeUInt8(0, 10)
  ihdr.writeUInt8(0, 11)
  ihdr.writeUInt8(0, 12)

  const stride = size * 4
  const filtered = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0 // filter: none
    pixels.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(filtered, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function main() {
  const source = path.join(__dirname, 'icon-source.png')
  const target = path.join(__dirname, '..', 'electron', 'icon.ico')
  const SIZE = 256

  const pixels = resizeToSquare(decodePng(source), SIZE)
  const png = encodePng(pixels, SIZE)

  const iconDir = Buffer.alloc(6)
  iconDir.writeUInt16LE(0, 0) // reserved
  iconDir.writeUInt16LE(1, 2) // type: icon
  iconDir.writeUInt16LE(1, 4) // one image

  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0) // 256 encodes as byte 0
  entry.writeUInt8(0, 1)
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8) // payload size
  entry.writeUInt32LE(22, 12) // payload offset (header 6 + entry 16)

  fs.writeFileSync(target, Buffer.concat([iconDir, entry, png]))
  console.log('Windows icon written:', target, `(${fs.statSync(target).size} bytes)`)
}

main()
