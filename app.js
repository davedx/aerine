const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const koaStatic = require('koa-static')
const { Pool, Client } = require('pg')

const functions = require('./functions')

const app = new Koa()
app.use(bodyParser({enableTypes: ['text', 'json']}))
app.use(koaStatic('./app/'));

const pool = new Pool({
  user: 'dave',
  host: 'localhost',
  database: 'solnet_dev',
  password: ''
})

// TODO: tool to auto-build from DB schema?
// but this is user config, like schema.rb
const types = {
  post: {
    table: 'posts',
    writable: ['body', 'user_id'],
    relationFrom: ['user_id', 'user']
  },
  user: {
    table: 'users',
    functions: {
      update: 'authenticateUser'
    }
  }
}

const getAuthenticatedUser = (token) => {
  return 1
}

const buildQuery = (tuples, filters) => {
  let sql = 'SELECT'
  let tables = []
  let columns = []
  for (let i = 0; i < tuples.length; i++) {
    let typeEntry = types[tuples[i].type]
    let table = typeEntry.table
    tables.push(`${table} ${table[0]}`)
    for (let k = 0; k < tuples[i].properties.length; k++) {
      columns.push(`${table[0]}.${tuples[i].properties[k]}`)
    }
  }
  // FIXME - loop 2 at a time?
  let t1 = types[tuples[0].type]
  let t2 = types[tuples[1].type]
  // JOIN
  filters.push(`${t2.table[0]}.id=${t1.table[0]}.${t1.relationFrom[0]}`)
  sql = `SELECT ${columns.join(', ')} FROM ${tables.join(', ')} WHERE ${filters.join(' AND ')}`
  return sql
}

const accumulateTuple = (tuples, ref, i1, i2, relation) => {
  let tuple = tuples.find(t => t.type === ref[i1])
  if (!tuple) {
    tuple = {type: ref[i1], properties: [ref[i2]]}
    tuples.push(tuple)
  } else {
    tuple.properties.push(ref[i2])
  }
  if (relation) {
    tuple.relation = relation
  }
}

const handleRead = async query => {
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

    const sql = buildQuery(tuples, filters)
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

const handleDelete = async query => {
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

const mapUpdate = (query, type, { isInsert }) => {
  const columns = []
  const values = []

  for (let key in query.update) {
    const value = query.update[key]
    if (!type.writable.includes(key)) {
      throw new Error(`Cannot write to ${key} on ${query.action}`)
    }
    columns.push(key)
    let val
    if (typeof value !== 'number') {
      val = `'${value}'`
    } else {
      val = value
    }
    values.push(val)
  }

  if (isInsert) {
    columns.push('inserted_at')
  }
  columns.push('updated_at')
  const d = new Date().toJSON()
  const parts = d.split('T')
  const pgTs = `${parts[0]} ${(parts[1].split('.'))[0]}`

  if (isInsert) {
    values.push(`'${pgTs}'`)
  }

  values.push(`'${pgTs}'`)

  return { columns, values }
}

const handleUpdate = async query => {
  try {
    const type = types[query.action]

    if (type.functions && type.functions.update) {
      console.log('invoke ', type.functions.update, functions)
      return functions[type.functions.update](pool, query.update)
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

    const response = handleRead(query.queries)
    console.log(response)

    return response
  } catch (e) {
    console.error(e)
    return {
      error: e.message
    }
  }
}

const handleCreate = async query => {
  // TODO: validation
  // TODO: nested inserts
  try {
    const type = types[query.action]
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

    const response = handleRead(query.queries)
    console.log(response)

    return response
  } catch (e) {
    return {
      error: e.message
    }
  }
}

app.use(async ctx => {
  if (ctx.request.href.indexOf('data') !== -1) {
    const query = ctx.request.body
    let response = {}

    console.log('query: ', query)

    // TODO: switch/case
    if (query.action && query.method) {
      if (query.method === 'create') {
        response = await handleCreate(query)
      } else if (query.method === 'delete') {
        response = await handleDelete(query)
      } else if (query.method === 'update') {
        response = await handleUpdate(query)
      }
    } else {
      response = await handleRead(query)
    }

    ctx.body = response
  }
})

app.listen(3000)
