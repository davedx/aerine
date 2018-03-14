const bcrypt = require('bcrypt')
const uuidv4 = require('uuid/v4')
const { getTimestamps } = require('./db')

// const minLength = 6
const createUser = async (pool, currentUser, user, response) => {
  const passwordHash = await bcrypt.hash(user.password, 10)

  return {
    update: {
      ...user,
      password: passwordHash
    }
  }
}

const loginUser = async (pool, currentUser, user, response) => {
  const { email, password } = user
  console.log(`Authenticating user: ${user.email}`)

  const data = await pool.query(`SELECT id, password FROM users WHERE email='${email}'`)
  const foundUser = data.rows[0]
  if (!foundUser) {
    throw new Error(`Invalid user.`)
  }

  const matches = await bcrypt.compare(password, foundUser.password)
  if (matches) {
    // create new session
    const newToken = uuidv4()

    response.headers = {
      'X-token': newToken
    }

    return {
      update: {
        token: newToken
      },
      id: foundUser.id
    }
  } else {
    // TODO: make configurable if want to just say 'invalid login' instead
    throw new Error(`Incorrect password.`)
  }
}

const logoutUser = async (pool, currentUser, user, response) => {
  // this time we do use currentUser! :)
  if (!currentUser) {
    response.body = {status: 'OK'}
    return
  }
  const result = await pool.query(`UPDATE users SET token='' WHERE id=${currentUser.id}`)
  response.headers = {
    'X-token': ''
  }
  if (response.body.currentUser) {
    delete response.body.currentUser
  }
  return
}

module.exports = { createUser, loginUser, logoutUser }
