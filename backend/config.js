
// TODO: tool to auto-build from DB schema?
// but this is user config, like schema.rb
const types = {
  post: {
    table: 'posts',
    properties: [
      { body: 'string' },
      { user_id: { type: 'integer', relationFrom: 'user' } }
    ],
    relationFrom: ['user_id', 'user']
  },
  user: {
    table: 'users',
    properties: [
      { first_name: 'string' },
      { surname: 'string' },
      { email: 'string' },
      { token: 'string' },
      { password: 'string' },
      { bio: 'string' },
      { location: 'string' }
    ],
    functions: {
      update: 'loginUser',
      create: 'createUser',
      delete: 'logoutUser'
    }
  }
}

// ROUTING!
const views = {
  index: {},
  timeline: {}
}

module.exports = { types, views }
