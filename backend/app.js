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
      update: 'authenticateUser',
      create: 'createUser'
    }
  }
}

const getAuthenticatedUser = (token) => {
  return 1
}

const handleRead = async (pool, query) => {
  const refs = (query.__references || []).map(e => e.split('.'))
  console.log('refs: ', refs)
  let response = {}

  for (let key in query) {
    if (key === '__references') {
      continue
    }
    const type = query[key].type
    const owner = query[key].owner
    const user_id = getAuthenticatedUser()
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

    const filters = [`p.user_id=${user_id}`] //FIXME

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

const handleDelete = async (pool, query) => {
  console.log('handleDelete: ', query)
  const id = query.id
  const table = types[query.action].table
  try {
    const sql = `DELETE FROM ${table} WHERE id=${id}`
    console.log(sql)
    const result = await pool.query(sql)

    const response = handleRead(query.queries)
    console.log(response)
    return response
  } catch (e) {
    return {
      error: e.message
    }
  }
}

const handleUpdate = async (pool, query) => {
  try {
    const type = types[query.action]

    if (type.functions && type.functions.update) {
      return await functions[type.functions.update](pool, query.update)
    }

    const { columns, values } = mapUpdate(query, type, { createdTimestamp: false })

    const set = columns.map((val, idx) => {
      return `${val}=${values[idx]}`
    })

    const user_id = getAuthenticatedUser()

    const sql = `UPDATE ${type.table} SET ${set.join(', ')}`
    console.log(sql)
    return {}
    const data = await pool.query(sql)
    if (data.rowCount !== 1) {
      throw new Error(`Failed to insert new ${query.action}`)
    }

    const response = handleRead(pool, query.queries)
    console.log(response)

    return response
  } catch (e) {
    console.error('Error: ', e)
    return {
      error: e.message
    }
  }
}

const handleCreate = async (pool, query) => {
  // TODO: validation
  // TODO: nested inserts
  try {
    const type = types[query.action]

    if (type.functions && type.functions.create) {
      return await functions[type.functions.create](pool, query.update)
    }
    const { columns, values } = mapUpdate(query, type, { isInsert: true })

    // FIXME: if not a user!
    const user_id = getAuthenticatedUser()
    columns.push('user_id')
    values.push(user_id)

    const insertedColumns = columns.join(', ')

    const sql = `INSERT INTO ${type.table} (${insertedColumns}) VALUES (${values.join(', ')})`

    console.log(sql)
    const data = await pool.query(sql)
    if (data.rowCount !== 1) {
      throw new Error(`Failed to insert new ${query.action}`)
    }

    const response = handleRead(pool, query.queries)
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

      console.log('query: ', query)

      // TODO: switch/case
      if (query.action && query.method) {
        if (query.method === 'create') {
          response = await handleCreate(pool, query)
        } else if (query.method === 'delete') {
          response = await handleDelete(pool, query)
        } else if (query.method === 'update') {
          response = await handleUpdate(pool, query)
        }
      } else {
        response = await handleRead(pool, query)
      }

      ctx.body = response
    }
  })

  app.listen(3000)
}

init()
