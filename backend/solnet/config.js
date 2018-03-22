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
      { name: 'token', type: 'string', read: false }, // FIXME: should this really be opt-out? hmmm, Rails, hmmmm?
      { name: 'password', type: 'string', read: false },
      { name: 'bio', type: 'string' },
      { name: 'location', type: 'string' }
    ],
    functions: {
      update: 'loginUser',
      create: 'createUser',
      delete: 'logoutUser'
    }
  },
  friend: {
    //recreate: true,
    //dumpData: true,
    table: 'friends',
    properties: [
      { name: 'user_id', type: 'integer' },
      { name: 'friend_id', type: 'integer' } // TODO: NOT NULL
    ],
    relationFrom: ['user_id', 'user'],
    relationFrom: ['friend_id', 'user']
  }
}

module.exports = { types }
