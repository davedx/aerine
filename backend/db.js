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

const patterns = {
  email: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
}

const addValidations = (type, key, value, errors) => {
  const property = type.properties.find(p => p.name === key)

  console.log(property)

  if (!property) {
    throw new Error(`Cannot write ${key} to ${type.table}`)
  }
  if (property.minLen) {
    if (value.length < property.minLen) {
      errors[key] = errors[key] || []
      errors[key].push(`Please enter a value at least ${property.minLen} characters long.`)
    }
  }
  if (property.pattern) {
    if (!patterns[property.pattern]) {
      // TODO: scan for invalid configuration at startup
      throw new Error(`Invalid pattern for ${key}: ${property.pattern}`)
    }
    const expr = patterns[property.pattern]
    if (!value.match(expr)) {
      errors[key] = errors[key] || []
      errors[key].push(`Please enter a valid ${property.pattern}.`)
    }
  }
}

const mapUpdate = (update, type, { isInsert }) => {
  const columns = []
  const values = []
  const errors = {}

  for (let key in update) {
    const value = update[key]

    // FIXME: authorization!
    addValidations(type, key, value, errors)

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

  if (Object.keys(errors).length > 0) {
    throw errors
  }

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
