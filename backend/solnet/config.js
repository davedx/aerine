
// TODO: tool to auto-build from DB schema?
// but this is user config, like schema.rb
// TODO: should just be a JSON file so it's easy to share between front end and back end
const types = {
  post: {
    table: 'posts',
    properties: [
      { name: 'body', type: 'string' },
      { name: 'user_id', type: 'integer' }
    ],
    relationFrom: ['user_id', 'user']
  },
  user: {
    table: 'users',
    properties: [
      { name: 'first_name', type: 'string', minLen: 2 },
      { name: 'surname', type: 'string', minLen: 2 },
      { name: 'email', type: 'string', pattern: 'email' },
      { name: 'token', type: 'string' },
      { name: 'password', type: 'string' },
      { name: 'bio', type: 'string' },
      { name: 'location', type: 'string' }
    ],
    functions: {
      update: 'loginUser',
      create: 'createUser',
      delete: 'logoutUser'
    }
  }
}

module.exports = { types }
