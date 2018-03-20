const bcrypt = require('bcrypt')
const uuidv4 = require('uuid/v4')
const { getTimestamps } = require('./db')

// const minLength = 6
// TODO: make this log them in too? what should default be...
const createUser = async (pool, currentUser, user, response) => {
  if (user.password.length < 6) {
    throw {password: [`Password too short (must be at least 6 characters).`]}
  }
  const passwordHash = await bcrypt.hash(user.password, 10)

  return {
    update: {
      ...user,
      password: passwordHash
    }
  }
}

const addFriend = async (pool, currentUser, request, response) => {
  console.log('addFriend...', request)
}

const loginUser = async (pool, currentUser, user, response) => {
  const { email, password } = user
  console.log(`Authenticating user: ${user.email}`)

  const data = await pool.query(`SELECT id, password FROM users WHERE email='${email}'`)
  const foundUser = data.rows[0]
  if (!foundUser) {
    throw {email: ['Invalid user.']}
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
    throw {password: [`Incorrect password.`]}
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
  response.body = {status: 'OK'}
  return
}

module.exports = { createUser, loginUser, logoutUser, addFriend }
