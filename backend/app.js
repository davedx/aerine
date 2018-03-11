const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const koaStatic = require('koa-static')

const functions = require('./functions')
const {
  connectDb,
  buildQuery,
  accumulateTuple,
  mapUpdate
} = require('./db')

const { getSchemaForTable, updateSchemaForTable } = require('./schema')

const app = new Koa()
app.use(bodyParser({enableTypes: ['text', 'json']}))
app.use(koaStatic('./frontend/'));

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

const getAuthenticatedUser = async (pool, token) => {
  if (!token) {
    return
  }

  const sql = `SELECT id, email, token FROM users WHERE token='${token}'`
  const result = await pool.query(sql)
  if (result.rows) {
    return result.rows[0]
  }
}

const handleRead = async (pool, user, query) => {
  // FIXME: currently if no user, selects EVERYTHING
  // this behaviour should be controlled and definable in user types

  const refs = (query.__references || []).map(e => e.split('.'))
  console.log('refs: ', refs)

  let response = {}

  for (let key in query) {
    if (key.indexOf('__') === 0) {
      continue
    }
    const type = query[key].type
    const owner = query[key].owner
    //console.log('key: ', key, ' type: ', type, types[type])

    const refsForType = refs.filter(refList => refList[0] === key)
    //console.log('refsForType: ', refsForType)

    let tuples = []

    accumulateTuple(tuples, [refsForType[0][1], 'id'], 0, 1)

    for (let i = 0; i < refsForType.length; i++) {
      const ref = refsForType[i]
      //console.log('ref: ', ref)
      if (ref.length === 3) {
        // column of index table
        accumulateTuple(tuples, ref, 1, 2)
      } else if (ref.length === 4) {
        // joined column
        accumulateTuple(tuples, ref, 2, 3, ref[2])
      }
    }

    //console.log('tuples: ', tuples)

    const filters = []
    if (user) {
      filters.push(`p.user_id=${user.id}`)
    }

    const sql = buildQuery(types, tuples, filters)
    console.log('sql: ', sql)

    //const sql = `SELECT * FROM ${types[type].table} ${filter}`

    try {
      const data = await pool.query(sql)
      console.log(data.rows)
      response[key] = data.rows.map(row => {
        let newRow = {}
        for (let prop in row) {
          let tuple = tuples.find(t => t.properties.find(p => p === prop))
          //console.log('tuple for ', prop, ': ', tuple)
          if (tuple.relation) {
            if (!newRow[tuple.relation]) {
              newRow[tuple.relation] = {}
            }
            newRow[tuple.relation][prop] = row[prop]
          } else {
            newRow[prop] = row[prop]
          }
        }
        return newRow
      })
    } catch (e) {
      response[key] = {
        error: e.message
      }
    }
  }
  return response
}

const handleDelete = async (pool, user, query) => {
  console.log('handleDelete: ', query)
  try {
    const type = types[query.action]
    const id = query.id

    if (type.functions && type.functions.delete) {
      return await functions[type.functions.delete](pool, user, query.update)
    }

    if (!id) {
      throw new Error(`Cannot delete if no ID specified`)
    }

    const sql = `DELETE FROM ${type.table} WHERE id=${id}`
    console.log(sql)
    const result = await pool.query(sql)

    const response = handleRead(pool, user, query.queries)
    console.log(response)
    return response
  } catch (e) {
    console.error('Error: ', e)
    return {
      error: e.message
    }
  }
}

const handleUpdate = async (pool, user, query) => {
  try {
    const type = types[query.action]

    if (type.functions && type.functions.update) {
      return await functions[type.functions.update](pool, user, query.update)
    }

    const { columns, values } = mapUpdate(query, type, { createdTimestamp: false })

    const set = columns.map((val, idx) => {
      return `${val}=${values[idx]}`
    })

    const sql = `UPDATE ${type.table} SET ${set.join(', ')}`
    console.log(sql)
    return {}
    const data = await pool.query(sql)
    if (data.rowCount !== 1) {
      throw new Error(`Failed to insert new ${query.action}`)
    }

    const response = handleRead(pool, user, query.queries)
    console.log(response)

    return response
  } catch (e) {
    console.error('Error: ', e)
    return {
      error: e.message
    }
  }
}

const handleCreate = async (pool, user, query) => {

  // TODO: validation
  // TODO: nested inserts
  try {
    const type = types[query.action]

    if (type.functions && type.functions.create) {
      return await functions[type.functions.create](pool, user, query.update)
    }
    const { columns, values } = mapUpdate(query, type, { isInsert: true })

    if (user) {
      columns.push('user_id')
      values.push(user.id)
    }

    const insertedColumns = columns.join(', ')

    const sql = `INSERT INTO ${type.table} (${insertedColumns}) VALUES (${values.join(', ')})`

    console.log(sql)
    const data = await pool.query(sql)
    if (data.rowCount !== 1) {
      throw new Error(`Failed to insert new ${query.action}`)
    }

    const response = handleRead(pool, user, query.queries)
    console.log(response)

    return response
  } catch (e) {
    console.error('Error: ', e)
    return {
      error: e.message
    }
  }
}

const init = async () => {
  const pool = connectDb()

  // TODO: ONLY IF NODE_ENV=development
  for (let key in types) {
    await updateSchemaForTable(pool, types[key])
  }
//  getSchemaForTable(pool, 'users')

  app.use(async ctx => {
    if (ctx.request.href.indexOf('data') !== -1) {
      const query = ctx.request.body
      let response = {}
      let user

      if (ctx.request.headers['x-token']) {
        user = await getAuthenticatedUser(pool, ctx.request.headers['x-token'])
      }

      console.log('query: ', query)

      // TODO: switch/case
      if (query.action && query.method) {
        switch (query.method) {
          case 'create':
            response = await handleCreate(pool, user, query)
            break
          case 'delete':
            response = await handleDelete(pool, user, query)
            break
          case 'update':
            response = await handleUpdate(pool, user, query)
            break
        }
      } else {
        response = await handleRead(pool, user, query)
      }
      if (user) {
        // FIXME: still set if just logged out in handleDelete().
        // need to reorganize that
        response.currentUser = user
      }
      ctx.body = response
    }
  })

  app.listen(3000)
}

init()
