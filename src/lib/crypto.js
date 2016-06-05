'use strict'

const cryptico  = require('cryptico')
const base64    = require('js-base64').Base64
const pbkd2f    = require('pbkdf2')
const timer     = require('./timer')

let electron

exports.init = a => {
  electron = a
}

// Generates a one time application salt
exports.generateSalt = () => {
  return exports.generateSuperSalt(electron.crypt.supersalt.saltLen, electron.crypt.supersalt.maxpos)
}

// Generates the encryption keys used to decrypt and encrypt everything
exports.generateKey = passphrase => {
  let time
  let Totaltime = new timer()

  electron.crypt = electron.db.encryption.allSync()[0]
  let salt       = electron.db.salt.allSync()[0].salt
  let iterations = electron.crypt.pbkd2f.iterations
  let len        = electron.crypt.pbkd2f.count

  electron.log('Start key generation')
  electron.log('RSA encryption level: ' + electron.crypt.bits + 'bits')
  electron.log('pbkd2f iterations: ' + iterations.toLocaleString('en-US'))
  electron.log('pbkd2f length: ' + len)
  electron.log('Application salt(' + salt.length + ')')

  // Build the hash
  time     = new timer()
  let hash = pbkd2f.pbkdf2Sync(passphrase, salt, iterations, len, 'sha512')
  hash     = base64.encode(hash.toString('hex'))
  electron.log('pbkd2f hash(' + hash.length + ') complete: ' + time.stop() + 'ms')

  // Generate the RSA
  time      = new timer()
  const rsa = exports.generateRsa(hash)
  const pub = exports.generatePublic(rsa)
  electron.log('RSA key complete: ' + time.stop() + 'ms')
  electron.log('Key generation complete: ' + Totaltime.stop() + 'ms total')

  electron.encryption = {
    rsa: rsa,
    pub: pub,
  }
}

// Can generate 'super' salts (random characters) from all character codes
exports.generateSuperSalt = (amount, maxpos) => {
  let salt = ''
  let chars = ''
  for (let i = 32; i < maxpos; i++) chars += String.fromCharCode(i)
  for (let i = 0; i < amount; i++) salt += chars.charAt(Math.floor(Math.random() * chars.length))
  return salt
}

// Using cryptico to generate RSA key
exports.generateRsa = input => {
  return cryptico.generateRSAKey(input, electron.crypt.bits)
}

// Using cryptico to generate public key from RSA
exports.generatePublic = input => {
  return cryptico.publicKeyString(input)
}

// Using cryptico to encrypt strings
exports.encryptString = (string, publickey, cb) => {
  let encrypted = cryptico.encrypt(base64.encode(string), publickey)
  if (encrypted)
    if (encrypted.status)
      if (encrypted.status == 'Invalid public key')
        cb(encrypted.status)
  cb(null, encrypted.cipher)
}

// Using cryptico to decrypt strings
exports.decryptString = (string, privatekey, cb) => {
  let decrypted = cryptico.decrypt(string, privatekey)
  cb(null, base64.decode(decrypted.plaintext))
}