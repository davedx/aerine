const bcrypt = require('bcrypt')
const uuidv4 = require('uuid/v4')
const { getTimestamps } = require('./db')

// const minLength = 6
const createUser = async (pool, currentUser, user) => {
  const passwordHash = await bcrypt.hash(user.password, 10)

  const columns = ['email', 'password']
  const values = [`'${user.email}'`, `'${passwordHash}'`]
  getTimestamps(columns, values, { isInsert: true })

  const sql = `INSERT INTO users (${columns.join(', ')}) VALUES (${values.join(', ')})`
  const result = await pool.query(sql)

  if (result.rowCount !== 1) {
    throw new Error(`Failed to create new user`)
  }

  return {event: 'CREATE_USER', status: 'OK'}
}

const loginUser = async (pool, currentUser, user) => {
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
    const result = await pool.query(`UPDATE users SET token='${newToken}' WHERE id=${foundUser.id}`)
    if (result.rowCount !== 1) {
      throw new Error(`Failed to login, please try again later.`)
    }
    //console.log('token result: ', result)
    return {event: 'LOGIN_USER', status: 'OK', token: newToken}
  } else {
    // TODO: make configurable if want to just say 'invalid login' instead
    throw new Error(`Incorrect password.`)
  }
}

const logoutUser = async (pool, currentUser, user) => {
  // this time we do use currentUser! :)
  const result = await pool.query(`UPDATE users SET token='' WHERE id=${currentUser.id}`)
  return {event: 'LOGOUT_USER', status: 'OK'}
}

module.exports = { createUser, loginUser, logoutUser }
