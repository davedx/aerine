const { Pool } = require('pg')

const connectDb = () => {
  return new Pool({
    user: 'dave',
    host: 'localhost',
    database: 'solnet_dev',
    password: ''
  })
}

const pgTypes = {
  string: 'varchar(255)',
  integer: 'bigint'
}

const buildQuery = (types, tuples, filters) => {
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

const getTimestamps = (columns, values, { isInsert }) => {
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
}

const mapUpdate = (query, type, { isInsert }) => {
  const columns = []
  const values = []

  for (let key in query.update) {
    const value = query.update[key]
    // FIXME: validations (including authorization)
    // if (!type.writable.includes(key)) {
    //   throw new Error(`Cannot write to ${key} on ${query.action}`)
    // }
    columns.push(key)
    let val
    if (typeof value !== 'number') {
      val = `'${value}'`
    } else {
      val = value
    }
    values.push(val)
  }

  getTimestamps(columns, values, { isInsert })

  return { columns, values }
}

module.exports = {
  pgTypes,
  connectDb,
  buildQuery,
  accumulateTuple,
  getTimestamps,
  mapUpdate
}
