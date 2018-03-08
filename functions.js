const bcrypt = require('bcrypt')

const createUser = async (username, password) => {
  const passwordHash = await bcrypt.hash(password, 10)
  return {}
}

const authenticateUser = async (pool, { username, password }) => {
  console.log('authenticateUser')
  const data = await pool.query(`SELECT password FROM users WHERE email='${username}'`)
  const user = data.rows[0]
  const matches = await bcrypt.compare(password, user.password)
  if (matches) {
    // create new session
  } else {
    // TODO: make configurable if want to just say 'invalid login' instead
    throw new Error(`Incorrect password`)
  }
}

module.exports = { createUser, authenticateUser }
