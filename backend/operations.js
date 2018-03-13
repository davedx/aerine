const {
  buildQuery,
  accumulateTuple,
  mapUpdate
} = require('./db')
const functions = require('./functions')

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

const handleRead = async (context) => {
  // FIXME: currently if no user, selects EVERYTHING
  // this behaviour should be controlled and definable in user types
  const request = context.request
  const response = context.response
  if (!request || !request.__references) {
    return
  }

  const refs = (request.__references || []).map(e => e.split('.'))
  console.log('refs: ', refs)

  for (let key in request) {
    if (key.indexOf('__') === 0) {
      continue
    }
    const type = request[key].type
    const owner = request[key].owner
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
    if (context.user) {
      filters.push(`p.user_id=${context.user.id}`)
    }

    const sql = buildQuery(context.types, tuples, filters)
    console.log('sql: ', sql)

    //const sql = `SELECT * FROM ${types[type].table} ${filter}`

    try {
      const data = await context.pool.query(sql)
      console.log(data.rows)
      response.body[key] = data.rows.map(row => {
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
      response.body[key] = {
        error: e.message
      }
    }
  }

  return true
}

const runFunctions = async (context, type) => {
  const request = context.request
  const response = context.response
  if (type.functions && type.functions.update) {
    const result = await functions[type.functions[request.method]](context.pool, context.user, request.update, response)
    if (!result) {
      return true
    }
    if (result.update) {
      request.update = result.update
    }
    if (result.id) {
      request.id = result.id
    }
    if (result.headers) {
      response.headers = result.headers
    }
  }
}

const runMutationQuery = async (pool, sql, query) => {
  console.log(sql)
  const data = await pool.query(sql)
  if (data.rowCount !== 1) {
    throw new Error(`Failed to update ${query.action}`)
  }
}

const handleUpdate = async (context) => {
  const request = context.request
  const response = context.response
  try {
    const type = context.types[request.action]

    const done = await runFunctions(context, type)
    if (done) {
      return true
    }

    if (!request.id) {
      throw new Error(`Cannot perform update with no ID specified`)
    }

    const { columns, values } = mapUpdate(request.update, type, { isInsert: false })

    const set = columns.map((val, idx) => {
      return `${val}=${values[idx]}`
    })

    const sql = `UPDATE ${type.table} SET ${set.join(', ')} WHERE id=${request.id}`

    await runMutationQuery(context.pool, sql, request)

    await handleRead({
      ...context,
      request: request.queries
    })

    return true
  } catch (e) {
    console.error('Error: ', e)
    response.body = {
      error: e.message
    }
  }
}

const handleDelete = async (context) => {
  const request = context.request
  const response = context.response
  try {
    const type = context.types[request.action]

    const done = await runFunctions(context, type)
    if (done) {
      return true
    }

    if (!request.id) {
      throw new Error(`Cannot delete if no ID specified`)
    }

    const sql = `DELETE FROM ${type.table} WHERE id=${request.id}`

    await runMutationQuery(context.pool, sql, request)

    await handleRead({
      ...context,
      request: request.queries
    })

    return true
  } catch (e) {
    console.error('Error: ', e)
    response.body = {
      error: e.message
    }
  }
}

const handleCreate = async (context) => {
  // TODO: validation
  // TODO: nested inserts
  const request = context.request
  const response = context.response
  try {
    const type = context.types[request.action]

    const done = await runFunctions(context, type)
    if (done) {
      return true
    }

    const { columns, values } = mapUpdate(request.update, type, { isInsert: true })

    if (context.user && type.table !== 'users') {
      columns.push('user_id')
      values.push(context.user.id)
    }

    const sql = `INSERT INTO ${type.table} (${columns.join(', ')}) VALUES (${values.join(', ')})`

    await runMutationQuery(context.pool, sql, request)

    await handleRead({
      ...context,
      request: request.queries
    })

    return true
  } catch (e) {
    console.error('Error: ', e)
    response.body = {
      error: e.message
    }
  }
}

module.exports = {
  getAuthenticatedUser,
  handleRead,
  handleCreate,
  handleUpdate,
  handleDelete
}
